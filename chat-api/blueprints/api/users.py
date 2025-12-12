import re
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


EDITABLE_FIELDS = ["username", "default_status", "bio", "email"]


@bp.route("/v1/users/<user_id>", methods=["PATCH"])
@authorized()
async def update_user(request: Request, user_id: str):
    if user_id != "@me":
        raise exceptions.Forbidden("You can only edit your own profile")

    user = request.ctx.user

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not await User.validate_update(data):
        raise exceptions.BadRequest("Invalid request")

    for key, value in data.items():
        if key in EDITABLE_FIELDS:
            setattr(user, key, value)

    await user.save()

    await user.fetch_status()

    publish_event(AuthorUpdated(author=utils.dtoa(ApiAuthor, user)))

    return json(utils.dtoa(ApiUser, user))
