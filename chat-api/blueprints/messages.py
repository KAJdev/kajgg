from types.models import Message as ApiMessage
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel, ChannelMember, Message
from modules import utils
from modules.auth import authorized

bp = Blueprint("auth")


@bp.route("/v1/channel/<channel_id>/messages", methods=["GET"])
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

    query = {}

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


@bp.route("/v1/channel/<channel_id>/messages", methods=["POST"])
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
    return json(utils.dtoa(ApiMessage, message))
