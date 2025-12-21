from __future__ import annotations

import enum
import types
from dataclasses import fields, is_dataclass
from datetime import datetime
from typing import Any, get_args, get_origin, Union, List


def _parse_datetime(value: str) -> datetime:
    # lol python hates "z", so we patch it to +00:00
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def dataclass_from_dict(klass: Any, data: Any) -> Any:
    # basically the server's dataclass_from_dict, but with datetime parsing

    def is_dataclass_type(cls: Any) -> bool:
        try:
            return hasattr(cls, "__dataclass_fields__")
        except Exception:
            return False

    def _convert(tp: Any, val: Any) -> Any:
        if val is None:
            return None

        if tp is datetime and isinstance(val, str):
            try:
                return _parse_datetime(val)
            except Exception:
                return val

        origin = get_origin(tp)
        args = get_args(tp)

        if origin in (list, List):
            if not isinstance(val, list):
                raise TypeError(f"expected list for {tp}, got {type(val)}")
            inner = args[0] if args else Any
            return [_convert(inner, item) for item in val]

        if (
            origin == Union
            or isinstance(tp, types.UnionType)
            or origin == types.UnionType
        ):
            union_args = args
            if not union_args and hasattr(tp, "__args__"):
                union_args = getattr(tp, "__args__", ())
            non_none_args = [a for a in union_args if a is not type(None)]
            for inner in non_none_args:
                try:
                    return _convert(inner, val)
                except Exception:
                    continue
            return val

        if is_dataclass_type(tp) and isinstance(val, dict):
            fld_types = {f.name: f.type for f in fields(tp)}
            converted: dict[str, Any] = {}
            for key, inner_val in val.items():
                if key in fld_types:
                    converted[key] = _convert(fld_types[key], inner_val)
                else:
                    converted[key] = inner_val
            return tp(**converted)

        if isinstance(tp, type) and issubclass(tp, enum.Enum):
            if isinstance(val, tp):
                return val
            return tp(val)

        return val

    return _convert(klass, data)


def asdict_shallow(obj: Any) -> dict[str, Any]:
    # lowkey just enough for requests
    if is_dataclass(obj):
        return {f.name: getattr(obj, f.name) for f in fields(obj)}
    if isinstance(obj, dict):
        return obj
    raise TypeError("expected dataclass or dict")


