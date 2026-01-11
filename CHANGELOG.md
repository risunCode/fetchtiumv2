# Changelog

All notable changes to FetchtiumV2.

---

## [1.4.0] - 2026-01-11 — Twitter, Instagram Stories, Pinterest Video, YouTube HLS

### 🚀 What's New

- **Twitter/X Cookie Support** - Fixed Netscape cookie format parsing with `netscapeToCookieHeader()` converter
- **Twitter TweetWithVisibilityResults** - Handle GraphQL wrapper for tweets with visibility restrictions
- **Instagram Stories** - Full support via Internal API, fetches all story items as carousel
- **Instagram Reels URL** - Support `/reels/` (plural) in addition to `/reel/`
- **Pinterest Video** - Extract MP4 sources from video pins (V_720P, V_HLSV4 fallback)
- **YouTube HLS Proxy** - True streaming playback via HLS.js instead of full download
- **YouTube HLS Download** - FFmpeg routes through proxy for proper segment fetching

### 🔧 Technical Changes

- **New Endpoint** - `/api/v1/hls-proxy` proxies HLS manifest and segments on-demand
- **Thumbnail Endpoint** - Changed from hash-based (`?h=`) to direct URL (`?url=`) for easier API usage
- **CookieModal** - Added `netscapeToCookieHeader()` to convert Netscape format to HTTP Cookie header
- **Twitter extract.ts** - Unwrap `TweetWithVisibilityResults` to get actual tweet from `result.tweet`
- **Instagram scanner.ts** - Added `fetchStory()`, `fetchStoryByUsername()` functions
- **Instagram extract.ts** - Added `parseStoryResponse()`, handle `reels[userId]` response structure
- **Instagram patterns** - Added `XDTGraphSidecar`, `XDTGraphImage`, `XDTGraphVideo` typename checks
- **api/extract.py** - `transform_pinterest_result()` handles video pins with `contentType: 'video'`
- **PlayerModal** - Split `needsHlsStream` into `needsHlsTranscode` (Opus) and `needsHlsProxy` (YouTube)
- **hls-stream route** - Detects YouTube HLS and routes through proxy for FFmpeg download
- **middleware.ts** - Added `/api/v1/hls-proxy` to public routes and streaming endpoint checks

### 🐛 Fixes

- **Twitter Cookies** - Fixed cookie parsing not working with Netscape export format
- **Twitter Visibility** - Fixed extraction failing on tweets wrapped in TweetWithVisibilityResults
- **Instagram Stories** - Fixed "reels_media[0] undefined" error - API returns `reels[userId]` not `reels_media`
- **Instagram Carousel** - Fixed typename check missing XDT-prefixed types from Internal API
- **YouTube HLS Play** - Fixed video downloading entire stream before playing (now true streaming)
- **YouTube HLS Download** - Fixed 403 errors by adding `Sec-Fetch-*` headers to proxy requests

### 📦 New Files

```
src/app/api/v1/hls-proxy/route.ts  # HLS proxy for CORS-restricted streams
```

---

## [1.3.0] - 2026-01-11 — Extract.py Cleanup + API Docs + UI Polish

### 🚀 What's New

- **API Documentation Page** - New `/docs` page with complete API reference, PowerShell/cURL examples, and copyable API key
- **API Key Authentication** - Added `X-API-Key` header support with demo key `ftm_9e930c5e19b4edb497636944a053806f`
- **YouTube Loading Indicator** - Shows "Processing stream... please wait" during FFmpeg transcoding
- **BiliBili Loading Indicator** - Shows "Merging video and audio... please wait" during merge
- **Thumbnail Proxy** - BiliBili and YouTube thumbnails now display correctly via stream proxy

### 🎨 UI Improvements

- **Header** - Added "API Docs" link button
- **Footer Redesign** - Clean 2-column grid layout with Links (left) and Platforms (right)
- **Platform Badges** - Color-coded: Native (green), Python (blue), NSFW (red)
- **Deploy Links** - Railway marked "Full Support", Vercel marked "Limited"

### 🔧 Extract.py Cleanup (Major Refactor)

- **Centralized Configuration** - Single `DEFAULT_USER_AGENT` and `DEFAULT_HEADERS` constants
- **Platform Registry** - New `PLATFORM_CONFIG` dict with extractor type, patterns, NSFW flag, custom headers
- **Derived Lists** - `YTDLP_PLATFORMS`, `GALLERY_DL_PLATFORMS`, `NSFW_PLATFORMS` auto-generated from config
- **Short URL Resolution** - Unified `resolve_short_url()` for pin.it, b23.tv, redd.it
- **Format Processing** - New `process_video_formats()` and `process_audio_formats()` functions
- **Header Merge** - `merge_headers()` helper for platform-specific header overrides
- **File Organization** - Clear sections: Imports, Constants, Config, Security, Detection, Extractors, Processing, Transformers, Routes

