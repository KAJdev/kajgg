from chat_types.models import (
    Channel as ApiChannel,
)
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel
from modules import utils
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import ChannelCreated, ChannelUpdated, ChannelDeleted

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

    await channel.save()

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

    return json(None)
