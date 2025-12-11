from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel, ChannelMember
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import TypingStarted

bp = Blueprint("typing")


@bp.route("/v1/channels/<channel_id>/typing", methods=["POST"])
@authorized()
async def start_typing(request: Request, channel_id: str):
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

    publish_event(TypingStarted(channel_id=channel_id, user_id=request.ctx.user.id))

    return json({"success": True})
