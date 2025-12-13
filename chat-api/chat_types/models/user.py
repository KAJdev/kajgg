from dataclasses import dataclass
from .author import Author
from .status import Status


@dataclass
class User(Author):
    # Email address of the user
    email: str | None = None
    # Token for the user
    token: str | None = None
    # Whether the user is verified
    verified: bool | None = None
    # Default online status of the user
    default_status: Status | None = None
