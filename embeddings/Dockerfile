# Force linux/amd64 because torchcodec wheels are only built for x86_64 on Linux
ARG UV_BASE_PLATFORM=linux/amd64
FROM --platform=${UV_BASE_PLATFORM} ghcr.io/astral-sh/uv:python3.11-bookworm

WORKDIR /app

# Install ffmpeg for the current architecture (avoids cross-platform COPY issues)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen

COPY . .

CMD ["uv", "run", "main.py"]