# Changelog

All notable changes to FetchtiumV2.

---

## 2026-01-10 — Initial Release

### Core
- Fastify server with streaming support
- Undici HTTP client with connection pooling
- Pino logging system
- Environment-based configuration

### Facebook Extractor
- Videos, Reels, Stories, Posts, Galleries, Groups
- Cookie authentication (Netscape + JSON format)
- Smart retry with cookies on auth errors
- Engagement stats extraction (views, likes, comments, shares)
- Content issue detection (age-restricted, private, deleted, expired)
- URL resolution for short links (fb.watch, fb.me)

### API
- `POST /api/extract` - Main extraction endpoint
- `GET /api/download` - Proxy download for CORS fallback

### Frontend
- Dark theme with Tailwind CSS
- Paste button, Settings button
- Cookie modal with platform tabs
- Download All with progress indicator
- Stats display
- Direct download first, proxy fallback strategy

### Output Format
- Clean JSON structure grouped by item
- `contentType`, `resolution`, `mime`, `filesize` per source
- `stats` object for engagement data

### Placeholders
- YouTube, Instagram, TikTok, Twitter extractors
- yt-dlp, gallery-dl extended engines
