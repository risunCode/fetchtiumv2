# FetchtiumV2

Media extraction service built with Next.js (App Router), TypeScript, and Python.

## Architecture Summary

- Native extractors (TypeScript): Facebook, Instagram, Twitter/X, TikTok, Pixiv.
- Python extractors (yt-dlp/gallery-dl): YouTube, SoundCloud, BiliBili, Twitch, Bandcamp, Reddit, Pinterest, Weibo, Eporner, Rule34Video.
- Extractor profile routing:
  - `vercel`: native extractors only.
  - `full`: native + Python extractors.
- Profile resolution:
  1. `EXTRACTOR_PROFILE` env override (`vercel` or `full`)
  2. auto-detect Vercel (`VERCEL` or `VERCEL_ENV`)
  3. fallback to `full`

## Deployment Behavior

- Vercel deploys Next.js only (`vercel.json` sets `EXTRACTOR_PROFILE=vercel`).
- Railway/Docker run Next.js + Python sidecar (`EXTRACTOR_PROFILE=full` by default).
- For Python-only platforms on `vercel`, `POST /api/v1/extract` returns:
  - `error.code: PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`
  - HTTP 400

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/extract` | Extract media from URL |
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
Python service: `http://localhost:3001`

## Environment Variables

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
API_KEYS=ftm_your_api_key_here
REQUEST_TIMEOUT=30000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
PYTHON_SERVER_PORT=3001
FLASK_DEBUG=false
```

Optional:

```env
EXTRACTOR_PROFILE=vercel
PYTHON_API_URL=http://127.0.0.1:3001
URL_ENCRYPT_KEY=your_32_char_hex
```

## Docs

- In-app docs: `/docs`
- Wiki docs: `docs/wiki/`

## License

GPL-3.0
