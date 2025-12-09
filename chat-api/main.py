import asyncio
import importlib
from os import getenv
import os
from dotenv import load_dotenv
from sanic import Sanic

import logging
from modules import db, kv, events

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(name)s - %(levelname)s - %(message)s")

ENVIRONMENT = getenv("ENV", "staging")
MODE = getenv("MODE", "api")  # api or gateway
DEBUG = getenv("DEBUG", None) not in (None, "False", "0")

app = Sanic("app")
app.config["REQUEST_MAX_SIZE"] = (1024**3) * 5  # 5GB
app.config.CORS_ORIGINS = "*"
app.config.FALLBACK_ERROR_FORMAT = "json"
app.config.API_HOST = f"kaj.gg/{MODE.lower()}"
app.config.API_SCHEMES = ["https"]


@app.after_server_start
async def attach_db(app, loop):
    asyncio.get_event_loop().set_debug(False)

    await db.init()
    await kv.init()

    if MODE == "gateway":
        events.init()


# Compute the real filesystem path to the desired blueprints dir
blueprints_dir = os.path.join(os.path.dirname(__file__), "blueprints", MODE)
if not os.path.isdir(blueprints_dir):
    raise RuntimeError(f"Blueprints directory not found: {blueprints_dir}")

blueprint_names = []
for fname in os.listdir(blueprints_dir):
    if not fname.endswith(".py"):
        continue
    mod_name = fname[:-3]
    if mod_name.startswith("_"):
        continue
    dotted_name = f"blueprints.{MODE}.{mod_name}"
    blueprint_names.append(dotted_name)

logging.info(f"Loading blueprints: {blueprint_names}")

for extension in blueprint_names:
    # check if already loaded
    if extension in app.blueprints:
        logging.info(f"Blueprint {extension} already loaded")
        continue

    m = importlib.import_module(extension)
    if not hasattr(m, "bp"):
        logging.error(f"Blueprint {extension} does not have a 'bp' attribute")
        continue
    app.blueprint(m.bp)
    logging.info(f"Loaded blueprint: {extension}")


app.ext.openapi.describe(
    f"Chat {MODE.capitalize()}",
    "1.0.0",
    description=f"Chat {MODE.capitalize()}",
)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(getenv("PORT", 8000)), debug=DEBUG)
