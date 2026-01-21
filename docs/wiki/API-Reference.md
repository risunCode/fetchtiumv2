# API Reference

Base URL: `http://localhost:3000`

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/extract` | Extract media from URL |
| GET | `/api/v1/stream` | Stream media content |
| GET | `/api/v1/download` | Download media with filename |
| GET | `/api/v1/status` | Server status and platforms |
| GET | `/api/v1/events` | SSE status stream |
| GET | `/api/v1/hls-proxy` | Proxy HLS manifests/segments |
| GET | `/api/v1/hls-stream` | Convert HLS to progressive |
| GET | `/api/v1/merge` | Merge video + audio streams |
| GET | `/api/v1/thumbnail` | Proxy thumbnail images |
| GET | `/api/changelog` | Get changelog |
| GET | `/health` | Health check |

---

## POST /api/v1/extract

Extract media information from a URL.

### Request

```json
{
  "url": "https://twitter.com/user/status/123456789",
  "cookie": "optional_cookie_string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Media URL to extract |
| cookie | string | No | Platform cookie for private content |

### Response (Success)

```json
{
  "success": true,
  "platform": "twitter",
  "contentType": "video",
  "title": "Video Title",
  "author": "Display Name",
  "authorUsername": "username",
  "description": "Tweet text...",
  "stats": {
    "views": 1000,
    "likes": 50,
    "comments": 10
  },
  "items": [
    {
      "index": 0,
      "type": "video",
      "thumbnail": "https://...",
      "sources": [
        {
          "quality": "720p",
          "url": "https://...",
          "resolution": "1280x720",
          "mime": "video/mp4",
          "size": 10485760,
          "filename": "username_video_title_720p.mp4"
        }
      ]
    }
  ],
  "meta": {
    "responseTime": 1234,
    "accessMode": "public",
    "publicContent": true
  },
  "usedCookie": false
}
```

### Response (Error)

```json
{
  "success": false,
  "error": {
    "code": "PRIVATE_CONTENT",
    "message": "This content is private. Please provide a cookie."
  },
  "meta": {
    "responseTime": 100,
    "accessMode": "public"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_URL | 400 | Invalid URL format |
| UNSUPPORTED_PLATFORM | 400 | Platform not supported |
| PRIVATE_CONTENT | 403 | Content is private |
| LOGIN_REQUIRED | 403 | Login required |
| AGE_RESTRICTED | 403 | Age-restricted content |
| GEO_RESTRICTED | 403 | Geo-blocked content |
| DELETED_CONTENT | 404 | Content deleted |
| NO_MEDIA_FOUND | 404 | No media found |
| STORY_EXPIRED | 404 | Story has expired |
| RATE_LIMITED | 429 | Rate limited |
| EXTRACTION_FAILED | 500 | Extraction failed |
| TIMEOUT | 504 | Request timeout |

### Examples

**cURL:**
```bash
curl -X POST https://your-domain.com/api/v1/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'
```

**PowerShell:**
```powershell
$body = @{ url = "https://youtube.com/watch?v=dQw4w9WgXcQ" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://your-domain.com/api/v1/extract" -Method POST -Body $body -ContentType "application/json"
```

**JavaScript:**
```javascript
const response = await fetch('/api/v1/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' })
});
const data = await response.json();
```

---

## GET /api/v1/stream

Stream media content with range request support.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes* | Direct media URL |
| h | string | Yes* | URL hash from extract response |

*Either `url` or `h` is required.

### Headers

- Supports `Range` header for seeking
- Returns `Accept-Ranges: bytes`

### Response

Streams the media content with appropriate headers:
- `Content-Type`: Media MIME type
- `Content-Length`: File size
- `Content-Range`: For partial content (206)
- `Accept-Ranges`: bytes

---

## GET /api/v1/download

Download media with Content-Disposition header.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes* | Direct media URL |
| h | string | Yes* | URL hash |
| filename | string | No | Custom filename |

### Response

Same as stream, but with `Content-Disposition: attachment` header.

---

## GET /api/v1/status

Get server status and supported platforms.

### Response

```json
{
  "success": true,
  "status": "online",
  "version": "1.5.1",
  "uptime": 3600,
  "extractors": [
    "facebook",
    "instagram",
    "twitter",
    "tiktok",
    "pixiv",
    "youtube",
    "soundcloud",
    "bilibili",
    "twitch",
    "bandcamp",
    "reddit",
    "pinterest",
    "weibo",
    "eporner",
    "rule34video"
  ],
  "meta": {
    "responseTime": 1,
    "accessMode": "public"
  }
}
```

---

## GET /api/v1/events

Server-Sent Events for real-time status updates.

### Response

SSE stream with status events:
```
data: {"type":"status","data":{"status":"online","timestamp":1704067200000}}
```

Used by the UI to show warm/cold server indicator.

---

## GET /api/v1/hls-proxy

Proxy HLS manifests and segments for CORS-restricted streams (YouTube).

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | HLS URL |
| type | string | No | `manifest` or `segment` (auto-detected) |

### Response

- For manifests: Returns rewritten manifest with proxied segment URLs
- For segments: Streams segment content directly

---

## GET /api/v1/hls-stream

Convert HLS/DASH streams to progressive MP3/MP4 via FFmpeg.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes* | HLS/DASH URL |
| h | string | Yes* | URL hash |
| type | string | No | `audio` (default) or `video` |
| audioUrl | string | No | Separate audio URL for BiliBili |

### Response

Streams converted MP3 or MP4 content.

### Use Cases

- SoundCloud HLS (.m3u8) → MP3
- BiliBili DASH (.m4s) → MP4 (with video+audio merge)
- YouTube HLS → MP4

---

## GET /api/v1/merge

Merge separate video and audio streams via FFmpeg.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| videoUrl | string | Yes* | Video stream URL |
| audioUrl | string | Yes* | Audio stream URL |
| videoH | string | Yes* | Video URL hash |
| audioH | string | Yes* | Audio URL hash |
| filename | string | No | Output filename |

### Response

Streams merged MP4 content.

---

## GET /api/v1/thumbnail

Proxy thumbnail images to bypass hotlink protection.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | Thumbnail URL |

### Supported Platforms

- BiliBili
- YouTube
- Weibo
- Pixiv

### Response

Proxied image with appropriate headers.

---

## GET /api/changelog

Get the changelog content.

### Response

Plain text changelog content.

---

## GET /health

Health check endpoint.

### Response

```json
{
  "status": "ok",
  "timestamp": 1704067200000
}
```

---

## Authentication

Optional API key authentication via `X-API-Key` header for higher rate limits.

```bash
curl -X POST https://your-domain.com/api/v1/extract \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ftm_your_api_key_here" \
  -d '{"url": "https://..."}'
```

Configure API keys in `.env.local`:
```env
API_KEYS=ftm_key1,ftm_key2
```