### 🐛 Fixes

- **Thumbnail Display** - Fixed BiliBili/YouTube thumbnails not showing (removed hash-based approach, use stream proxy)
- **YouTube Playback** - Fixed immediate loading without indicator
- **Middleware Cleanup** - Removed all console.log debug statements

### 🔧 Technical Changes

- **ResultCard** - Uses `/api/v1/stream?url=...` for thumbnail proxy instead of hash
- **PlayerModal** - Added `needsHlsStream` to useEffect dependencies
- **extract route** - Simplified URL storage, removed thumbnailHash assignment
- **.env.local** - Added demo API key
- **.env.example** - Added API key placeholder with generation command

---

## [1.2.4] - 2026-01-11 — BiliBili Support + JSON Cleanup

### 🚀 What's New

- **BiliBili Video+Audio Merge** - Downloads now include audio! FFmpeg merges video and audio streams from BiliBili DASH segments
- **BiliBili Playback** - Video playback with audio via server-side FFmpeg merge
- **Cleaner JSON Response** - Removed hash from source objects to reduce payload size

### 🐛 Fixes

- **BiliBili Download** - Fixed video downloads being video-only (no audio)
- **BiliBili Playback** - Fixed playback having no audio by merging video+audio in FFmpeg
- **BiliBili Thumbnail** - Added `bstarstatic.com` to stream endpoint Referer check

### 🔧 Technical Changes

- **hls-stream endpoint** - Added `audioUrl` parameter for BiliBili video+audio merge (2 FFmpeg inputs)
- **FormatList** - Passes audio URL for BiliBili video downloads
- **PlayerModal** - Includes audioUrl in hls-stream request for BiliBili
- **extract route** - Removed hash from source objects (URLs still stored for validation)

---

## [1.2.3] - 2026-01-11 — YouTube HLS Video Playback Fix

### 🐛 Fixes

- **YouTube Video Playback** - Fixed video playing without audio. FFmpeg now includes audio track (`-c:a aac`) instead of stripping it (`-an`)
- **Separate Audio Logic** - Fixed FormatList incorrectly passing separate audio for YouTube HLS streams. Now only uses separate audio when `hasAudio === false` explicitly
- **Video Sizing** - Video player now fits modal properly with `max-h-[80vh] object-contain`

### 🔧 Technical Changes

- **hls-stream endpoint** - Video output now remuxes both video and audio from HLS source
- **FormatList** - Simplified audio detection logic, removed URL-based guessing
- **PlayerModal** - Cleaned up console.log statements

---

## [1.2.2] - 2026-01-10 — HLS Opus Streaming + YouTube

### 🚀 What's New

- **YouTube Support** - Video extraction via yt-dlp with quality selection, codec info, fps
- **HLS Opus Playback** - SoundCloud Opus HLS streams now play in browser via server-side FFmpeg transcoding
- **Experimental Badge** - HLS and Opus formats marked with ⚡ Experimental badge
- **Audio Preview** - Thumbnail preview with "🎵 Audio Only" badge for audio playback
- **New Endpoint** - `/api/v1/hls-stream` converts HLS to progressive MP3 stream

### 🔧 Technical Changes

- **FFmpeg Integration** - Uses `ffmpeg-static` package for server-side transcoding
- **Path Resolution Fix** - Fixed FFmpeg binary path in Next.js bundled environment
- **Middleware Update** - Added `/api/v1/hls-stream` to public routes
- **YouTube Metadata** - Includes codec (H.264/VP9/AV1), fps, hasAudio flags
- **YouTube Simplified Output** - 1 format per resolution (max 4: 1080p, 720p, 480p, 360p), priority: hasAudio > H.264 > VP9 > AV1
- **YouTube Audio Simplified** - Only 2 audio formats: AAC ~128kbps + Opus ~128kbps

### 📋 New Dependencies

```json
{
  "ffmpeg-static": "^5.3.0"
}
```

---

## [1.2.1] - 2026-01-10 — Python Extractors

### 🚀 What's New

