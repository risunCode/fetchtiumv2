# FetchtiumV2 Wiki

FetchtiumV2 is a hybrid extractor service:

- Next.js API routes and UI
- TypeScript native extractors
- Python extractor backend for yt-dlp/gallery-dl platforms

## Quick Links

- [Getting Started](Getting-Started.md)
- [Configuration](Configuration.md)
- [Architecture](Architecture.md)
- [Supported Platforms](Supported-Platforms.md)
- [API Reference](API-Reference.md)
- [Deployment](Deployment.md)

## Current Runtime Model

- `POST /api/v1/extract` routes by URL platform.
- Native platforms are always processed in TypeScript.
- Python platforms are processed only when Python is enabled by profile.
- Profile values:
  - `vercel` -> native only
  - `full` -> native + Python

If a Python-only platform is requested in `vercel` profile, API returns:

- `error.code = PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`
- HTTP status `400`

## Core Characteristics

- Consistent JSON response shape (`success`, `error`, `meta`)
- Platform-aware extraction routing
- Stream and download proxy endpoints
- HLS/DASH handling and merge endpoints
- Status endpoint with supported platform list

## Important Notes

- In this repo, deployment and access behavior are defined by code, not wiki assumptions.
- Check:
  - `src/app/api/v1/extract/route.ts`
  - `src/lib/config/index.ts`
  - `src/lib/extractors/python-platforms.ts`
  - `src/lib/extractors/index.ts`
