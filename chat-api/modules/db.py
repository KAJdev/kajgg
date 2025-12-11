import asyncio
from datetime import datetime, UTC
from chat_types.models import Status, MessageType
from dotenv import load_dotenv
from os import getenv
from modules.utils import generate_id
from modules.resend import send_verification_email
import logging
from modules.kv import get_client

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
        connections = await get_client().smembers(
            f"{getenv('ENV')}-gateway-connections:{self.id}"
        )
        self.status = self.default_status if connections else Status.OFFLINE
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

    class Settings:
        name = "users"
        use_state_management = True


class File(BaseModel):
    id: str = Field(default_factory=generate_id)
    name: str = Field(default="")
    mime_type: str = Field(default="application/octet-stream")
    size: int = Field(default=0)
    url: str = Field(default="")


class Message(Document):
    id: str = Field(default_factory=generate_id)
    type: MessageType = Field(default=MessageType.DEFAULT)
    author_id: str
    channel_id: str
    files: list[File] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    content: Optional[str] = Field(default=None)
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

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
            Message,
            Channel,
            ChannelMember,
        ],
    )
    logging.info("Connected to MongoDB")
