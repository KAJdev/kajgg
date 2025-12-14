from dataclasses import dataclass


@dataclass
class Embed:
    # Title of the embed
    title: str | None = None
    # Description of the embed
    description: str | None = None
    # URL to the image of the embed
    image_url: str | None = None
    # URL to the embed
    url: str | None = None
    # Footer of the embed
    footer: str | None = None
    # Color of the embed
    color: str | None = None
    # URL to the video of the embed
    video_url: str | None = None
    # URL to the audio of the embed
    audio_url: str | None = None
