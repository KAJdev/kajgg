from datetime import UTC, datetime
from chat_types.models import (
    Message as ApiMessage,
    Channel as ApiChannel,
    Author as ApiAuthor,
)
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel, ChannelMember, Message
from modules import utils
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import MessageCreated, MessageUpdated, MessageDeleted

bp = Blueprint("messages")


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

    return json([utils.dtoa(ApiMessage, message) for message in messages])


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

    if not all(data.get(k) for k in ("content",)):
        raise exceptions.BadRequest("Bad Request")

    message = Message(
        author_id=request.ctx.user.id,
        channel_id=channel_id,
        content=data["content"],
    )
    await message.save()

    await request.ctx.user.fetch_status()

    publish_event(
        MessageCreated(
            message=utils.dtoa(ApiMessage, message),
            channel=utils.dtoa(ApiChannel, channel),
            author=utils.dtoa(ApiAuthor, request.ctx.user),
        )
    )

    return json(utils.dtoa(ApiMessage, message))


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

    if not all(data.get(k) for k in ("content",)):
        raise exceptions.BadRequest("Bad Request")

    message.content = data["content"]
    message.updated_at = datetime.now(UTC)
    await message.save()

    await request.ctx.user.fetch_status()

    publish_event(MessageUpdated(message=utils.dtoa(ApiMessage, message)))

    return json(utils.dtoa(ApiMessage, message))


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
    await message.save()

    publish_event(MessageDeleted(message_id=message_id, channel_id=channel_id))

    return json(utils.dtoa(ApiMessage, message))
