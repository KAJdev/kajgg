from dataclasses import dataclass
from .author import Author


@dataclass
class User(Author):
    # Email address of the user
    email: str
    # Token for the user
    token: str | None
    # Whether the user is verified
    verified: bool | None
