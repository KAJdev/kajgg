import asyncio
from datetime import datetime, UTC
from chat_types.models import Status, MessageType, Embed as ApiEmbed
from dotenv import load_dotenv
from os import getenv
from modules.utils import generate_id
from modules.resend import send_verification_email
import logging
from modules.kv import get_client
import re
from sanic import exceptions

load_dotenv()

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from beanie import Document, init_beanie
from beanie.operators import In, Or

client = None


def convert_dates_to_iso(d):
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat() + "Z"
    return d


def normalize_title(title: str):
    for c in " -'[]()!?,.\"":
        title = title.replace(c, "")
    return title.lower()


class UserFlags(BaseModel):
    admin: bool = False


class User(Document):
    id: str = Field(default_factory=generate_id)
    username: str
    password: str
    token: str

    # default status when a user is connected to the gateway
    default_status: Status = Field(default=Status.ONLINE)
    color: Optional[str] = Field(default=None)
    background_color: Optional[str] = Field(default=None)

    # current status of the user
    status: Optional[Status] = Field(default=None)

    email: str
    avatar_url: Optional[str] = Field(default=None)
    bio: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    flags: UserFlags = Field(default_factory=UserFlags)
    verified: bool = Field(default=False)
    verification_code: Optional[str] = Field(default=None)
    bytes: int = Field(default=0)

    def dict(self, keep_token: bool = False):
        d = super().model_dump(
            exclude={
                "password",
                "verification_code",
                *({"token"} if not keep_token else {}),
            }
        )
        return convert_dates_to_iso(d)

    async def fetch_status(self):
        # v2: zset member=conn id, score=last seen ms
        key = f"{getenv('ENV')}-gateway-connections-v2:{self.id}"
        stale_sec = int(getenv("GATEWAY_CONN_STALE_SEC", "600"))
        cutoff = int(datetime.now(UTC).timestamp() * 1000) - (stale_sec * 1000)

        # clean up stale conns so users don't get stuck "online" forever
        await get_client().zremrangebyscore(key, 0, cutoff)
        count = await get_client().zcard(key)

        self.status = (
            self.default_status if count and int(count) > 0 else Status.OFFLINE
        )
        return self.status

    def inc_bytes(self, amount: int):
        self.bytes += amount

        async def _inc_bytes():
            await User.find_one(User.id == self.id).update({"$inc": {"bytes": amount}})

        asyncio.create_task(_inc_bytes())

    def self_bytes(self) -> int:
        return (
            len(self.username)
            + len(self.id)
            + len(self.bio or "")
            + len(self.background_color or "")
            + len(self.color or "")
        )

    async def start_verification(self):
        self.verification_code = generate_id()
        await self.save_changes()
        await send_verification_email(self.email, self.verification_code)

    async def verify(self, code: str):
        if code == self.verification_code:
            self.verified = True
            self.verification_code = None
            await self.save_changes()
            return True
        return False

    @classmethod
    async def validate_dict(cls, data: dict) -> bool:
        if data.get("username"):
            if await User.find_one(User.username == data["username"]):
                raise exceptions.BadRequest("Username must be unique")

            if len(data["username"]) < 3 or len(data["username"]) > 32:
                raise exceptions.BadRequest(
                    "Username must be between 3 and 32 characters"
                )

            if not re.match(r"^[a-zA-Z0-9_-]+$", data["username"]):
                raise exceptions.BadRequest(
                    "Username must only contain letters, numbers, underscores, and hyphens"
                )

        if data.get("default_status"):
            try:
                # accept enum values like "away" (not enum member names like "AWAY")
                Status(data["default_status"])
            except Exception:
                raise exceptions.BadRequest("Invalid default status")

        if data.get("bio"):
            if len(data["bio"]) > 1000:
                raise exceptions.BadRequest("Bio must be less than 1000 characters")

        if data.get("email"):
            if await User.find_one(User.email == data["email"]):
                raise exceptions.BadRequest("Email must be unique")

            if not re.match(
                r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", data["email"]
            ):
                raise exceptions.BadRequest("Invalid email address")

        if data.get("color"):
            if not re.match(r"^#([0-9a-fA-F]{6})$", data["color"]):
                raise exceptions.BadRequest("Invalid color")

        if data.get("background_color"):
            if not re.match(r"^#([0-9a-fA-F]{6})$", data["background_color"]):
                raise exceptions.BadRequest("Invalid background color")

        return True

    class Settings:
        name = "users"
        use_state_management = True


