## eBind Embedding Service (Sanic)

Run a Sanic HTTP service that generates multi-modal embeddings with the Encord eBind model.

### Quick start
```bash
# build + run in Docker (recommended)
docker build -t ebind-embed .
docker run --gpus all -p 8000:8000 ebind-embed

# or locally (uv installed in the base image)
uv run main.py
```

Environment vars:
- `MODEL_ID` (default `encord-team/ebind-full`)
- `PORT` (default `8000`)
- `HOST` (default `0.0.0.0`)
- `MAX_INFLIGHT` limit concurrent inferences per worker (default `2`)
- `WORKERS` Sanic workers (use `>1` only on Linux/WSL; Windows single-worker)

### Endpoints
- `GET /health` → `{ ok: bool, device: "cpu" | "cuda:0" }`
- `POST /embed` → embeddings

### Request formats
You can mix JSON and multipart. At least one modality must be provided.

**JSON body**
```json
{
  "image_urls": ["https://host/dog.png", "data:image/png;base64,..."],
  "video_urls": ["https://host/dog.mp4"],
  "audio_urls": ["https://host/dog.wav"],
  "points_urls": ["https://host/dog_point_cloud.npy"],
  "text": ["a dog is howling", "a cat is sleeping"],
  "text_file_paths": false
}
```

**Multipart example (files + optional JSON payload field)**
```
curl -X POST http://localhost:8000/embed \
  -F "image=@examples/dog.png" \
  -F "video=@examples/dog.mp4" \
  -F "text=A dog is howling"
```

**Base64 / data URIs in JSON**
- `image_b64`, `video_b64`, `audio_b64`, `points_b64`: lists of base64 (or data URI) strings.

### Response shape
```json
{
  "embeddings": {
    "image": [[...], [...]],
    "video": [[...]],
    "audio": [[...]],
    "text": [[...]]
  }
}
```

Use the returned vectors for cosine similarity search (already returned as standard float arrays).

