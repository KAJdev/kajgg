from chat_types.models import (
    Channel as ApiChannel,
)
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel
from modules import utils
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import ChannelCreated

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

    if not all(data.get(k) for k in ("name",)):
        raise exceptions.BadRequest("Bad Request")

    channel = Channel(
        name=data.get("name"),
        topic=data.get("topic", ""),
        private=data.get("private", False),
        author_id=request.ctx.user.id,
    )
    await channel.save()

    publish_event(ChannelCreated(channel=utils.dtoa(ApiChannel, channel)))

    return json(utils.dtoa(ApiChannel, channel))
