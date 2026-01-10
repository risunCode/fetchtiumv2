# Changelog

All notable changes to FetchtiumV2.

---

## [1.0.0] - 2026-01-10 — Pre-Migration Release (Fastify)

### 🎉 Initial Complete Release

This is the complete Fastify-based version before migrating to Next.js.

---

### Core Architecture
- **Fastify** web framework with streaming support
- **Undici** HTTP client with connection pooling
- **Pino** structured logging system
- Environment-based configuration (.env)
- ES Modules (type: module)

### Facebook Extractor
- Full support: Videos, Reels, Stories, Posts, Galleries, Groups
- Cookie authentication (Netscape + JSON + raw string formats)
- Smart retry strategy: guest first → cookies on auth error
- Stories always use cookies (required)
- Engagement stats extraction from JSON + title fallback
- Content issue detection (age-restricted, private, deleted, expired)
- URL resolution for short links (fb.watch, fb.me)

### API Endpoints (v1)
- `POST /v1/extract` - Main extraction with cookie support
- `GET /v1/stream` - Video/audio streaming proxy (range requests)
- `GET /v1/download` - File download proxy
- `GET /v1/status` - Server status
- `GET /v1/events` - SSE real-time status updates
- `GET /health` - Health check

### Security
- **Path traversal protection** - canonical path validation, encoding bypass prevention
- **SSRF protection** - internal IPs, metadata endpoints, numeric/octal/hex IP blocking
- **XSS sanitization** - using `xss` library
- **SQL injection patterns** - defense in depth
- **CRLF/header injection** - blocked
- **Request size limit** - 1MB max
- **Rate limiting** - 100 req/min per IP
- **Security headers** - via @fastify/helmet
- **Access control** - Origin validation + API key support
- **Frontend sanitization** - backticks, template literals blocked

### Cookie System
- Priority: Client cookie → Server cookie (future) → File cookie
- Auto-detect format: JSON array, JSON object, Netscape, raw string
- `parseCookies()` universal parser
- `getFacebookCookies({ clientCookie })` with priority handling

### Response Builder
- Standardized API response format
- `meta` object: responseTime, accessMode, publicContent
- `stats` normalization for all platforms
- `buildResponse()`, `buildErrorResponse()` helpers

### Filename Generation
- Universal `addFilenames()` at route level
- Format: `author_contentType_title(25)_quality.ext`
- Unicode support (Chinese, Japanese, etc.)
- Uses `getExtensionFromMime()` helper

### Self-Registering Extractors
- Each extractor defines `static patterns` and `static match()`
- Registry auto-discovers extractors
- `url.utils.js` is platform-agnostic

### Frontend (Vanilla JS)
- Dark theme with Tailwind CSS (CDN)
- Extract form with paste button
- Result card with thumbnail, metadata, stats
- Format list with Play, Open, Download buttons
- Player modal (video/audio) using proxy stream
- Cookie modal with platform tabs (Facebook, Instagram, TikTok)
- Copy JSON button
- SSE status indicator (Warm/Cold)
- Download All with progress
- Input sanitization (XSS, command injection)

### Output Format
```json
{
  "success": true,
  "platform": "facebook",
  "contentType": "reel",
  "title": "...",
  "author": "...",
  "stats": { "views": 9700, "likes": 340 },
  "items": [{
    "index": 0,
    "type": "video",
    "thumbnail": "...",
    "sources": [{
      "quality": "hd",
      "url": "...",
      "resolution": "1280x720",
      "mime": "video/mp4",
      "size": 4493909,
      "filename": "author_reel_title_hd.mp4"
    }]
  }],
  "meta": {
    "responseTime": 2049,
    "accessMode": "public",
    "publicContent": true
  }
}
```

### Dependencies
```
fastify, @fastify/cors, @fastify/helmet, @fastify/static
undici, node-html-parser, xss, validator
pino, pino-pretty, dotenv
```

### Placeholders (Not Implemented)
- YouTube extractor
- Instagram extractor
- TikTok extractor
- Twitter/X extractor

---

## Pre-1.0.0 Development Notes

### 2026-01-10 — Session Summary
- Removed legacy `/api/*` routes (replaced by `/v1/*`)
- Created `/v1/stream` with range request support
- Added player modal for video/audio playback
- Implemented SSE for status updates (replaced polling)
- Self-registering extractors pattern
- Comprehensive security hardening
- Cookie system with client upload support
- Response builder with meta/stats
- Filename generation utility
- Stats extraction with title fallback
- Copy JSON button fix (CSP compliance)
