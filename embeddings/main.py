"""
Sanic inference service for Encord eBind embeddings.

Features
- Handles image, video, audio, point cloud, and text inputs.
- Offloads blocking torch inference to a thread pool to keep the event loop responsive.
- Limits in-flight GPU jobs with an asyncio semaphore for predictable concurrency.
- Returns raw embeddings only; pairwise similarity is intentionally omitted.

Run locally:
    uv run main.py

Env vars:
    MODEL_ID=encord-team/ebind-full
    HOST=0.0.0.0
    PORT=8000
    WORKERS=1              # >1 when using uvicorn/gunicorn style; Sanic workers not on Windows
    MAX_INFLIGHT=2         # concurrent inference per worker
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import tempfile
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Tuple

import torch
from sanic import Sanic, response
from sanic.log import logger
from sanic.request import File, Request

from ebind import EBindModel, EBindProcessor

MODEL_ID = os.getenv("MODEL_ID", "encord-team/ebind-full")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
MAX_INFLIGHT = int(os.getenv("MAX_INFLIGHT", "2"))

app = Sanic("ebind-embeddings")
app.ctx.model = None
app.ctx.processor = None
app.ctx.device = None
app.ctx.inflight = asyncio.Semaphore(MAX_INFLIGHT)


def _decode_base64_to_temp(data: str, suffix: str) -> str:
    """Decode base64 data URI or raw base64 string to a temp file path."""
    if data.startswith("data:"):
        _, encoded = data.split(",", 1)
    else:
        encoded = data
    blob = base64.b64decode(encoded)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(blob)
    tmp.flush()
    tmp.close()
    return tmp.name


def _load_payload(request: Request) -> Dict[str, Any]:
    """Extract JSON payload from request."""
    if request.json:
        return request.json
    if request.form and "payload" in request.form:
        try:
            return json.loads(request.form.get("payload"))
        except json.JSONDecodeError:
            raise ValueError("payload form field must be valid JSON")
    return {}


def _add_text(inputs: Dict[str, List[Any]], payload: Dict[str, Any], request: Request):
    """Populate text inputs from JSON or form fields."""
    if "text" in payload:
        texts = payload.get("text") or []
        if not isinstance(texts, list):
            raise ValueError("text must be a list")
        inputs["text"] = [str(t) for t in texts]
    if request.form and "text" in request.form:
        inputs.setdefault("text", []).append(request.form.get("text"))


def _add_files_for_modality(
    modality: str,
    inputs: Dict[str, List[Any]],
    request: Request,
    temp_paths: List[Path],
):
    """Handle multipart uploads."""
    files: List[File] = request.files.get(modality, []) if request.files else []
    if not files:
        return
    inputs.setdefault(modality, [])
    default_suffix = {
        "image": ".png",
        "video": ".mp4",
        "audio": ".wav",
        "points": ".npy",
    }[modality]
    for f in files:
        suffix = Path(f.name or "").suffix or default_suffix
        tmp_path = Path(tempfile.NamedTemporaryFile(delete=False, suffix=suffix).name)
        tmp_path.write_bytes(f.body)
        temp_paths.append(tmp_path)
        inputs[modality].append(str(tmp_path))


def _add_base64_for_modality(
    modality: str,
    inputs: Dict[str, List[Any]],
    payload: Dict[str, Any],
    temp_paths: List[Path],
):
    """Handle *_b64 lists in JSON payload."""
    key = f"{modality}_b64"
    if key not in payload:
        return
    blobs = payload.get(key) or []
    if not isinstance(blobs, list):
        raise ValueError(f"{key} must be a list")
    inputs.setdefault(modality, [])
    suffix = {
        "image": ".png",
        "video": ".mp4",
        "audio": ".wav",
        "points": ".npy",
    }[modality]
    for b64 in blobs:
        tmp_path = Path(_decode_base64_to_temp(str(b64), suffix))
        temp_paths.append(tmp_path)
        inputs[modality].append(str(tmp_path))


def _fetch_uri_to_temp_sync(uri: str, suffix: str) -> str:
    """Download a URI to a temp file (blocking)."""
    with urllib.request.urlopen(uri, timeout=30) as resp:
        data = resp.read()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.flush()
    tmp.close()
    return tmp.name


async def _add_uris_for_modality(
    modality: str,
    inputs: Dict[str, List[Any]],
    payload: Dict[str, Any],
    temp_paths: List[Path],
):
    """Handle direct URIs or data URIs in payload (fields: modality or modality_urls)."""
    raw_list: List[str] = []
    for key in (modality, f"{modality}_urls"):
        if key in payload:
            vals = payload.get(key) or []
            if not isinstance(vals, list):
                raise ValueError(f"{key} must be a list")
            raw_list.extend([str(v) for v in vals])
    if not raw_list:
        return

    inputs.setdefault(modality, [])
    suffix = {
        "image": ".png",
        "video": ".mp4",
        "audio": ".wav",
        "points": ".npy",
    }[modality]

    tasks = []
    for uri in raw_list:
        if uri.startswith("data:"):
            tasks.append(asyncio.to_thread(_decode_base64_to_temp, uri, suffix))
        else:
            tasks.append(asyncio.to_thread(_fetch_uri_to_temp_sync, uri, suffix))

    results = await asyncio.gather(*tasks)
    for path in results:
        temp_paths.append(Path(path))
        inputs[modality].append(str(path))


async def _collect_inputs(request: Request) -> Tuple[Dict[str, List[str]], List[Path]]:
    """
    Gather modality inputs from JSON body or multipart files.

    Returns:
        inputs: dict keyed by modality with file paths or raw text strings.
        temp_paths: list of temp files to clean up after inference.
    """
    inputs: Dict[str, List[Any]] = {}
    temp_paths: List[Path] = []

    payload = _load_payload(request)
    _add_text(inputs, payload, request)

    for modality in ("image", "video", "audio", "points"):
        _add_files_for_modality(modality, inputs, request, temp_paths)
        await _add_uris_for_modality(modality, inputs, payload, temp_paths)
        _add_base64_for_modality(modality, inputs, payload, temp_paths)

    if not inputs:
        raise ValueError("Provide at least one of image/video/audio/points/text")

    return inputs, temp_paths


def _move_batch_to_device(
    batch: Dict[str, Any], device: torch.device
) -> Dict[str, Any]:
    moved: Dict[str, Any] = {}
    for k, v in batch.items():
        if torch.is_tensor(v):
            moved[k] = v.to(device)
        elif isinstance(v, dict):
            moved[k] = _move_batch_to_device(v, device)
        else:
            moved[k] = v
    return moved


def _run_inference(
    inputs: Dict[str, Any],
    text_file_paths: bool,
    app_ctx,
) -> Dict[str, Any]:
    """Synchronous inference body to be run in a thread."""
    processor: EBindProcessor = app_ctx.processor
    model: EBindModel = app_ctx.model
    device: torch.device = app_ctx.device

    with torch.inference_mode():
        batch = processor(inputs, return_tensors="pt", text_file_paths=text_file_paths)
        batch = _move_batch_to_device(batch, device)
        outputs = model.forward(**batch)

    tensors = {k: v.detach().to("cpu") for k, v in outputs.items()}
    return {"embeddings": {k: v.tolist() for k, v in tensors.items()}}


@app.listener("before_server_start")
async def load_model(app: Sanic, _loop):
    logger.info("Loading model %s ...", MODEL_ID)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = EBindModel.from_pretrained(MODEL_ID)
    processor = EBindProcessor.from_pretrained(MODEL_ID)
    model = model.to(device).eval()
    processor = processor.to(device)

    app.ctx.model = model
    app.ctx.processor = processor
    app.ctx.device = device
    logger.info("Model loaded on %s", device)


@app.get("/health")
async def health(_request: Request):
    status = (
        app.ctx.model is not None
        and app.ctx.processor is not None
        and app.ctx.device is not None
    )
    return response.json({"ok": bool(status), "device": str(app.ctx.device)})


@app.post("/embed")
async def embed(request: Request):
    def _flag(key: str) -> bool:
        if key in request.args:
            return bool(request.args.get(key))
        if request.json:
            return bool(request.json.get(key))
        return False

    text_file_paths = _flag("text_file_paths")

    try:
        inputs, temp_paths = await _collect_inputs(request)
    except ValueError as err:
        return response.json({"error": str(err)}, status=400)

    try:
        async with app.ctx.inflight:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                None,
                _run_inference,
                inputs,
                text_file_paths,
                app.ctx,
            )
        return response.json(result)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Inference failed")
        return response.json({"error": str(exc)}, status=500)
    finally:
        for p in temp_paths:
            try:
                Path(p).unlink(missing_ok=True)
            except OSError:
                pass


if __name__ == "__main__":
    # Note: Sanic worker >1 is unsupported on Windows; use container for scaling.
    app.run(host=HOST, port=PORT, workers=int(os.getenv("WORKERS", "1")))
