# API Reference

Base URL examples:

- Local: `http://localhost:3000`
- Deployment: `https://your-domain`

## Core Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/extract` | Extract media metadata |
| GET | `/api/v1/status` | Service status and platform list |
| GET | `/api/v1/stream` | Stream proxy |
| GET | `/api/v1/download` | Download proxy |
| GET | `/api/v1/hls-proxy` | HLS proxy |
| GET | `/api/v1/hls-stream` | HLS/DASH progressive stream |
| GET | `/api/v1/merge` | Merge video + audio |
| GET | `/api/v1/thumbnail` | Thumbnail proxy |
| GET | `/api/v1/events` | SSE status events |
| GET | `/api/changelog` | Changelog markdown/text |
| GET | `/api/health` | Health check |

## POST /api/v1/extract

### Request

```json
{
  "url": "https://twitter.com/user/status/123",
  "cookie": "optional_cookie"
}
```

### Success (example)

```json
{
  "success": true,
  "platform": "twitter",
  "contentType": "video",
  "items": [],
  "meta": {
    "responseTime": 200,
    "accessMode": "public",
    "publicContent": true
  }
}
```

### Error (example)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "Invalid URL format"
  },
  "meta": {
    "responseTime": 5,
    "accessMode": "public",
    "publicContent": true
  }
}
```

### Deployment-Limited Error

When `EXTRACTOR_PROFILE=vercel` and URL belongs to Python platform:

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

### Important Error Codes

- `INVALID_URL`
- `UNSUPPORTED_PLATFORM`
- `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`
- `RATE_LIMITED`
- `EXTRACTION_FAILED`
- `TIMEOUT`
- `PRIVATE_CONTENT`
- `LOGIN_REQUIRED`
- `AGE_RESTRICTED`
- `DELETED_CONTENT`
- `NO_MEDIA_FOUND`

## GET /api/v1/status

Example response:

```json
{
  "success": true,
  "status": "online",
  "version": "1.5.1",
  "uptime": 1200,
  "extractors": ["facebook", "instagram", "twitter"],
  "meta": {
    "responseTime": 1,
    "accessMode": "public",
    "publicContent": true
  }
}
```

## Stream and Download Endpoints

- `/api/v1/stream` and `/api/v1/download` accept either:
  - direct `url`
  - hashed reference `h` from extraction flow

Related endpoints:

- `/api/v1/hls-proxy`
- `/api/v1/hls-stream`
- `/api/v1/merge`
- `/api/v1/thumbnail`

## Access Control Notes

Access handling is enforced in `src/middleware.ts`.

- Public routes are explicitly whitelisted.
- Other routes may require valid origin or API key depending on request context.
- Rate limiting and security checks are applied in middleware.