class StoredFile(Document):
    id: str = Field(default_factory=generate_id)
    owner_id: str
    name: str = Field(default="")
    mime_type: str = Field(default="application/octet-stream")
    size: int = Field(default=0)
    key: str
    url: str = Field(default="")
    uploaded: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    uploaded_at: Optional[datetime] = None

    @classmethod
    async def validate_dict(cls, data: dict) -> bool:
        if data.get("name"):
            if len(data["name"]) > 200:
                raise exceptions.BadRequest("Name must be less than 200 characters")

        return True

    class Settings:
        name = "files"
        use_state_management = True


class Embed(BaseModel):
    title: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None)
    url: Optional[str] = Field(default=None)
    footer: Optional[str] = Field(default=None)
    color: Optional[str] = Field(default=None)


class Message(Document):
    id: str = Field(default_factory=generate_id)
    type: MessageType = Field(default=MessageType.DEFAULT)
    author_id: str
    channel_id: str
    file_ids: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    content: Optional[str] = Field(default=None)
    nonce: Optional[str] = Field(default=None)
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    user_embeds: list[Embed] = Field(default_factory=list)
    system_embeds: list[Embed] = Field(default_factory=list)

    @property
    def embeds(self) -> list[Embed]:
        return self.user_embeds + self.system_embeds

    @classmethod
    async def validate_dict(cls, data: dict) -> bool:
        if data.get("embeds"):
            if not isinstance(data["embeds"], list) or not all(
                isinstance(x, dict) for x in data["embeds"]
            ):
                raise exceptions.BadRequest("Bad Request")
            if len(data["embeds"]) > 10:
                raise exceptions.BadRequest(
                    "You can only upload up to 10 embeds at a time"
                )

            for embed in data["embeds"]:
                if len(embed.get("title", "")) > 256:
                    raise exceptions.BadRequest(
                        "Title must be less than 256 characters"
                    )
                if len(embed.get("description", "")) > 4096:
                    raise exceptions.BadRequest(
                        "Description must be less than 4096 characters"
                    )
                if len(embed.get("footer", "")) > 256:
                    raise exceptions.BadRequest(
                        "Footer must be less than 256 characters"
                    )
                if len(embed.get("color", "")) != 7 or not re.match(
                    r"^#([0-9a-fA-F]{6})$", embed["color"]
                ):
                    raise exceptions.BadRequest("Invalid color")
                if embed.get("image_url") and not re.match(
                    r"^https?://[^\s]+$", embed["image_url"]
                ):
                    raise exceptions.BadRequest("Invalid image URL")
                if embed.get("url") and not re.match(
                    r"^https?://[^\s]+$", embed["url"]
                ):
                    raise exceptions.BadRequest("Invalid URL")

        if data.get("content"):
            data["content"] = data["content"].strip()
            if len(data["content"]) < 1:
                raise exceptions.BadRequest("Content must be at least 1 character")
            if len(data["content"]) > 4000:
                raise exceptions.BadRequest("Content must be less than 1000 characters")

        if data.get("file_ids"):
            if not isinstance(data["file_ids"], list) or not all(
                isinstance(x, str) for x in data["file_ids"]
            ):
                raise exceptions.BadRequest("Bad Request")
            if len(data["file_ids"]) > 10:
                raise exceptions.BadRequest(
                    "You can only upload up to 10 files at a time"
                )

        if data.get("nonce"):
            if not isinstance(data["nonce"], str):
                raise exceptions.BadRequest("Bad Request")
            if len(data["nonce"]) > 100:
                raise exceptions.BadRequest("Nonce must be less than 100 characters")

        if (
            not data.get("content")
            and not data.get("file_ids")
            and not data.get("embeds")
        ):
            raise exceptions.BadRequest("content, file_ids, or embeds is required")

        return True

    class Settings:
        name = "messages"
        use_state_management = True


