from modules.db import User
from sanic import Request, exceptions
from functools import wraps


async def authenticate(request: Request, override_token: str = None) -> User | None:
    tok = (
        override_token
        or request.headers.get("Authorization")
        or request.args.get("token")
    )

    if not tok:
        return None

    if not hasattr(User, "token"):
        # we arent initialized yet
        return None

    user = await User.find_one(User.token == tok)
    return user


def authorized():
    def decorator(f):
        @wraps(f)
        async def decorated_function(request: Request, *args, **kwargs):
            if not (user := await authenticate(request)):
                raise exceptions.Unauthorized("Unauthorized")

            request.ctx.user = user

            return await f(request, *args, **kwargs)

        return decorated_function

    return decorator
