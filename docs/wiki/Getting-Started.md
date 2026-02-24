# Getting Started

## Prerequisites

- Node.js 20+
- Python 3.10+ and pip (only if you run Python wrapper backend)
- `yt-dlp` available in runtime PATH for YouTube watch-url fast-path

For full media operations:

- FFmpeg installed (or available in container runtime)

## Install

```bash
npm install
cp .env.example .env.local
```

Optional for Python wrapper backend:

```bash
pip install -r requirements.txt
```

## Run Locally

Native-only dev run (works with this snapshot as-is):

```bash
npm run dev:next
```

Full-profile wrapper mode requires a working Python `api` module/service. This snapshot does not include `BringAlive/fetchtiumv2/api/`, so `npm run dev`/`npm run dev:python` will only work if you provide that backend externally.

If you have a Python backend available, point Next.js to it:

```env
PYTHON_API_URL=http://127.0.0.1:5000
EXTRACTOR_PROFILE=full
```

Default app URL:

- `http://localhost:3000`

## Quick Test

```bash
curl -X POST http://localhost:3000/api/v1/extract \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://twitter.com/user/status/123\"}"
```

Check status:

```bash
curl http://localhost:3000/api/v1/status
curl http://localhost:3000/api/health
```

Test YouTube download fast-path (`yt-dlp` required):

```bash
curl -L "http://localhost:3000/api/v1/download?watchUrl=https://www.youtube.com/watch?v=dQw4w9WgXcQ&quality=720p" -o video.mp4
```

## Runtime Profiles

If `EXTRACTOR_PROFILE` is not set:

- Vercel environment -> `vercel`
- Non-Vercel environment -> `full`

Optional override:

```env
EXTRACTOR_PROFILE=vercel
```

Profile caveat:

- `full` profile enables Python platform routing logic, but extraction still requires reachable Python API.

## Useful Scripts

```bash
npm run dev
npm run dev:next
npm run dev:python
npm run build
npm start
npm run lint
```
