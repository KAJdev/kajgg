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


MIME_TO_EXT = {
    "image/png": "png",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/bmp": "bmp",
}


def _mime_to_ext(mime_type: str) -> str:
    mime = (mime_type or "").lower().strip()
    if mime in MIME_TO_EXT:
        return MIME_TO_EXT[mime]
    # fallback: take whatever comes after image/ if it looks sane
    if mime.startswith("image/"):
        guess = mime.split("/", 1)[1]
        if guess and guess.replace("+", "").replace("-", "").replace(".", "").isalnum():
            return guess
    raise exceptions.BadRequest("Invalid image mime type")


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
    mime_type = mime_type.lower().strip()
    if not mime_type.startswith("image/"):
        raise exceptions.BadRequest("Invalid image mime type")
    if mime_type.startswith("image/svg"):
        raise exceptions.BadRequest("Invalid image mime type")

    next_ext = _mime_to_ext(mime_type)
    prev_ext = getattr(emoji, "ext", None) or ("gif" if emoji.animated else "png")

    emoji.mime_type = mime_type
    emoji.ext = next_ext
    emoji.animated = mime_type == "image/gif"

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except binascii.Error:
        raise exceptions.BadRequest("Invalid image")

    if len(image_bytes) > 1000000:
        raise exceptions.BadRequest("Image must be less than 1MB")

    # write two keys:
    # - emojis/{id} for id-only url construction
    # - emojis/{id}.{ext} for backwards compat + debugging
    key_no_ext = f"emojis/{emoji.id}"
    key_with_ext = f"emojis/{emoji.id}.{next_ext}"
    await r2.put_object_async(key_no_ext, mime_type, image_bytes)
    await r2.put_object_async(key_with_ext, mime_type, image_bytes)
    # cleanup old ext if it changed so we don’t leak r2 objects
    if prev_ext and prev_ext != next_ext:
        await r2.delete_object_async(f"emojis/{emoji.id}.{prev_ext}")


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

    emoji = Emoji(
        owner_id=request.ctx.user.id,
        name=data.get("name"),
        animated=False,
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
    ext = getattr(emoji, "ext", None) or ("gif" if emoji.animated else "png")
    # delete both keys so id-only urls don’t 404
    await r2.delete_object_async(f"emojis/{emoji.id}")
    await r2.delete_object_async(f"emojis/{emoji.id}.{ext}")
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
