import asyncio
from datetime import UTC, datetime
from chat_types.models import (
    Message as ApiMessage,
    Channel as ApiChannel,
    Author as ApiAuthor,
    File as ApiFile,
)
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel, ChannelMember, Message, StoredFile
from modules import utils
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import MessageCreated, MessageUpdated, MessageDeleted
from beanie.operators import In
from modules.urls import embed_message_content

bp = Blueprint("messages")


def _file_to_api(file: StoredFile) -> dict:
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


async def _messages_to_api(messages: list[Message]) -> list[dict]:
    file_ids: list[str] = []
    for m in messages:
        file_ids.extend(m.file_ids or [])

    files_by_id: dict[str, StoredFile] = {}
    if file_ids:
        files = await StoredFile.find(In(StoredFile.id, list(set(file_ids)))).to_list()
        files_by_id = {f.id: f for f in files}

    out: list[dict] = []
    for m in messages:
        files = [
            _file_to_api(files_by_id[fid])
            for fid in (m.file_ids or [])
            if fid in files_by_id
        ]
        out.append(utils.dtoa(ApiMessage, {**m.dict(), "files": files}))
    return out


@bp.route("/v1/channels/<channel_id>/messages", methods=["GET"])
@authorized()
async def get_messages(request: Request, channel_id: str):
    channel: Channel = await Channel.find_one(Channel.id == channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    if (
        channel.private
        and (
            await ChannelMember.find_one(
                ChannelMember.channel_id == channel_id,
                ChannelMember.user_id == request.ctx.user.id,
            )
        )
        is None
    ):
        raise exceptions.Forbidden("You are not a member of this channel")

    args = request.args
    after = args.get("after", None)
    before = args.get("before", None)
    limit = args.get("limit", 50)
    author_id = args.get("author_id", None)
    contains = args.get("contains", None)

    limit = min(limit, 100)
    limit = max(limit, 1)

    query = {
        "deleted_at": None,
        "channel_id": channel_id,
    }

    if after:
        query["created_at"] = {"$gt": after}
    if before:
        query["created_at"] = {"$lt": before}
    if author_id:
        query["author_id"] = author_id
    if contains:
        query["content"] = {"$regex": contains}

    messages = (
        await Message.find(query).sort(-Message.created_at).limit(limit).to_list()
    )

    return json(await _messages_to_api(messages))


EDITABLE_FIELDS = ["content"]


@bp.route("/v1/channels/<channel_id>/messages", methods=["POST"])
@authorized()
async def create_message(request: Request, channel_id: str):
    channel: Channel = await Channel.find_one(Channel.id == channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    if (
        channel.private
        and (
            await ChannelMember.find_one(
                ChannelMember.channel_id == channel_id,
                ChannelMember.user_id == request.ctx.user.id,
            )
        )
        is None
    ):
        raise exceptions.Forbidden("You are not a member of this channel")

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    content = data.get("content", None)
    file_ids = data.get("file_ids", [])
    nonce = data.get("nonce", None)

    if not await Message.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    if content:
        content = content.strip()  # this is already validated

    files: list[StoredFile] = []
    if file_ids:
        files = await StoredFile.find(
            In(StoredFile.id, file_ids),
            StoredFile.owner_id == request.ctx.user.id,
            StoredFile.uploaded == True,
        ).to_list()
        if len(files) != len(file_ids):
            raise exceptions.BadRequest("File not uploaded")

    message = Message(
        author_id=request.ctx.user.id,
        channel_id=channel_id,
        content=content,
        file_ids=file_ids,
        nonce=nonce,
        user_embeds=data.get("embeds", []),
    )
    await message.save()

    if not data.get("embeds"):
        asyncio.create_task(embed_message_content(message))

    total_bytes = len(content) if content else 0
    for file in files:
        total_bytes += file.size

    if total_bytes > 0:
        request.ctx.user.inc_bytes(total_bytes)

    await request.ctx.user.fetch_status()

    api_files = {f.id: f for f in files}
    message_api = utils.dtoa(
        ApiMessage,
        {
            **message.dict(),
            "files": [
                _file_to_api(api_files[fid]) for fid in file_ids if fid in api_files
            ],
        },
    )

    publish_event(
        MessageCreated(
            message=message_api,
            author=utils.dtoa(ApiAuthor, request.ctx.user),
        )
    )

    return json(message_api)


@bp.route("/v1/channels/<channel_id>/messages/<message_id>", methods=["PATCH"])
@authorized()
async def update_message(request: Request, channel_id: str, message_id: str):
    message: Message = await Message.find_one(
        Message.id == message_id,
        Message.deleted_at == None,
        Message.channel_id == channel_id,
    )
    if not message:
        raise exceptions.NotFound("Message not found")

    if message.author_id != request.ctx.user.id and not request.ctx.user.flags.admin:
        raise exceptions.Forbidden("You are not the author of this message")

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not await Message.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    if data.get("content"):
        data["content"] = data["content"].strip()  # this is already validated

    byte_diff = len(data.get("content", "")) - len(message.content or "")
    if byte_diff != 0:
        request.ctx.user.inc_bytes(byte_diff)

    for key, value in data.items():
        if key in EDITABLE_FIELDS:
            setattr(message, key, value)

    if data.get("embeds"):
        message.user_embeds = data["embeds"]

    message.updated_at = datetime.now(UTC)
    await message.save_changes()

    if not data.get("embeds"):
        asyncio.create_task(embed_message_content(message))

    await request.ctx.user.fetch_status()

    # files are static rn so we just send empty list if we can’t expand
    api_message = (await _messages_to_api([message]))[0]
    publish_event(MessageUpdated(message=api_message))

    return json(api_message)


@bp.route("/v1/channels/<channel_id>/messages/<message_id>", methods=["DELETE"])
@authorized()
async def delete_message(request: Request, channel_id: str, message_id: str):
    message: Message = await Message.find_one(
        Message.id == message_id,
        Message.channel_id == channel_id,
        Message.author_id == request.ctx.user.id,
    )
    if not message:
        raise exceptions.NotFound("Message not found")

    message.deleted_at = datetime.now(UTC)
    await message.save_changes()

    if message.content:
        request.ctx.user.inc_bytes(-len(message.content))

    publish_event(MessageDeleted(message_id=message_id, channel_id=channel_id))

    api_message = (await _messages_to_api([message]))[0]
    return json(api_message)
