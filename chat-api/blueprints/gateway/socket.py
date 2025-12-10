import asyncio
from sanic import Blueprint, Request, exceptions, HTTPResponse
from sanic_ext import openapi
from chat_types.events import EventType, AuthorUpdated
from chat_types.models.author import Author as ApiAuthor
from modules.auth import authorized
from modules import events, utils
import logging

bp = Blueprint("socket")

HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@bp.route("/", methods=["GET"])
@openapi.exclude()
@authorized()
async def gateway(request: Request):
    args = request.args
    last_event_ts = args.get("last_event_ts", None)
    if last_event_ts:
        try:
            last_event_ts = int(last_event_ts)
        except ValueError:
            raise exceptions.BadRequest("Invalid last_event_ts")

    response: HTTPResponse = await request.respond(headers=HEADERS)
    await events.update_user_entitlements(request.ctx.user)

    logging.info(f"Client connected {request.ctx.user.id}")
    conn = events.GatewayConnection(user_id=request.ctx.user.id, writer=response)
    await events.add_connection(request.ctx.user.id, conn)

    if last_event_ts is not None:
        logging.info(f" ---> catching up {request.ctx.user.id} from {last_event_ts}...")
        await events.replay_events(request.ctx.user.id, conn, last_event_ts)
        logging.info(f" ---> caught up {request.ctx.user.id}")

    await events.populate_client_cache(request.ctx.user.id, conn)

    await request.ctx.user.fetch_status()
    events.publish_event(AuthorUpdated(author=utils.dtoa(ApiAuthor, request.ctx.user)))

    try:
        while True:
            await asyncio.sleep(15)
            await events._send_event(conn, {"t": EventType.HEARTBEAT.value})

    except asyncio.CancelledError:
        logging.info(f"Client disconnected {request.ctx.user.id}")
    finally:
        await events.remove_connection(request.ctx.user.id, conn)
        await request.ctx.user.fetch_status()
        events.publish_event(
            AuthorUpdated(author=utils.dtoa(ApiAuthor, request.ctx.user))
        )
