from __future__ import annotations

from typing import Iterable, Optional

from beanie.operators import In

from chat_types.models import File as ApiFile
from chat_types.models import Message as ApiMessage
from modules import utils
from modules.db import Message as DbMessage
from modules.db import StoredFile


def stored_file_to_api(file: StoredFile) -> dict:
    return utils.dtoa(
        ApiFile,
        {
            "id": file.id,
            "name": file.name,
            "mime_type": file.mime_type,
            "size": file.size,
            "url": file.url,
        },
    )


def _merge_embeds(message_dump: dict) -> list[dict]:
    # embeds are split in db but the api model only wants `embeds`
    return (message_dump.get("user_embeds") or []) + (
        message_dump.get("system_embeds") or []
    )


async def _files_by_id(file_ids: list[str]) -> dict[str, StoredFile]:
    if not file_ids:
        return {}
    files = await StoredFile.find(In(StoredFile.id, list(set(file_ids)))).to_list()
    return {f.id: f for f in files}


async def message_to_api(
    message: DbMessage,
    *,
    files_by_id: Optional[dict[str, StoredFile]] = None,
) -> dict:
    # beanie gives us a consistent dump and it already turns nested pydantic models into dicts
    d = message.model_dump(exclude={"deleted_at"})
    d = utils.convert_dates_to_iso(d)

    embeds = _merge_embeds(d)
    file_ids = list(d.get("file_ids") or [])

    if files_by_id is None:
        files_by_id = await _files_by_id(file_ids)

    files = [
        stored_file_to_api(files_by_id[fid]) for fid in file_ids if fid in files_by_id
    ]

    return utils.dtoa(
        ApiMessage,
        {
            **d,
            "embeds": embeds,
            "files": files,
        },
    )


async def messages_to_api(messages: Iterable[DbMessage]) -> list[dict]:
    msgs = list(messages)
    file_ids: list[str] = []
    for m in msgs:
        file_ids.extend(m.file_ids or [])

    files_by_id = await _files_by_id(file_ids)
    return [await message_to_api(m, files_by_id=files_by_id) for m in msgs]
