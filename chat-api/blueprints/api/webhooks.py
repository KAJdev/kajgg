import logging
import re
from sanic import Blueprint, Request, json, exceptions
from sanic_ext import openapi
from modules.db import Author, Channel, Message, User, UserFlags, Webhook
from modules import utils
from modules.auth import authorized
from chat_types.models.webhook import Webhook as ApiWebhook
from chat_types.models.status import Status
from modules.events import publish_event
from chat_types.events import MessageCreated
from modules.serializers import message_to_api

bp = Blueprint("webhooks")


@bp.route("/v1/channels/<channel_id>/webhooks", methods=["GET"])
@authorized()
@openapi.exclude()
async def get_channel_webhooks(request: Request, channel_id: str):
    channel = await Channel.find_one(
        Channel.id == channel_id, Channel.author_id == request.ctx.user.id
    )
    if not channel:
        raise exceptions.NotFound("Channel not found")

    webhooks = await Webhook.find(Webhook.channel_id == channel_id).to_list()
    return json([utils.dtoa(ApiWebhook, webhook) for webhook in webhooks])


@bp.route("/v1/channels/<channel_id>/webhooks", methods=["POST"])
@authorized()
async def create_webhook(request: Request, channel_id: str):
    channel = await Channel.find_one(
        Channel.id == channel_id, Channel.author_id == request.ctx.user.id
    )
    if not channel:
        raise exceptions.NotFound("Channel not found")

    data = request.json
    if not await Webhook.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    webhook = Webhook(
        owner_id=request.ctx.user.id,
        name=data.get("name"),
        color=data.get("color", "#000000"),
        channel_id=channel_id,
    )

    await webhook.save()

    return json(utils.dtoa(ApiWebhook, webhook))


@bp.route("/v1/channels/<channel_id>/webhooks/<webhook_id>", methods=["DELETE"])
@authorized()
async def delete_webhook(request: Request, channel_id: str, webhook_id: str):
    channel = await Channel.find_one(
        Channel.id == channel_id, Channel.author_id == request.ctx.user.id
    )
    if not channel:
        raise exceptions.NotFound("Channel not found")

    webhook = await Webhook.find_one(
        Webhook.id == webhook_id, Webhook.channel_id == channel_id
    )
    if not webhook:
        raise exceptions.NotFound("Webhook not found")

    await webhook.delete()
    return json({"message": "Webhook deleted"})


@bp.route("/v1/channels/<channel_id>/webhooks/<webhook_id>", methods=["PATCH"])
@authorized()
async def update_webhook(request: Request, channel_id: str, webhook_id: str):
    channel = await Channel.find_one(
        Channel.id == channel_id, Channel.author_id == request.ctx.user.id
    )
    if not channel:
        raise exceptions.NotFound("Channel not found")

    webhook = await Webhook.find_one(
        Webhook.id == webhook_id, Webhook.channel_id == channel_id
    )
    if not webhook:
        raise exceptions.NotFound("Webhook not found")

    data = request.json

    if not await Webhook.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    if data.get("name"):
        data["name"] = data["name"].lower()
        if await Webhook.find_one(
            Webhook.name == data.get("name"), Webhook.channel_id == channel_id
        ):
            raise exceptions.BadRequest("Webhook name must be unique")
        webhook.name = data.get("name")

    if data.get("color"):
        webhook.color = data.get("color")

    await webhook.save_changes()

    return json(utils.dtoa(ApiWebhook, webhook))


def parse_github_webhook(response: Request) -> dict | None:
    if not response.headers.get("User-Agent").startswith("GitHub-Hookshot/"):
        return None

    payload = response.json
    event = response.headers.get("X-GitHub-Event")

    if event == "push":

        desc = ""

        if (added := len(payload.get("added", []))) > 0:
            desc += f"&a+{added} files added"
        if (removed := len(payload.get("removed", []))) > 0:
            desc += f"&c-{removed} files removed"
        if (modified := len(payload.get("modified", []))) > 0:
            desc += f"&e~{modified} files modified"

        desc += (
            f"\n\n{bool(desc) and '&r' or ''}{payload.get('pusher', {}).get('name')}"
        )

        return {
            "embeds": [
                {
                    "url": f"https://github.com/{payload.get('repository', {}).get('full_name')}/commit/{payload.get('after')}",
                    "title": f"{payload.get('head_commit', {}).get('message')}",
                    "description": desc,
                    "footer": f"{payload.get('repository', {}).get('full_name')} | GitHub",
                }
            ]
        }


