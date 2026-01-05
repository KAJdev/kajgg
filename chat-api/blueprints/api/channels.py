from chat_types.models import (
    Channel as ApiChannel,
    Message as ApiMessage,
    MessageType,
    User as ApiUser,
)
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel, ChannelMember, Message, ChannelInvite
from modules import utils
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import (
    ChannelCreated,
    ChannelUpdated,
    ChannelDeleted,
    MessageCreated,
)

bp = Blueprint("channels")


@bp.route("/v1/channels", methods=["GET"])
@authorized()
async def get_channels(request: Request):
    channels = await Channel.get_user_channels(request.ctx.user.id)
    return json([utils.dtoa(ApiChannel, channel) for channel in channels])


@bp.route("/v1/channels", methods=["POST"])
@authorized()
async def create_channel(request: Request):
    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not await Channel.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    channel = Channel(
        name=data.get("name"),
        topic=data.get("topic", ""),
        private=data.get("private", False),
        author_id=request.ctx.user.id,
    )
    await channel.save()

    member = ChannelMember(
        channel_id=channel.id,
        user_id=request.ctx.user.id,
    )
    await member.save()

    publish_event(ChannelCreated(channel=utils.dtoa(ApiChannel, channel)))

    return json(utils.dtoa(ApiChannel, channel))


EDITABLE_FIELDS = ["name", "topic", "private"]


@bp.route("/v1/channels/<channel_id>", methods=["PATCH"])
@authorized()
async def update_channel(request: Request, channel_id: str):
    channel = await Channel.find_one(
        Channel.id == channel_id, Channel.author_id == request.ctx.user.id
    )
    if not channel:
        raise exceptions.NotFound("Channel not found")

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not await Channel.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    for key, value in data.items():
        if key in EDITABLE_FIELDS:
            setattr(channel, key, value)

    await channel.save_changes()

    publish_event(ChannelUpdated(channel=utils.dtoa(ApiChannel, channel)))

    return json(utils.dtoa(ApiChannel, channel))


@bp.route("/v1/channels/<channel_id>", methods=["DELETE"])
@authorized()
async def delete_channel(request: Request, channel_id: str):
    channel = await Channel.find_one(
        Channel.id == channel_id, Channel.author_id == request.ctx.user.id
    )
    if not channel:
        raise exceptions.NotFound("Channel not found")

    await channel.delete()

    publish_event(ChannelDeleted(channel_id=channel_id))

    await ChannelMember.find(ChannelMember.channel_id == channel_id).delete()
    await ChannelInvite.find(ChannelInvite.channel_id == channel_id).delete()

    return json(None)


@bp.route("/v1/channels/<channel_id>/leave", methods=["POST"])
@authorized()
async def leave_channel(request: Request, channel_id: str):
    member = await ChannelMember.find_one(
        ChannelMember.channel_id == channel_id,
        ChannelMember.user_id == request.ctx.user.id,
    )
    if not member:
        raise exceptions.Forbidden("You are not a member of this channel")

    channel = await Channel.find_one(Channel.id == channel_id)
    if channel.author_id == request.ctx.user.id:
        raise exceptions.Forbidden("You cannot leave your own channel")

    await member.delete()

    leave_msg = Message(
        type=MessageType.LEAVE,
        author_id=request.ctx.user.id,
        channel_id=channel_id,
    )
    await leave_msg.save()
    await request.ctx.user.fetch_status()
    publish_event(
        MessageCreated(
            message=utils.dtoa(ApiMessage, leave_msg),
            author=utils.dtoa(ApiUser, request.ctx.user),
        )
    )

    return json({"success": True})
