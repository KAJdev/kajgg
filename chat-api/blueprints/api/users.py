import re
import base64
import binascii
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
from modules import r2

bp = Blueprint("users")


def _split_data_url(base64_data: str) -> tuple[str, str]:
    if not isinstance(base64_data, str):
        raise exceptions.BadRequest("Invalid image")

    if not base64_data.startswith("data:") or ";base64," not in base64_data:
        raise exceptions.BadRequest("Invalid image")

    meta, payload = base64_data.split(",", 1)
    mime_type = meta.split(";", 1)[0].split(":", 1)[1]
    return mime_type, payload


async def _put_avatar_image(user: User, base64_data: str) -> None:
    # same vibe as emojis: accept data urls, decode, size cap, write to r2
    mime_type, payload = _split_data_url(base64_data)
    mime_type = (mime_type or "").lower().strip()

    if not mime_type.startswith("image/"):
        raise exceptions.BadRequest("Invalid image mime type")
    if mime_type.startswith("image/svg"):
        raise exceptions.BadRequest("Invalid image mime type")

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except binascii.Error:
        raise exceptions.BadRequest("Invalid image")

    if len(image_bytes) > 1000000:
        raise exceptions.BadRequest("Image must be less than 1MB")

    key = f"avatars/{user.id}"
    await r2.put_object_async(key, mime_type, image_bytes)

    # cdn serves r2 keys directly, so id-only urls are stable
    user.avatar_url = f"https://cdn.kaj.gg/avatars/{user.id}"


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


EDITABLE_FIELDS = [
    "username",
    "default_status",
    "bio",
    "email",
    "color",
    "background_color",
]


@bp.route("/v1/users/<user_id>", methods=["PATCH"])
@authorized()
async def update_user(request: Request, user_id: str):
    if user_id != "@me":
        raise exceptions.Forbidden("You can only edit your own profile")

    user = request.ctx.user

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not await User.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    before_bytes = user.self_bytes()

    for key, value in data.items():
        if key in EDITABLE_FIELDS:
            setattr(user, key, value)

    after_bytes = user.self_bytes()
    if after_bytes != before_bytes:
        user.inc_bytes(after_bytes - before_bytes)

    await user.save_changes()

    await user.fetch_status()

    publish_event(AuthorUpdated(author=utils.dtoa(ApiAuthor, user)))

    return json(utils.dtoa(ApiUser, user))


@bp.route("/v1/users/<user_id>/avatar", methods=["POST"])
@authorized()
async def upload_avatar(request: Request, user_id: str):
    if user_id != "@me":
        raise exceptions.Forbidden("You can only edit your own profile")

    user = request.ctx.user

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    image = data.get("image")
    if not image:
        raise exceptions.BadRequest("Image is required")

    await _put_avatar_image(user, image)
    await user.save_changes()
    await user.fetch_status()

    publish_event(AuthorUpdated(author=utils.dtoa(ApiAuthor, user)))
    return json(utils.dtoa(ApiUser, user))


@bp.route("/v1/users/<user_id>/avatar", methods=["DELETE"])
@authorized()
async def delete_avatar(request: Request, user_id: str):
    if user_id != "@me":
        raise exceptions.Forbidden("You can only edit your own profile")

    user = request.ctx.user

    # wipe db first so ui updates even if r2 delete fails
    user.avatar_url = None
    await user.save_changes()
    await user.fetch_status()

    try:
        await r2.delete_object_async(f"avatars/{user.id}")
    except Exception:
        pass

    publish_event(AuthorUpdated(author=utils.dtoa(ApiAuthor, user)))
    return json(utils.dtoa(ApiUser, user))
