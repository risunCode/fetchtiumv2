# Architecture

## High-Level Design

Fetchtium uses one Next.js app with two extraction paths:

- TypeScript native extractors (inside Next.js runtime)
- Python wrapper backend (yt-dlp/gallery-dl) for wrapper platforms when available

## Public API Surface

- Canonical public extract route: `POST /api/v1/extract`

Current additional routes:

- `GET /api/v1/status`
- `GET /api/v1/stream`
- `GET /api/v1/download`
- `GET /api/v1/hls-proxy`
- `GET /api/v1/hls-stream`
- `GET /api/v1/merge`
- `GET /api/v1/thumbnail`
- `GET /api/changelog`
- `GET /api/health`

Unavailable in this snapshot:

- `GET /api/v1/events`
- `POST /api/extract`

## Extract Flow (`POST /api/v1/extract`)

1. Parse and validate request body (`url`, optional `cookie`)
2. Validate URL format
3. Detect current profile (`getExtractorProfile()`)
4. Detect whether URL is Python platform (`isPythonPlatform(url)`)
5. Gate by profile:
   - Python URL + Python disabled -> `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`
6. Validate support (`isSupported(url)`)
7. Route:
   - Native platform -> TypeScript extractor
   - Python platform -> Python service `/api/extract` (when backend reachable)
8. Attach `meta`, store proxy URLs, add filenames, return response

Reference files:

- `src/app/api/v1/extract/route.ts`
- `src/lib/config/index.ts`
- `src/lib/extractors/python-platforms.ts`
- `src/lib/extractors/index.ts`

## Profile Resolution

Implemented in `src/lib/config/index.ts`:

- Explicit override: `EXTRACTOR_PROFILE=vercel|full`
- Else auto-detect Vercel by env (`VERCEL` or `VERCEL_ENV`)
- Else fallback `full`

Helper functions:

- `getExtractorProfile()`
- `isPythonEnabledForProfile(profile)`
- `isPythonEnabled()`

## Status and Platform Exposure

`GET /api/v1/status` returns:

- uptime
- version
- `extractors` list from `getSupportedPlatforms()`

Note: `getSupportedPlatforms()` is profile-aware and only includes Python platforms when Python is enabled.

## Stream and Merge Paths

### Download Route (`GET /api/v1/download`)

- Standard mode: proxy direct media URL or URL hash (`h`).
- YouTube watch fast-path: when `watchUrl`/`sourceUrl`/`watch` points to YouTube watch/shorts URL, route runs `yt-dlp` and serves merged MP4.
- If YouTube fast-path fails, route falls back to normal proxy behavior.

### Merge Route (`GET /api/v1/merge`)

- Primary mode (preserved): split-stream merge with `videoUrl` + `audioUrl` (or `videoH` + `audioH`).
- Optional watch mode: `watchUrl`/`url`/`sourceUrl`/`watch` for YouTube when split inputs are absent.
- `copyAudio=1` attempts audio copy first and falls back to AAC transcode when needed.

## Runtime Topology (Conditional)

### Vercel

- Next.js runtime only
- Profile forced to `vercel`
- Python routes are blocked at extract route

### Railway/Docker

- Next.js runtime + Python service
- Started by `start.sh`
- Profile defaults to `full`

Key deployment files:

- `Dockerfile`
- `start.sh`
- `vercel.json`
- `railway.json`

## Snapshot Caveat

- The repo currently does not include `BringAlive/fetchtiumv2/api/`.
- Dockerfile and scripts still reference that module, so full-profile claims are conditional on restoring or externally providing Python backend code.

## Environment and Ports

- `PYTHON_SERVER_PORT` controls Python listener port.
- In development, Next.js extract route forwards to `http://127.0.0.1:5000`.
- Outside development, forwarding resolves endpoint in this order:
  1. `PYTHON_API_URL`
  2. `NEXT_PUBLIC_PYTHON_API_URL`
  3. default `http://127.0.0.1:5000`

## Error Model

Shared error utility: `src/lib/utils/error.utils.ts`

Notable code:

- `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`

All API errors should keep consistent shape with:

- `success: false`
- `error: { code, message }`
- `meta`
