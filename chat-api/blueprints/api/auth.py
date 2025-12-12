import asyncio
from sanic import Blueprint, Request, json, exceptions
from sanic_ext import openapi
from modules.db import User, Channel, Message
from modules import utils
from beanie.operators import Or
import bcrypt
from chat_types.models.user import User as ApiUser
from chat_types.models.channel import Channel as ApiChannel
from chat_types.models.message import Message as ApiMessage
from chat_types.models.message_type import MessageType
from chat_types.events.message_created import MessageCreated
from modules.events import publish_event

bp = Blueprint("auth")

dummy_pass = bcrypt.hashpw(b"password", bcrypt.gensalt())


async def join_all_public_channels(user: User):
    channels = await Channel.find(Channel.private == False).to_list()
    for channel in channels:
        m = Message(
            type=MessageType.JOIN,
            author_id=user.id,
            channel_id=channel.id,
        )
        await m.save()
        await user.fetch_status()
        publish_event(
            MessageCreated(
                message=utils.dtoa(ApiMessage, m),
                channel=utils.dtoa(ApiChannel, channel),
                author=utils.dtoa(ApiUser, user),
            )
        )


@bp.route("/v1/signup", methods=["POST"])
@openapi.exclude()
async def signup(request: Request):
    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not all(data.get(k) for k in ("username", "password", "email")):
        raise exceptions.BadRequest("Bad Request")

    data["username"] = data["username"].lower()
    data["email"] = data["email"].lower()

    if not await User.validate_update(data):
        raise exceptions.BadRequest("Invalid request")

    hashed = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt())

    user_id = utils.generate_id()
    user = User(
        id=user_id,
        username=data["username"],
        password=hashed.decode("utf-8"),
        email=data["email"],
        token=utils.generate_token(user_id),
    )

    await user.save()
    await user.start_verification()
    await user.fetch_status()

    asyncio.create_task(join_all_public_channels(user))

    return json(utils.dtoa(ApiUser, user))


@bp.route("/v1/login", methods=["POST"])
@openapi.exclude()
async def signin(request: Request):
    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not all(data.get(k) for k in ("username", "password")):
        raise exceptions.BadRequest("Bad Request")

    user: User = await User.find_one(
        Or(
            User.username == data["username"].lower(),
            User.email == data["username"].lower(),
        )
    )

    if not user:
        bcrypt.checkpw(b"password", dummy_pass)
        raise exceptions.Unauthorized("Unauthorized")

    if not bcrypt.checkpw(
        data["password"].encode("utf-8"), user.password.encode("utf-8")
    ):
        raise exceptions.Unauthorized("Unauthorized")

    await user.fetch_status()

    return json(utils.dtoa(ApiUser, user))
