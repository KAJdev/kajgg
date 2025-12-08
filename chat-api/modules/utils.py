# dont think about this too much
og_print = print

import inspect
from os import getenv
from typing import Any, Type, TypeVar
import aiohttp
from attr import asdict
from sanic import Request
import base64
from datetime import UTC, datetime
import os
import tqdm
from cuid2 import Cuid
from dataclasses import fields, is_dataclass

CUID_GENERATOR: Cuid = Cuid(length=10)

T = TypeVar("T")


def generate_id():
    return CUID_GENERATOR.generate()


def dtoa(cls: Type[T], data: dict | Any) -> T:
    """
    Converts a dictionary or dataclass to a dictionary using the fields of the given class.
    """

    field_names = {f.name for f in fields(cls)}
    if is_dataclass(data):
        data = asdict(data)
    return {k: v for k, v in data.items() if k in field_names}


def print(*args, important=False, **kwargs):
    stack = inspect.stack()
    caller_frame = stack[1]
    frame_info = inspect.getframeinfo(caller_frame[0])
    mod = frame_info.filename.split(".")[0].split("/")[-1].split("\\")[-1]
    s = " ".join(
        [f"--->" if important else "    ", f"[{mod}]", *[str(a) for a in args]]
    )
    tqdm.tqdm.write(s)


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
                print(f"Failed to generate completion: {e}", important=True)
                return None


# retry with times
def retry(times: int = 3):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            for i in range(times):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    print(f"Failed to execute function: {e}", important=True)
                    print("Retrying...", important=True)
            return None

        return wrapper

    return decorator