def parse_railway_webhook(response: Request) -> dict | None:
    # railway is lame and doesnt actually give anything to go off of other than the request

    payload = response.json
    is_railway_webhook = (
        "type" in payload and "details" in payload and "resource" in payload
    )  # this is probably good enough

    if not is_railway_webhook:
        return None

    event = payload.get("type")

    if event.lower().startswith("deployment."):
        state = event.lower().split(".")[1]
        color = (
            {
                "deploying": "#f7c266",
                "deployed": "#22e08a",
                "failed": "#ff5f52",
                "removed": "#ff5f52",
                "unknown": "#8fa3b0",
            }
        ).get(state)

        service_name = payload.get("resource", {}).get("service", {}).get("name")
        author = payload.get("details", {}).get("commitAuthor", "somebody?")
        message = payload.get("details", {}).get(
            "commitMessage", "..no commit message..."
        )
        project_name = payload.get("resource", {}).get("project", {}).get("name")

        if state == "deploying":
            description = f"{service_name} is &ebeing deployed"
        elif state == "deployed":
            description = f"{service_name} was **&asuccessfully deployed**"
        elif state == "failed":
            description = f"{service_name} **&cfailed to deploy**"
        elif state == "removed":
            description = f"deployment &cremoved for **{service_name}**"

        description += f"\n\n{message} &7- pushed by **{author}**"

        return {
            "embeds": [
                {
                    "title": f"{service_name} on &dRailway",
                    "description": description,
                    "color": color,
                    "footer": f"{project_name} | {payload.get('details', {}).get('id')}",
                }
            ]
        }


@bp.route("/v1/webhooks/<channel_id>/<webhook_id>/<webhook_secret>", methods=["POST"])
async def receive_webhook(
    request: Request, channel_id: str, webhook_id: str, webhook_secret: str
):
    webhook = await Webhook.find_one(
        Webhook.id == webhook_id,
        Webhook.secret == webhook_secret,
        Webhook.channel_id == channel_id,
    )
    if not webhook:
        raise exceptions.NotFound("Webhook not found")

    logging.info(f"Webhook received: {request.json}, headers: {request.headers}")

    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if parsed := parse_github_webhook(request):
        data = parsed
    elif parsed := parse_railway_webhook(request):
        data = parsed

    if not await Message.validate_dict(data):
        raise exceptions.BadRequest("Invalid request")

    custom_author = {
        "username": data.get("username", webhook.name),
        "color": data.get("color", webhook.color),
        "background_color": data.get("background_color", None),
        "bio": data.get("bio", None),
        "avatar_url": data.get("avatar_url", None),
    }

    if not await User.validate_dict(custom_author):
        raise exceptions.BadRequest("Invalid request")

    # manually check the avatar_url
    if custom_author["avatar_url"]:
        if not re.match(r"^https?://", custom_author["avatar_url"]):
            raise exceptions.BadRequest("Invalid avatar URL")

    message = Message(
        author_id=webhook.id,
        channel_id=channel_id,
        content=data.get("content"),
        user_embeds=data.get("embeds", []),
        author=Author(
            id=webhook.id,
            username=custom_author["username"],
            avatar_url=custom_author["avatar_url"],
            bio=custom_author["bio"],
            created_at=webhook.created_at,
            updated_at=webhook.updated_at,
            status=Status.ONLINE,
            color=custom_author["color"],
            background_color=custom_author["background_color"],
            flags=UserFlags(webhook=True),
        ),
    )
    await message.save()

    payload = await message_to_api(message)

    publish_event(
        MessageCreated(
            message=payload,
        )
    )

    return json(payload)
