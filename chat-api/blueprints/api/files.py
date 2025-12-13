from sanic import Blueprint, Request, json, exceptions
from sanic_ext import openapi
from os import getenv

from modules.auth import authorized
from modules.db import StoredFile
from modules.utils import generate_id
from modules import r2
from beanie.operators import In


bp = Blueprint("files")


def _sanitize_filename(name: str) -> str:
    # keep it chill: drop path separators and weird control chars
    name = name.replace("\\", "/").split("/")[-1]
    return "".join(ch for ch in name if 31 < ord(ch) < 127).strip()[:200] or "file"


def _file_to_api(file: StoredFile) -> dict:
    return {
        "id": file.id,
        "name": file.name,
        "mime_type": file.mime_type,
        "size": file.size,
        "url": file.url,
    }


@bp.route("/v1/files/presign", methods=["POST"])
@openapi.exclude()
@authorized()
async def presign_files(request: Request):
    data = request.json or {}
    files = data.get("files")
    if not isinstance(files, list) or len(files) == 0:
        raise exceptions.BadRequest("Bad Request")

    max_files = int(getenv("MAX_FILES_PER_MESSAGE", "10"))
    if len(files) > max_files:
        raise exceptions.BadRequest("Too many files")

    env = getenv("ENV", "staging")
    out = []
    for f in files:
        if not isinstance(f, dict):
            raise exceptions.BadRequest("Bad Request")

        name = _sanitize_filename(str(f.get("name") or "file"))
        mime_type = str(f.get("mime_type") or "application/octet-stream")
        try:
            size = int(f.get("size") or 0)
        except Exception:
            size = 0

        if size <= 0:
            raise exceptions.BadRequest("Invalid file size")

        # max upload size (bytes)
        max_size = int(getenv("MAX_UPLOAD_SIZE", str(1024 * 1024 * 50)))  # 50mb default
        if size > max_size:
            raise exceptions.BadRequest("File too large")

        file_id = generate_id()
        key = f"{env}/uploads/{request.ctx.user.id}/{file_id}/{name}"

        upload = await r2.presign_put_object_async(key=key, content_type=mime_type)
        public_url = r2.build_public_url(key)

        stored = StoredFile(
            id=file_id,
            owner_id=request.ctx.user.id,
            name=name,
            mime_type=mime_type,
            size=size,
            key=key,
            url=public_url,
            uploaded=False,
        )
        await stored.save()

        out.append(
            {
                "file": _file_to_api(stored),
                "upload_url": upload.url,
                "method": upload.method,
            }
        )

    return json(out)


@bp.route("/v1/files/complete", methods=["POST"])
@openapi.exclude()
@authorized()
async def complete_files(request: Request):
    data = request.json or {}
    file_ids = data.get("file_ids")
    if not isinstance(file_ids, list) or len(file_ids) == 0:
        raise exceptions.BadRequest("Bad Request")

    stored_files = await StoredFile.find(
        In(StoredFile.id, file_ids),
        StoredFile.owner_id == request.ctx.user.id,
    ).to_list()

    if len(stored_files) != len(file_ids):
        raise exceptions.NotFound("File not found")

    def _versioned_url(f: StoredFile) -> str:
        # add a cache-busting version so any early 404s (from fetching before upload finished)
        # don't get stuck in a cdn cache
        ts = int((f.uploaded_at or f.created_at).timestamp() * 1000)
        base = r2.build_public_url(f.key)
        return f"{base}?v={ts}"

    completed = []
    for f in stored_files:
        if f.uploaded:
            f.url = _versioned_url(f)
            await f.save_changes()
            completed.append(_file_to_api(f))
            continue

        try:
            head = await r2.head_object_async(f.key)
        except Exception:
            raise exceptions.BadRequest("Upload not found")

        remote_size = int(head.get("ContentLength") or 0)
        if remote_size != int(f.size):
            raise exceptions.BadRequest("Upload size mismatch")

        f.uploaded = True
        # set uploaded_at now that we know it exists
        from datetime import datetime, UTC

        f.uploaded_at = datetime.now(UTC)
        f.url = _versioned_url(f)
        await f.save_changes()
        completed.append(_file_to_api(f))

    return json(completed)
