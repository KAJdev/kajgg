import asyncio
from datetime import datetime, UTC
from chat_types.models import Status, MessageType
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

    async def start_verification(self):
        self.verification_code = generate_id()
        await self.save()
        await send_verification_email(self.email, self.verification_code)

    async def verify(self, code: str):
        if code == self.verification_code:
            self.verified = True
            self.verification_code = None
            await self.save()
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

    @classmethod
    async def validate_dict(cls, data: dict) -> bool:
        if data.get("content"):
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

        if not data.get("content") and not data.get("file_ids"):
            raise exceptions.BadRequest("Content or file_ids is required")

        return True

    class Settings:
        name = "messages"
        use_state_management = True

    def dict(self):
        return convert_dates_to_iso(super().model_dump(exclude={"deleted_at"}))


class Channel(Document):
    id: str = Field(default_factory=generate_id)
    name: str
    topic: str

    author_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    deleted_at: Optional[datetime] = None
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
        ],
    )
    logging.info("Connected to MongoDB")
