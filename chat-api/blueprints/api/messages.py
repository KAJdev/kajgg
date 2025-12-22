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
from modules.serializers import message_to_api, messages_to_api
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import MessageCreated, MessageUpdated, MessageDeleted
from beanie.operators import In
from modules.urls import embed_message_content
from modules.mentions import extract_mention_usernames, resolve_mentions_for_channel

bp = Blueprint("messages")


async def _messages_to_api(messages: list[Message]) -> list[dict]:
    return await messages_to_api(messages)


def try_int(value: str) -> int:
    if value is None:
        return 50
    try:
        return int(value)
    except ValueError:
        raise exceptions.BadRequest("Value is not an integer")


def try_datetime(value: str) -> datetime:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise exceptions.BadRequest("Value is not a valid ISO date")


@bp.route("/v1/channels/<channel_id>/messages", methods=["GET"])
@authorized()
async def get_messages(request: Request, channel_id: str):
    channel: Channel = await Channel.find_one(Channel.id == channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    if (
        channel.author_id != request.ctx.user.id
        and channel.private
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
    after = try_datetime(args.get("after", None))
    before = try_datetime(args.get("before", None))
    limit = try_int(args.get("limit", "50"))
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

    # paging be like: `before` wants closest older so newest-first is fine,
    # but `after` wants closest newer so we gotta go oldest-first or it skips a ton.
    sort_field = -Message.created_at
    if after and not before:
        sort_field = Message.created_at

    messages = await Message.find(query).sort(sort_field).limit(limit).to_list()

    return json(await _messages_to_api(messages))


EDITABLE_FIELDS = ["content"]


@bp.route("/v1/channels/<channel_id>/messages", methods=["POST"])
@authorized()
async def create_message(request: Request, channel_id: str):
    channel: Channel = await Channel.find_one(Channel.id == channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    if (
        channel.author_id != request.ctx.user.id
        and channel.private
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

    mentions = []
    if content:
        usernames = extract_mention_usernames(content)
        if usernames:
            mentions = await resolve_mentions_for_channel(channel, usernames)

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
        mentions=mentions,
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

    message_api = await message_to_api(message, files_by_id={f.id: f for f in files})

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

        channel = await Channel.find_one(Channel.id == channel_id)
        if channel:
            usernames = extract_mention_usernames(data["content"])
            message.mentions = (
                await resolve_mentions_for_channel(channel, usernames)
                if usernames
                else []
            )

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

    api_message = await message_to_api(message)
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
