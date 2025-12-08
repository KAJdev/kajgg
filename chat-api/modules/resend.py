from os import getenv
import aiohttp
from pydantic import BaseModel

ORIGIN = "https://api.resend.com"
TOKEN = getenv("RESEND_TOKEN")


class Attachment(BaseModel):
    filename: str
    content: bytes


async def request(
    method: str,
    endpoint: str,
    headers: dict = None,
    data: dict = None,
) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.request(
            method,
            f"{ORIGIN}/{endpoint}",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json",
                **(headers or {}),
            },
            json=data,
        ) as response:
            return await response.json()


async def send_email(
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    headers: dict = None,
    attachments: list[Attachment] = None,
) -> None:
    await request(
        "POST",
        "emails",
        data={
            "from": from_email,
            "to": to_email,
            "subject": subject,
            "html": body,
            "attachments": [a.model_dump() for a in (attachments or [])],
        },
        headers=headers,
    )


VERIFICATION_EMAIL = """
<!DOCTYPE html>
<html lang="en" dir="ltr" style="font-family: sans-serif;">
  <head>
    <title>Verify your account</title>
  </head>
  <body>
    <h1>Verify your email</h1>
    <p>Click the link below to verify your email address.</p>
    <a href="{url}" style="display: inline-block; padding: 6px 12px; background-color: #bf739e; color: white; text-decoration: none; border-radius: 4px; border: 2px solid rgba(255,255,255,0.2);">Verify email</a>

    <p style="margin-top: 20px;font-size: 14px">If you didn't create an account, you can safely ignore this email.</p>
  </body>
</html>
"""


async def send_verification_email(to_email: str, token: str) -> None:
    await send_email(
        "contact@kaj.gg",
        to_email,
        "Verify your account",
        VERIFICATION_EMAIL.format(url=f"https://kaj.gg/chat/verify/{token}"),
    )
