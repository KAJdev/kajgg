import asyncio
from os import getenv
from dotenv import load_dotenv
from sanic import Sanic

import pkgutil
from modules import db, redis

load_dotenv()

ENVIRONMENT = getenv("ENV", "staging")
DEBUG = getenv("DEBUG", None) not in (None, "False", "0")

app = Sanic("app")
app.config["REQUEST_MAX_SIZE"] = (1024**3) * 5  # 5GB
app.config.CORS_ORIGINS = "*"
app.config.FALLBACK_ERROR_FORMAT = "json"
app.config.API_HOST = "kaj.gg/api"
app.config.API_SCHEMES = ["https"]


@app.after_server_start
async def attach_db(app, loop):
    asyncio.get_event_loop().set_debug(False)

    await db.init()
    await redis.init()


blueprint_names = [
    m.name for m in pkgutil.iter_modules(["blueprints"], prefix="blueprints.")
]
print(f"Loading blueprints: {blueprint_names}")
for extension in blueprint_names:
    if extension.split(".")[-1].startswith("_"):
        continue

    # check if already loaded
    if extension in app.blueprints:
        print(f"Blueprint {extension} already loaded")
        continue

    m = __import__(extension, fromlist=["blueprints"])
    if not hasattr(m, "bp"):
        print(f"Blueprint {extension} does not have a 'bp' attribute")
        continue
    app.blueprint(m.bp)
    print(f"Loaded blueprint: {extension}")


app.ext.openapi.describe(
    "Chat API",
    "1.0.0",
    description="Chat API",
)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(getenv("PORT", 8000)), debug=DEBUG)
