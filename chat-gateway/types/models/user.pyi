from dataclasses import dataclass
from .author import Author


@dataclass
class User(Author):
    # Email address of the user
    email: str
