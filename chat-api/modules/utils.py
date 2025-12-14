from enum import Enum
from os import getenv
from typing import Any, Type, TypeVar
import types
import aiohttp
from attr import asdict
from sanic import Request
import base64
from datetime import UTC, datetime
from cuid2 import Cuid
from dataclasses import fields, is_dataclass
import logging
from dataclasses import MISSING
from pydantic import BaseModel, ConfigDict, Field, create_model
from beanie import Document
from typing import get_origin, get_args, Union, List
import enum

CUID_GENERATOR: Cuid = Cuid(length=10)
SECRET_GENERATOR: Cuid = Cuid(length=32)

T = TypeVar("T")


def generate_id():
    return CUID_GENERATOR.generate()


def generate_secret():
    return SECRET_GENERATOR.generate()


def convert_dates_to_iso(d):
    if isinstance(d, datetime):
        return d.isoformat() + "Z"
    if isinstance(d, list):
        return [convert_dates_to_iso(item) for item in d]
    if not isinstance(d, dict):
        return d

    for k, v in d.items():
        d[k] = convert_dates_to_iso(v)
    return d


def convert_enums_to_strings(d):
    if isinstance(d, Enum):
        return d.value
    if isinstance(d, list):
        return [convert_enums_to_strings(item) for item in d]
    if not isinstance(d, dict):
        return d

    for k, v in d.items():
        d[k] = convert_enums_to_strings(v)
    return d


def is_pydantic_model(cls) -> bool:
    try:
        return issubclass(cls, (BaseModel, Document))
    except TypeError:
        # cls is not a class (e.g., instance), issubclass would fail
        return False


def dtoa(cls: Type[T], data: dict | Any) -> T:
    """
    Converts a dictionary or dataclass to a dictionary using the fields of the given class.
    """

    field_names = {f.name for f in fields(cls)}
    if is_dataclass(data):
        data = asdict(data)
    if "model_dump" in dir(data):
        data = data.model_dump()
    # get any @property fields
    for k, v in data.items():
        if hasattr(cls, k) and isinstance(getattr(cls, k), property):
            data[k] = getattr(cls, k).fget(data)
    data = {k: v for k, v in data.items() if k in field_names}

    # make sure any datetime objects are converted to ISO strings
    # and any enums are converted to strings
    data = convert_dates_to_iso(data)
    data = convert_enums_to_strings(data)
    return data


def internal_auth(request: Request) -> bool:
    if not (internal_token := request.headers.get("Authorization")):
        return False

    return internal_token == getenv("INTERNAL_TOKEN")


def generate_token(id_: str) -> str:
    b64id = base64.b64encode(id_.encode()).decode()
    timestampb64 = (
        base64.b64encode(str(int(datetime.now(UTC).timestamp())).encode())
        .decode()
        .rstrip("=")
    )
    randomness = generate_id()

    return f"{b64id}.{timestampb64}.{randomness}"


def deconstruct_token(token: str) -> tuple[str, int, str]:
    b64id, timestampb64, randomness = token.split(".")
    id_ = base64.b64decode(b64id).decode()
    timestamp = int(base64.b64decode(timestampb64 + "==").decode())

    return id_, timestamp, randomness


async def gpt(
    sys_prompt: str,
    msgs: list[tuple[str, str | list[dict]]],
    temperature: float = 1,
    max_tokens: int = 1024,
) -> str:
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {getenv('OPENAI_TOKEN')}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    *[{"role": m[0], "content": m[1]} for m in msgs],
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        ) as resp:
            try:
                data = await resp.json()
                completion = data["choices"][0]["message"]["content"]
                return completion
            except Exception as e:
                logging.error(f"Failed to generate completion: {e}")
                return None


# retry with times
def retry(times: int = 3):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            for i in range(times):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    logging.error(f"Failed to execute function: {e}")
                    logging.info("Retrying...")
            return None

        return wrapper

    return decorator