class Emoji(Document):
    id: str = Field(default_factory=generate_id)
    owner_id: str
    name: str
    animated: bool
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    @classmethod
    async def validate_dict(cls, data: dict) -> bool:
        if data.get("name"):
            if len(data["name"]) < 3 or len(data["name"]) > 32:
                raise exceptions.BadRequest("Name must be between 3 and 32 characters")
            if not re.match(r"^[a-zA-Z0-9_-]+$", data["name"]):
                raise exceptions.BadRequest(
                    "Name must only contain letters, numbers, underscores, and hyphens"
                )

        if data.get("image"):
            if not re.match(r"^data:image/(png|gif);base64,", data["image"]):
                raise exceptions.BadRequest("Invalid image")

            payload = data["image"].split(",", 1)[1]
            padding = payload.count("=")
            approx_bytes = (len(payload) * 3) // 4 - padding
            if approx_bytes > 1000000:
                raise exceptions.BadRequest("Image must be less than 1MB")

        if not data.get("name") or not data.get("image"):
            raise exceptions.BadRequest("Name and image are required")

        return True

    @property
    def url(self) -> str:
        return f"https://cdn.kaj.gg/emojis/{self.id}.{self.animated and 'gif' or 'png'}"

    class Settings:
        name = "emojis"
        use_state_management = True


class Channel(Document):
    id: str = Field(default_factory=generate_id)
    name: str
    topic: str

    author_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    deleted_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    private: bool = False

    @classmethod
    async def get_user_channels(cls, user_id: str):
        public_channels = cls.find(Or(cls.private == False, cls.author_id == user_id))

        memberships = ChannelMember.find(ChannelMember.user_id == user_id)

        public_channels, memberships = await asyncio.gather(
            public_channels.to_list(),
            memberships.to_list(),
        )

        member_channel_ids = {cm.channel_id for cm in memberships}

        private_channels = []
        if member_channel_ids:
            private_channels = await cls.find(
                In(cls.id, list(member_channel_ids)), cls.private == True
            ).to_list()

        channels = {channel.id: channel for channel in public_channels}
        for channel in private_channels:
            channels[channel.id] = channel

        return list(channels.values())

    @classmethod
    async def validate_dict(cls, data: dict) -> bool:
        if data.get("name"):
            if len(data["name"]) < 3 or len(data["name"]) > 32:
                raise exceptions.BadRequest("Name must be between 3 and 32 characters")

            if not re.match(r"^[a-zA-Z0-9_-]+$", data["name"]):
                raise exceptions.BadRequest(
                    "Name must only contain letters, numbers, underscores, and hyphens"
                )

        if data.get("topic"):
            if len(data["topic"]) > 1000:
                raise exceptions.BadRequest("Topic must be less than 1000 characters")

        return True

    class Settings:
        name = "channels"
        use_state_management = True

    def dict(self):
        return convert_dates_to_iso(super().model_dump(exclude={"deleted_at"}))


class ChannelMember(Document):
    id: str = Field(default_factory=generate_id)
    channel_id: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "channel_members"
        use_state_management = True


async def init():
    global client
    client = AsyncIOMotorClient(getenv("MONGO_URL"))
    await init_beanie(
        database=client[getenv("ENV")],
        document_models=[
            User,
            StoredFile,
            Message,
            Channel,
            ChannelMember,
            Emoji,
        ],
    )
    logging.info("Connected to MongoDB")
