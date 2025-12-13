from dataclasses import dataclass


@dataclass
class Flags:
    # Whether the user is an admin
    admin: bool | None = None
