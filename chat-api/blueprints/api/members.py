from chat_types.models import (
    Author as ApiAuthor,
)
from sanic import Blueprint, Request, json, exceptions
from modules.db import Channel, ChannelMember, User
from modules import utils
from modules.auth import authorized
from beanie.operators import In

bp = Blueprint("members")


@bp.route("/v1/channels/<channel_id>/members", methods=["GET"])
@authorized()
async def get_channel_members(request: Request, channel_id: str):
    channel = await Channel.find_one(Channel.id == channel_id)
    if not channel:
        raise exceptions.NotFound("Channel not found")

    member_ids = [
        member.user_id
        for member in await ChannelMember.find(
            ChannelMember.channel_id == channel_id
        ).to_list()
    ]
    members = await User.find(In(User.id, member_ids)).to_list()
    return json([utils.dtoa(ApiAuthor, member) for member in members])
