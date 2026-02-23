# FetchtiumV2 v2.0.0

Media extraction service built with Next.js (App Router), TypeScript, and Python.

## Architecture Summary

- Single Next.js app with profile-aware extraction routing.
- Native extractors (TypeScript): Facebook, Instagram, Twitter/X, TikTok, Pixiv.
- Python extractors (yt-dlp/gallery-dl): YouTube, SoundCloud, BiliBili, Twitch, Bandcamp, Reddit, Pinterest, Weibo, Eporner, Rule34Video.
- Canonical architecture/runtime reference: `docs/wiki/Architecture.md`.

## What's New in v2.0

- **YouTube Multi-Codec**: Returns ALL codecs (H.264, VP9, AV1) per resolution for user choice
- **Progressive Priority**: 360p H.264 with audio shown first as "READY" (no merge needed)
- **Auto-Extract**: Paste button automatically extracts when valid URL is in clipboard
- **JetBrains Mono**: All UI text now uses JetBrains Mono font
- **Clean UI**: Removed backlinks section, added DownAria banner

## Deployment Behavior

- **Vercel**: Native extractors only (TypeScript). Sets `EXTRACTOR_PROFILE=vercel` via `vercel.json`.
- **Railway/Docker**: Full profile with Python sidecar (`EXTRACTOR_PROFILE=full` by default). Python service runs on port **5000**.
- For Python-only platforms on Vercel, `POST /api/v1/extract` returns:
  - `error.code: PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`
  - HTTP 400

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/extract` | Canonical public extraction route |
| POST | `/api/extract` | Secondary compatibility route (behavior parity not guaranteed) |
| GET | `/api/v1/status` | Service status and platform list |
| GET | `/api/v1/stream` | Media stream proxy |
| GET | `/api/v1/download` | Download proxy with filename |
| GET | `/api/v1/hls-proxy` | HLS proxy |
| GET | `/api/v1/hls-stream` | HLS/DASH to progressive stream |
| GET | `/api/v1/merge` | Video/audio merge |
| GET | `/api/v1/thumbnail` | Thumbnail proxy |
| GET | `/api/v1/events` | SSE status stream |
| GET | `/api/changelog` | Changelog content |
| GET | `/api/health` | Health check |

## Response Shape

All error responses are standardized:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "Invalid URL format"
  },
  "meta": {
    "responseTime": 3,
    "accessMode": "public",
    "publicContent": true
  }
}
```

## Quick Start (Local)

```bash
npm install
pip install -r requirements.txt
cp .env.example .env.local
npm run dev
```

App: `http://localhost:3000`
Python service: `http://localhost:5000`

## Environment Variables

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
REQUEST_TIMEOUT=30000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
PYTHON_SERVER_PORT=5000
PYTHON_API_URL=http://127.0.0.1:5000
NEXT_PUBLIC_PYTHON_API_URL=http://127.0.0.1:5000
FLASK_DEBUG=false
```

Optional:

```env
EXTRACTOR_PROFILE=vercel
URL_ENCRYPT_KEY=your_32_char_hex
```

Notes:

- `PYTHON_SERVER_PORT` controls where the Python process listens.
- Next.js route forwarding for Python platforms uses `PYTHON_API_URL`, then `NEXT_PUBLIC_PYTHON_API_URL`, and defaults to `http://127.0.0.1:5000`.

## Docs

- In-app docs: `/docs`
- Wiki docs: `docs/wiki/`
- Architecture details: `docs/wiki/Architecture.md`

## License

GPL-3.0
