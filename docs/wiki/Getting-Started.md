# Getting Started

## Prerequisites

- Node.js 20+
- Python 3.10+
- pip

For full media operations:

- FFmpeg installed (or available in container runtime)

## Install

```bash
npm install
pip install -r requirements.txt
cp .env.example .env.local
```

## Run Locally

```bash
npm run dev
```

This runs:

- Next.js app on `http://localhost:3000`
- Python extractor service on `http://localhost:3001`

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

## Runtime Profiles

If `EXTRACTOR_PROFILE` is not set:

- Vercel environment -> `vercel`
- Non-Vercel environment -> `full`

Optional override:

```env
EXTRACTOR_PROFILE=vercel
```

## Useful Scripts

```bash
npm run dev
npm run dev:next
npm run dev:python
npm run build
npm start
npm run lint
```
