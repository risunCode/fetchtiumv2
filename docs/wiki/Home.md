# Fetchtium Wiki

Fetchtium is a Next.js media extraction service with profile-aware routing between native TypeScript extractors and optional Python wrapper platforms.

## Current Snapshot Notes

- Canonical extract endpoint: `POST /api/v1/extract`.
- `GET /api/v1/download` includes YouTube watch-url fast-path via `yt-dlp`.
- `GET /api/v1/merge` supports both split-stream merge and optional watch-url mode.
- This snapshot does not include a local `api/` Python module, so Python wrapper mode requires an external Python service.

## Quick Links

- [Getting Started](Getting-Started.md)
- [Configuration](Configuration.md)
- [Architecture](Architecture.md)
- [Supported Platforms](Supported-Platforms.md)
- [API Reference](API-Reference.md)
- [Deployment](Deployment.md)

## Runtime Profiles

- `vercel`: native extractors only.
- `full`: native + Python wrapper platforms when Python backend is reachable.
- Python-platform requests in non-Python profile return `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT` (HTTP 400).

## Removed/Unavailable Route Docs

The following routes are not present in this snapshot and are documented as unavailable:

- `/api/v1/events`
- `/api/extract`
