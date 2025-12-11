from os import getenv
from dataclasses import dataclass
import asyncio
import boto3
from botocore.config import Config


@dataclass(frozen=True)
class PresignedPut:
    url: str
    method: str = "PUT"


def _required_env(name: str) -> str:
    value = getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def get_s3_client():
    # lowkey r2 is just s3 vibes with a different endpoint
    return boto3.client(
        "s3",
        endpoint_url=_required_env("R2_ENDPOINT_URL"),
        aws_access_key_id=_required_env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=_required_env("R2_SECRET_ACCESS_KEY"),
        region_name=getenv("R2_REGION", "auto"),
        config=Config(signature_version="s3v4"),
    )


def get_bucket() -> str:
    return _required_env("R2_BUCKET")


def build_public_url(key: str) -> str:
    # if you’ve got a public bucket or a custom domain, put it here
    base = _required_env("R2_PUBLIC_BASE_URL").rstrip("/")
    return f"{base}/{key.lstrip('/')}"


def presign_put_object(
    key: str, content_type: str, expires_in: int = 60 * 10
) -> PresignedPut:
    client = get_s3_client()
    url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": get_bucket(),
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return PresignedPut(url=url)


async def presign_put_object_async(
    key: str, content_type: str, expires_in: int = 60 * 10
) -> PresignedPut:
    # boto3 is sync, so we punt it to a thread to avoid blocking the sanic loop
    return await asyncio.to_thread(presign_put_object, key, content_type, expires_in)


def head_object(key: str) -> dict:
    client = get_s3_client()
    return client.head_object(Bucket=get_bucket(), Key=key)


async def head_object_async(key: str) -> dict:
    # network call -> definitely don’t do this on the event loop
    return await asyncio.to_thread(head_object, key)
