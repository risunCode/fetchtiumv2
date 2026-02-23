# Architecture

## High-Level Design

FetchtiumV2 uses one Next.js app with two extractor execution paths:

- TypeScript native extractors (inside Next.js runtime)
- Python extractor service (yt-dlp/gallery-dl) for wrapper platforms

## Public API Surface

- Canonical public extract route: `POST /api/v1/extract`
- Secondary compatibility route: `POST /api/extract` (do not treat as canonical until parity is intentionally guaranteed)

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
   - Python platform -> Python service `/api/extract`
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

Note: current `src/lib/extractors/index.ts` includes both native and Python lists in `getSupportedPlatforms()`.

## Runtime Topology

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

## Python Backend Modules

- `api/app.py`: Flask app factory
- `api/routes/extract.py`: Python extract route (`/api/extract`)
- `api/routes/health.py`: Python health route (`/api/health`)
- `api/routes/proxy.py`: Python stream/proxy route
- `api/services/ytdlp.py`: yt-dlp extraction service
- `api/services/gallery_dl.py`: gallery-dl extraction service
- `api/services/formats.py`: format normalization/processing
- `api/services/resolver.py`: URL resolution helpers
- `api/services/transforms.py`: output transformers
- `api/config.py`: constants + platform registry
- `api/security.py`: URL/cookie validation + output sanitization
- `api/errors.py`: error code detection and response helpers

## Environment and Ports

- `PYTHON_SERVER_PORT` controls Python listener port.
- Next.js -> Python forwarding in `src/app/api/v1/extract/route.ts` resolves endpoint in this order:
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
