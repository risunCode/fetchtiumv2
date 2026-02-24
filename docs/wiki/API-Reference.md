# API Reference

Base URL examples:

- Local: `http://localhost:3000`
- Deployment: `https://your-domain`

## Available Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/extract` | Canonical extraction endpoint |
| GET | `/api/v1/status` | Service status and active platform list |
| GET | `/api/v1/stream` | Media stream proxy |
| GET | `/api/v1/download` | Download proxy with optional YouTube watch fast-path |
| GET | `/api/v1/hls-proxy` | HLS proxy for manifests/segments |
| GET | `/api/v1/hls-stream` | HLS/DASH conversion stream |
| GET | `/api/v1/merge` | Split-stream merge and optional YouTube watch mode |
| GET | `/api/v1/thumbnail` | Thumbnail proxy |
| GET | `/api/changelog` | Changelog text |
| GET | `/api/health` | Basic health check |

Unavailable in this snapshot:

- `/api/v1/events`
- `/api/extract`

## POST /api/v1/extract

Request body:

```json
{
  "url": "https://twitter.com/user/status/123",
  "cookie": "optional_cookie"
}
```

Profile-limited error example:

```json
{
  "success": false,
  "error": {
    "code": "PLATFORM_UNAVAILABLE_ON_DEPLOYMENT",
    "message": "This platform is available on Railway/Docker deployment."
  },
  "meta": {
    "responseTime": 4,
    "accessMode": "public",
    "publicContent": true
  }
}
```

## GET /api/v1/download

Accepted query params:

- `url` or `h` (standard proxy mode)
- `filename` (optional content-disposition filename)
- `watchUrl` or `sourceUrl` or `watch` (YouTube watch-url mode)
- `quality` (optional, used by watch fast-path)

YouTube fast-path behavior:

- If input is a YouTube watch/shorts URL, route attempts `yt-dlp` download + merge to MP4.
- If fast-path fails, route falls back to normal proxy streaming behavior.

## GET /api/v1/merge

Primary split-stream mode (unchanged):

- `videoUrl` + `audioUrl`
- or `videoH` + `audioH`
- optional `copyAudio=1`

Optional watch-url mode:

- `watchUrl` (also `url`/`sourceUrl`/`watch`) with optional `quality`
- only used when split inputs are not provided

## GET /api/v1/status

Returns `success`, `status`, `version`, `uptime`, `extractors`, and `meta`.

## Access Control Notes

- Middleware applies to `/api/:path*` in `src/middleware.ts`.
- Endpoints are public (no API key).
- Rate limiting and request validation are enforced at middleware/route level.
