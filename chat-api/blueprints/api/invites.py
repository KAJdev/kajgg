from datetime import datetime
from chat_types.models import (
    Message as ApiMessage,
    MessageType,
    User as ApiUser,
    ChannelInvite as ApiChannelInvite,
)
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel, ChannelMember, ChannelInvite, Message
from modules import utils
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events import MessageCreated

bp = Blueprint("invites")


@bp.route("/v1/channels/<channel_id>/invites", methods=["GET"])
@authorized()
async def get_invites(request: Request, channel_id: str):
    channel = await Channel.find_one(Channel.id == channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    if channel.author_id != request.ctx.user.id and not request.ctx.user.flags.admin:
        raise exceptions.Forbidden("You are not the author of this channel")

    invites = await ChannelInvite.find(ChannelInvite.channel_id == channel_id).to_list()
    return json([utils.dtoa(ApiChannelInvite, invite) for invite in invites])


@bp.route("/v1/channels/<channel_id>/invites", methods=["POST"])
@authorized()
async def create_invite(request: Request, channel_id: str):
    channel = await Channel.find_one(Channel.id == channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    if channel.author_id != request.ctx.user.id and not request.ctx.user.flags.admin:
        raise exceptions.Forbidden("You are not the author of this channel")

    data = request.json

    if not await ChannelInvite.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    invite = ChannelInvite(
        channel_id=channel_id,
        author_id=request.ctx.user.id,
        expires_at=data.get("expires_at"),
        uses_left=data.get("uses_left"),
    )
    await invite.save()
    return json(utils.dtoa(ApiChannelInvite, invite))


@bp.route("/v1/invites/<code>/join", methods=["POST"])
@authorized()
async def create_channel_member(request: Request, code: str):
    """
    Adds an author to a channel
    """
    if not code:
        raise exceptions.BadRequest("Code is required")

    invite = await ChannelInvite.find_one(ChannelInvite.code == code)
    if not invite:
        raise exceptions.NotFound("Invite not found")

    if invite.expires_at and invite.expires_at < datetime.now():
        raise exceptions.Gone("Invite has expired")

    if invite.max_uses is not None and invite.uses >= invite.max_uses:
        raise exceptions.Gone("Invite has no uses left")

    await ChannelInvite.find_one(
        ChannelInvite.id == invite.id,
    ).update(
        {
            "$inc": {
                "uses": 1,
            },
        }
    )

    member = ChannelMember(
        channel_id=invite.channel_id,
        user_id=request.ctx.user.id,
        invite_id=invite.id,
    )
    await member.save()

    join_msg = Message(
        type=MessageType.JOIN,
        author_id=request.ctx.user.id,
        channel_id=invite.channel_id,
    )
    await join_msg.save()
    await request.ctx.user.fetch_status()
    publish_event(
        MessageCreated(
            message=utils.dtoa(ApiMessage, join_msg),
            author=utils.dtoa(ApiUser, request.ctx.user),
        )
    )

    return json({"success": True})


@bp.route("/v1/channels/<channel_id>/invites/<invite_id>", methods=["DELETE"])
@authorized()
async def delete_invite(request: Request, channel_id: str, invite_id: str):
    invite = await ChannelInvite.find_one(
        ChannelInvite.id == invite_id, ChannelInvite.channel_id == channel_id
    )
    if not invite:
        raise exceptions.NotFound("Invite not found")

    channel = await Channel.find_one(Channel.id == invite.channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    if (
        invite.author_id != request.ctx.user.id
        and not request.ctx.user.flags.admin
        and channel.author_id != request.ctx.user.id
    ):
        raise exceptions.Forbidden("You cannot delete this invite")

    await invite.delete()

    return json({"success": True})
