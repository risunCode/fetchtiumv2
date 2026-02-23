# Deployment

## Supported Deployment Targets

| Target | Profile | Python Service | Notes |
| --- | --- | --- | --- |
| Vercel | `vercel` | Disabled | Native extractors only |
| Railway (Dockerfile) | `full` | Enabled | Full platform coverage |
| Docker self-hosted | `full` | Enabled | Full platform coverage |

## Vercel

Current `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["sin1"],
  "env": {
    "EXTRACTOR_PROFILE": "vercel"
  }
}
```

Expected behavior:

- Native platforms work.
- Python platforms return:
  - `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT` (HTTP 400).

## Railway

Uses Dockerfile-based deploy (`railway.json`).

- Starts with `./start.sh`
- Health check path: `/api/health`
- Runs Next.js and Python process together via `start.sh` orchestration.

Key runtime defaults:

- `EXTRACTOR_PROFILE=full`
- Python service at `127.0.0.1:5000`
- Python listener port controlled by `PYTHON_SERVER_PORT` (default `5000`)
- Next.js forwarding uses `PYTHON_API_URL` / `NEXT_PUBLIC_PYTHON_API_URL` (default `http://127.0.0.1:5000`)

## Docker

Container runtime includes:

- Node.js 20 runtime
- Python 3.12 runtime
- FFmpeg
- Shell orchestration script (`start.sh`)

Key files:

- `Dockerfile`
- `start.sh`

## Deployment Checklist

1. Set required environment values (`ALLOWED_ORIGINS`).
2. Decide profile:
   - Vercel -> `vercel`
   - Railway/Docker -> `full`
3. Confirm health check:
   - `GET /api/health`
4. Verify status endpoint:
   - `GET /api/v1/status`

## Validation Commands

```bash
curl https://your-domain/api/health
curl https://your-domain/api/v1/status
```

Test profile-limited behavior:

```bash
curl -X POST https://your-domain/api/v1/extract \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://youtube.com/watch?v=dQw4w9WgXcQ\"}"
```

In `vercel` profile this should return `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`.

Public endpoint note:

- Use `POST /api/v1/extract` as canonical public extract route.
- Keep `/api/extract` only for compatibility workflows.
