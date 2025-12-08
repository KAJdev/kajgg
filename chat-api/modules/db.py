from datetime import datetime, UTC
from types.models import Status
from dotenv import load_dotenv
from os import getenv
from modules.utils import print, generate_id
from modules.resend import send_verification_email

load_dotenv()

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from beanie import Document, init_beanie

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
    status: Status
    email: Optional[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
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


class Message(Document):
    id: str = Field(default_factory=generate_id)
    author_id: str
    channel_id: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
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
    print("Connected to MongoDB", important=True)
