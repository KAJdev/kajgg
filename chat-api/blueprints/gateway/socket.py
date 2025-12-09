import asyncio
from sanic import Blueprint, Request, exceptions
from sanic_ext import openapi
from chat_types.events import EventType
from modules.auth import authorized
from modules import events
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

    response = await request.respond(headers=HEADERS)
    await events.update_user_entitlements(request.ctx.user)

    logging.info(f"Client connected {request.ctx.user.id}")
    events.add_writer(request.ctx.user.id, response)

    if last_event_ts is not None:
        logging.info(f" ---> catching up {request.ctx.user.id} from {last_event_ts}...")
        await events.replay_events(request.ctx.user.id, response, last_event_ts)
        logging.info(f" ---> caught up {request.ctx.user.id}")

    try:
        while True:
            await asyncio.sleep(15)
            await events._send_event(response, {"t": EventType.HEARTBEAT.value})

    except asyncio.CancelledError:
        logging.info(f"Client disconnected {request.ctx.user.id}")
    finally:
        events.remove_writer(request.ctx.user.id, response)

    return response