- **Python Extractors** - Added support for 6 new platforms via yt-dlp and gallery-dl
- **SoundCloud** - Audio extraction with multiple formats (MP3, AAC, Opus)
- **BiliBili** - Video extraction with multiple qualities (144p-720p)
- **Reddit** - Video/image/gallery extraction
- **Pixiv** - Artwork extraction (NSFW support with cookies)
- **Eporner** - Adult video extraction (NSFW)
- **Rule34Video** - Adult video extraction (NSFW)

### 🔧 Technical Changes

- **Vercel Python Functions** - Flask-based serverless functions alongside Next.js
- **Hybrid Architecture** - TypeScript extractors (Twitter, Instagram, TikTok, Facebook) + Python extractors (new platforms)
- **Unified API** - All platforms accessible via same `/api/v1/extract` endpoint
- **NSFW Flag** - Response includes `isNsfw: true` for adult platforms
- **Concurrent Dev** - `npm run dev` runs both Next.js and Python Flask server

### 📦 New Files

```
api/py/
└── extract.py         # Flask-based Python extractor

src/lib/extractors/
└── python-platforms.ts  # Platform detection for Python routing
```

### 📋 New Dependencies

```
# Python (requirements.txt)
yt-dlp
gallery-dl
flask

# Node (devDependencies)
concurrently
```

### 🔧 Config Changes

- `vercel.json` - Python 3.12 runtime configuration
- `next.config.ts` - Dev rewrites for Python server proxy
- `package.json` - New dev scripts with concurrently

---

## [1.2.0] - 2026-01-10 — Next.js Migration + Streaming Fixes

### 🚀 What's New

- **Next.js 16** with App Router and Turbopack
- **TypeScript** full codebase conversion with strict types
- **React** frontend with custom hooks (`useExtract`, `useStatus`)
- **Server Components** for optimal performance
- **5-minute warm status** - extended keep-alive timeout from 30s to 5min
- **HLS.js Integration** - Better audio/video playback support

### 🔧 Streaming & Download Fixes

- **Stream Mode** - Added `streamMode` option to disable body timeout for large files
- **Progressive Streaming** - Audio/video now streams progressively instead of buffering entire file
- **HLS Support** - Added HLS.js library for m3u8 playlist playback
- **Better Error Handling** - PlayerModal shows specific error codes (MEDIA_ERR_DECODE, etc.)
- **MIME Mappings** - Comprehensive audio MIME type mappings (opus, ogg, flac, wav, aac)

### 🎵 Python Extractor Improvements

- **Extension Field** - Source objects now include `extension` field
- **Filename Generation** - Auto-generated filenames: `Author_Title_Quality.ext`
- **Audio Metadata** - Bitrate and filesize fields for audio sources
- **Sanitized Output** - Proper filename sanitization for special characters

### 🔄 What's Different

- **Framework**: Fastify → Next.js 16 App Router
- **Language**: JavaScript → TypeScript
- **Frontend**: Vanilla JS → React components
- **Logging**: Pino → Console-based logger (simplified)
- **SSE**: Custom implementation → ReadableStream API
- **Middleware**: Fastify hooks → Next.js middleware.ts
- **Cookie handling**: Frontend no longer auto-sends cookies, backend decides

### 🐛 Fixes

- **File size detection** - Fixed undici `maxRedirections` not supported error
- **Image extraction** - Removed overly aggressive skip patterns (`.webp`, `_s\d+x\d+`) that blocked valid Facebook images
- **Content type detection** - Fixed `permalink.php` URLs not detected as posts
- **Filename format** - Updated to `Author_Description_Quality_[DownAria].ext`
- **Playback timeout** - Fixed audio/video timeout on large files (bodyTimeout: 0 for streams)

### 📦 New Components

```
src/components/
├── ExtractForm.tsx    # URL input with paste button
├── ResultCard.tsx     # Metadata display
├── FormatList.tsx     # Download options
├── PlayerModal.tsx    # Video/audio player with HLS.js
├── CookieModal.tsx    # Cookie management
├── StatusBadge.tsx    # SSE warm/cold indicator
└── JsonOutput.tsx     # Collapsible JSON with copy
```

### 📋 New Dependencies

```json
{
  "hls.js": "^1.6.15"  // HLS streaming support
}
```

### 🔧 API Changes

No breaking changes - all endpoints remain the same:
- `POST /api/v1/extract`
- `GET /api/v1/stream`
- `GET /api/v1/download`
- `GET /api/v1/status`
- `GET /api/v1/events`
- `GET /api/health`

---

## [1.0.0] - 2026-01-8 — Pre-Migration Release (Fastify)

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
