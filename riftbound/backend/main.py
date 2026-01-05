import asyncio
import importlib
import os
import logging
from dotenv import load_dotenv
from sanic import Sanic

from modules import cards, games

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(name)s - %(levelname)s - %(message)s")

ENVIRONMENT = os.getenv("ENV", "development")
DEBUG = os.getenv("DEBUG", None) not in (None, "False", "0")
PORT = int(os.getenv("PORT", 8001))

app = Sanic("riftbound")
app.config["REQUEST_MAX_SIZE"] = 1024 * 1024 * 10  # 10mb
app.config.CORS_ORIGINS = "*"
app.config.FALLBACK_ERROR_FORMAT = "json"


@app.after_server_start
async def startup(app, loop):
    asyncio.get_event_loop().set_debug(False)
    
    # load card data on startup
    await cards.load_cards()
    logging.info("card data loaded")
    
    # init game manager
    games.init()
    logging.info("game manager initialized")


# load blueprints from api directory
blueprints_dir = os.path.join(os.path.dirname(__file__), "blueprints", "api")
if os.path.isdir(blueprints_dir):
    for fname in os.listdir(blueprints_dir):
        if not fname.endswith(".py") or fname.startswith("_"):
            continue
        mod_name = fname[:-3]
        dotted_name = f"blueprints.api.{mod_name}"
        try:
            m = importlib.import_module(dotted_name)
            if hasattr(m, "bp"):
                app.blueprint(m.bp)
                logging.info(f"loaded blueprint: {dotted_name}")
        except Exception as e:
            logging.error(f"failed to load blueprint {dotted_name}: {e}")

# load gateway blueprint
try:
    from blueprints.gateway import socket
    app.blueprint(socket.bp)
    logging.info("loaded gateway blueprint")
except Exception as e:
    logging.error(f"failed to load gateway blueprint: {e}")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)