def dataclass_from_dict(klass, data):
    """
    Recursively convert a dict (or list of dicts) into a dataclass instance.
    Handles nested dataclasses, optional fields, lists, and basic types.
    """

    def is_dataclass_type(cls):
        try:
            return hasattr(cls, "__dataclass_fields__")
        except Exception:
            return False

    def _convert(klass, data):
        # Handle None for Optional/Union fields
        if data is None:
            return None

        origin = get_origin(klass)
        args = get_args(klass)

        # Handle lists
        if origin == list or origin == List:
            if not isinstance(data, list):
                raise TypeError(f"Expected list for {klass}, got {type(data)}")
            return [_convert(args[0], item) for item in data]

        # Handle Optionals and Unions (Optional is Union[..., NoneType])
        if (
            origin == Union
            or isinstance(klass, types.UnionType)
            or origin == types.UnionType
        ):
            union_args = args
            if not union_args and hasattr(klass, "__args__"):
                union_args = getattr(klass, "__args__", ())
            non_none_args = [arg for arg in union_args if arg is not type(None)]
            # Try to build with the non-None type(s)
            for typ in non_none_args:
                try:
                    return _convert(typ, data)
                except Exception:
                    continue
            return data  # fallback for unknown Union

        # Handle dictionaries as data for dataclasses
        if is_dataclass_type(klass) and isinstance(data, dict):
            fld_types = {f.name: f.type for f in fields(klass)}
            converted = {}
            for key, val in data.items():
                if key in fld_types:
                    converted[key] = _convert(fld_types[key], val)
                else:
                    converted[key] = val  # unknown/extra field, just pass through
            return klass(**converted)

        if isinstance(klass, type) and issubclass(klass, enum.Enum):
            if isinstance(data, klass):
                return data
            return klass(data)

        # Fallback: just return as-is
        return data

    return _convert(klass, data)


class DataclassBackedModel(BaseModel):
    # lowkey just a base for "generated from dataclass" models
    model_config = ConfigDict(extra="ignore", arbitrary_types_allowed=True)


_DC_MODEL_CACHE: dict[type, type[BaseModel]] = {}


def pydantic_model_from_dataclass(
    dc_cls: type, *, name: str | None = None
) -> type[BaseModel]:
    """
    create a pydantic model class from a stdlib dataclass type.

    this is mainly for beanie nesting: beanie wants pydantic models, but typegen gives us dataclasses.
    """

    if dc_cls in _DC_MODEL_CACHE:
        return _DC_MODEL_CACHE[dc_cls]

    if not is_dataclass(dc_cls):
        raise TypeError("expected a dataclass type")

    def _map_type(tp):
        origin = get_origin(tp)
        args = get_args(tp)

        # list[t]
        if origin in (list, List):
            inner = args[0] if args else Any
            return list[_map_type(inner)]

        # optional/union
        if (
            origin == Union
            or isinstance(tp, types.UnionType)
            or origin == types.UnionType
        ):
            union_args = args
            if not union_args and hasattr(tp, "__args__"):
                union_args = getattr(tp, "__args__", ())
            if not union_args:
                return tp
            mapped = tuple(_map_type(a) for a in union_args)
            # rebuild union the simplest way
            out = mapped[0]
            for extra in mapped[1:]:
                out = out | extra
            return out

        # nested dataclass
        if isinstance(tp, type) and is_dataclass(tp):
            return pydantic_model_from_dataclass(tp)

        return tp

    model_name = name or f"{dc_cls.__name__}Model"

    field_defs: dict[str, tuple[Any, Any]] = {}
    for f in fields(dc_cls):
        ann = _map_type(f.type)
        if f.default is not MISSING:
            default = f.default
        elif f.default_factory is not MISSING:  # type: ignore[comparison-overlap]
            default = Field(default_factory=f.default_factory)  # type: ignore[arg-type]
        else:
            default = ...
        field_defs[f.name] = (ann, default)

    model = create_model(model_name, __base__=DataclassBackedModel, **field_defs)
    _DC_MODEL_CACHE[dc_cls] = model
    return model
