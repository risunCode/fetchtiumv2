# Architecture

## High-Level Design

FetchtiumV2 uses one Next.js app with two extractor execution paths:

- TypeScript native extractors (inside Next.js runtime)
- Python extractor service (yt-dlp/gallery-dl) for wrapper platforms

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
- Managed by supervisor
- Profile defaults to `full`

Key deployment files:

- `Dockerfile`
- `start.sh`
- `supervisord.conf`
- `vercel.json`
- `railway.json`

## Error Model

Shared error utility: `src/lib/utils/error.utils.ts`

Notable code:

- `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`

All API errors should keep consistent shape with:

- `success: false`
- `error: { code, message }`
- `meta`
