import re
from typing import Iterable

from beanie.operators import In

from modules.db import Channel, ChannelMember, User


_MENTION_RE = re.compile(r"(?<![a-zA-Z0-9_-])@([a-zA-Z0-9_-]{1,32})")


def extract_mention_usernames(content: str) -> list[str]:
    # returns unique usernames in order of appearance
    if not content:
        return []

    out: list[str] = []
    seen: set[str] = set()

    for m in _MENTION_RE.finditer(content):
        username = m.group(1)
        if not username:
            continue
        if username in seen:
            continue
        seen.add(username)
        out.append(username)

    # keep it sane so nobody can spam 10k mentions
    return out[:25]


async def resolve_mentions_for_channel(
    channel: Channel, usernames: Iterable[str]
) -> list[str]:
    usernames = [u for u in usernames if u]
    if not usernames:
        return []

    users = await User.find(In(User.username, list(set(usernames)))).to_list()
    if not users:
        return []

    # private channels: only mention users who can see the channel
    if channel.private:
        members = await ChannelMember.find(
            ChannelMember.channel_id == channel.id
        ).to_list()
        allowed_ids = {channel.author_id, *[m.user_id for m in members]}
        users = [u for u in users if u.id in allowed_ids]

    by_username = {u.username: u.id for u in users if u.username}

    out: list[str] = []
    seen_ids: set[str] = set()
    for uname in usernames:
        uid = by_username.get(uname)
        if not uid or uid in seen_ids:
            continue
        seen_ids.add(uid)
        out.append(uid)

    return out
