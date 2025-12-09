from sanic import Blueprint, Request, json, exceptions
from sanic_ext import openapi
from modules.db import User
from modules import utils
from beanie.operators import Or
import bcrypt
from chat_types.models.user import User as ApiUser

bp = Blueprint("auth")


@bp.route("/v1/signup", methods=["POST"])
@openapi.exclude()
async def signup(request: Request):
    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not all(data.get(k) for k in ("username", "password", "email")):
        raise exceptions.BadRequest("Bad Request")

    data["username"] = data["username"].lower()
    data["email"] = data["email"].lower()

    # make sure username and email is unique
    if await User.find_one(User.username == data["username"]):
        raise exceptions.BadRequest("Username must be unique")

    if await User.find_one(User.email == data["email"]):
        raise exceptions.BadRequest("Email must be unique")

    hashed = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt())

    user_id = utils.generate_id()
    user = User(
        id=user_id,
        username=data["username"],
        password=hashed.decode("utf-8"),
        email=data["email"],
        token=utils.generate_token(user_id),
    )

    await user.save()
    await user.start_verification()
    return json(utils.dtoa(ApiUser, user))


@bp.route("/v1/login", methods=["POST"])
@openapi.exclude()
async def signin(request: Request):
    data = request.json
    if not data:
        raise exceptions.BadRequest("Bad Request")

    if not all(data.get(k) for k in ("username", "password")):
        raise exceptions.BadRequest("Bad Request")

    user: User = await User.find_one(
        Or(
            User.username == data["username"].lower(),
            User.email == data["username"].lower(),
        )
    )

    if not user:
        # prevent timing attacks
        bcrypt.checkpw(b"password", b"password")
        raise exceptions.Unauthorized("Unauthorized")

    if not bcrypt.checkpw(
        data["password"].encode("utf-8"), user.password.encode("utf-8")
    ):
        raise exceptions.Unauthorized("Unauthorized")

    return json(utils.dtoa(ApiUser, user))
