from sanic import Blueprint, Request, json, exceptions
from sanic_ext import openapi
from modules.db import User
from modules import utils
from beanie.operators import Or
import bcrypt
from chat_types.models.user import User as ApiUser
from chat_types.models.author import Author as ApiAuthor
from chat_types.models.status import Status
from modules.auth import authorized
from modules.events import publish_event
from chat_types.events.author_updated import AuthorUpdated

bp = Blueprint("users")


@bp.route("/v1/users/<user_id>", methods=["GET"])
@authorized()
async def get_user(request: Request, user_id: str):
    user = (
        request.ctx.user
        if user_id == "@me"
        else await User.find_one(User.id == user_id)
    )

    if not user:
        raise exceptions.NotFound("User not found")

    await user.fetch_status()

    if user.id == request.ctx.user.id:
        return json(utils.dtoa(ApiUser, user))

    return json(utils.dtoa(ApiAuthor, user))


@bp.route("/v1/users/<user_id>", methods=["PATCH"])
@authorized()
async def update_user(request: Request, user_id: str):
    if user_id != "@me":
        raise exceptions.Forbidden("You can only edit your own profile")

    user = request.ctx.user

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if data.get("username") and user.username != data["username"]:
        if await User.find_one(User.username == data["username"]):
            raise exceptions.BadRequest("Username must be unique")

    if data.get("default_status") and user.default_status != data["default_status"]:
        try:
            # accept enum values like "away" (not enum member names like "AWAY")
            Status(data["default_status"])
        except Exception:
            raise exceptions.BadRequest("Invalid default status")

    if data.get("bio") and user.bio != data["bio"]:
        if len(data["bio"]) > 1000:
            raise exceptions.BadRequest("Bio must be less than 1000 characters")

    for key, value in data.items():
        setattr(user, key, value)

    await user.save()

    await user.fetch_status()

    publish_event(AuthorUpdated(author=utils.dtoa(ApiAuthor, user)))

    return json(utils.dtoa(ApiUser, user))
