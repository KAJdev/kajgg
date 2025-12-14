import base64
import binascii
from sanic import Blueprint, Request, json, exceptions
from sanic_ext import openapi
from modules.db import User, Emoji
from modules import utils
from modules.auth import authorized
from chat_types.models.emoji import Emoji as ApiEmoji
from modules import r2

bp = Blueprint("emojis")


ANIMATED_MIME_TYPES = ["image/gif"]
NON_ANIMATED_MIME_TYPES = ["image/png"]


def _split_data_url(base64_data: str) -> tuple[str, str]:
    if not isinstance(base64_data, str):
        raise exceptions.BadRequest("Invalid image")

    if not base64_data.startswith("data:") or ";base64," not in base64_data:
        raise exceptions.BadRequest("Invalid image")

    meta, payload = base64_data.split(",", 1)
    mime_type = meta.split(";", 1)[0].split(":", 1)[1]
    return mime_type, payload


async def _put_emoji_image(emoji: Emoji, base64_data: str) -> None:
    mime_type, payload = _split_data_url(base64_data)
    if (
        mime_type not in ANIMATED_MIME_TYPES
        and mime_type not in NON_ANIMATED_MIME_TYPES
    ):
        raise exceptions.BadRequest("Invalid image mime type")
    emoji.animated = mime_type in ANIMATED_MIME_TYPES

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except binascii.Error:
        raise exceptions.BadRequest("Invalid image")

    if len(image_bytes) > 1000000:
        raise exceptions.BadRequest("Image must be less than 1MB")

    key = f"emojis/{emoji.id}.{mime_type.split('/')[1]}"
    await r2.put_object_async(key, mime_type, image_bytes)


@bp.route("/v1/users/<user_id>/emojis", methods=["GET"])
@authorized()
@openapi.exclude()
async def get_user_emojis(request: Request, user_id: str):
    user = (
        request.ctx.user
        if user_id == "@me"
        else await User.find_one(User.id == user_id)
    )
    if not user:
        raise exceptions.NotFound("User not found")

    emojis = await Emoji.find(Emoji.owner_id == user.id).to_list()
    return json(utils.dtoa(ApiEmoji, emojis))


@bp.route("/v1/users/<user_id>/emojis", methods=["POST"])
@authorized()
async def create_emoji(request: Request, user_id: str):
    if user_id != request.ctx.user.id and user_id != "@me":
        raise exceptions.Forbidden("You can only create emojis for yourself")

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if data.get("name"):
        data["name"] = data["name"].lower()

    if await Emoji.find_one(
        Emoji.owner_id == request.ctx.user.id and Emoji.name == data.get("name")
    ):
        raise exceptions.BadRequest("Emoji name must be unique")

    if not await Emoji.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    mime_type, _ = _split_data_url(data.get("image"))

    if (
        mime_type not in ANIMATED_MIME_TYPES
        and mime_type not in NON_ANIMATED_MIME_TYPES
    ):
        raise exceptions.BadRequest("Invalid image mime type")

    emoji = Emoji(
        owner_id=request.ctx.user.id,
        name=data.get("name"),
        animated=mime_type in ANIMATED_MIME_TYPES,
    )

    await _put_emoji_image(emoji, data.get("image"))
    await emoji.save()

    return json(utils.dtoa(ApiEmoji, emoji))


@bp.route("/v1/users/<user_id>/emojis/<emoji_id>", methods=["DELETE"])
@authorized()
async def delete_emoji(request: Request, user_id: str, emoji_id: str):
    if user_id != request.ctx.user.id and user_id != "@me":
        raise exceptions.Forbidden("You can only delete emojis for yourself")

    emoji = await Emoji.find_one(
        Emoji.id == emoji_id, Emoji.owner_id == request.ctx.user.id
    )
    if not emoji:
        raise exceptions.NotFound("Emoji not found")

    await emoji.delete()
    await r2.delete_object_async(
        f"emojis/{emoji.id}.{emoji.animated and 'gif' or 'png'}"
    )
    return json({"message": "Emoji deleted"})


@bp.route("/v1/users/<user_id>/emojis/<emoji_id>", methods=["PATCH"])
@authorized()
async def update_emoji(request: Request, user_id: str, emoji_id: str):
    if user_id != request.ctx.user.id and user_id != "@me":
        raise exceptions.Forbidden("You can only update emojis for yourself")

    emoji = await Emoji.find_one(
        Emoji.id == emoji_id, Emoji.owner_id == request.ctx.user.id
    )
    if not emoji:
        raise exceptions.NotFound("Emoji not found")

    data = request.json

    if not await Emoji.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    if data.get("name"):
        data["name"] = data["name"].lower()
        if await Emoji.find_one(
            Emoji.name == data.get("name"), Emoji.owner_id == request.ctx.user.id
        ):
            raise exceptions.BadRequest("Emoji name must be unique")
        emoji.name = data.get("name")

    if data.get("image"):
        await _put_emoji_image(emoji, data.get("image"))

    await emoji.save_changes()

    return json(utils.dtoa(ApiEmoji, emoji))
