# Changelog

All notable changes to FetchtiumV2.

---

## [1.7.0] - 2026-02-23 — Dynamic Deployment Profile

### 🚀 What's New

- **Dynamic Deployment Profile** - Single codebase works on both Vercel and Docker/Linux
  - `vercel` profile: Native extractors only (Facebook, Instagram, TikTok, Twitter, Pixiv)
  - `full` profile: Native + Python extractors (YouTube, BiliBili, SoundCloud, etc.)
- **Auto Environment Detection** - Automatically detects Vercel vs Docker/Railway
  - Priority: `EXTRACTOR_PROFILE` env var → Vercel auto-detect → Default to `full`
- **Platform Availability Error** - New `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT` error code
  - Returns helpful message when Python platforms requested on Vercel deployment
- **Public Access Model** - Removed API key requirement, open access for all users

### 🔧 Technical Changes

- **EXTRACTOR_PROFILE env var** - Controls extractor capability at runtime
- **getExtractorProfile()** - Resolves profile from environment with fallback chain
- **isPythonEnabled()** - Helper to check Python extractor availability
- **Direct HTTP calls** - Removed Next.js rewrites, Python service called directly
- **PYTHON_API_URL support** - Configurable Python endpoint for non-Vercel deployments

### 📦 Files Changed

```
+ .gitattributes                    # LF enforcement for shell scripts
~ vercel.json                       # Added framework, regions, EXTRACTOR_PROFILE
~ next.config.ts                    # Removed rewrites, updated CORS headers
~ src/lib/config/index.ts           # Added getExtractorProfile(), isPythonEnabled()
~ src/types/config.ts               # Added extractorProfile, removed apiKeys
~ src/app/api/v1/extract/route.ts   # Profile-aware routing, platform blocking
~ src/lib/utils/error.utils.ts      # Added PLATFORM_UNAVAILABLE_ON_DEPLOYMENT
~ Dockerfile                        # Added EXTRACTOR_PROFILE=full, use requirements.txt
~ start.sh                          # Added EXTRACTOR_PROFILE env var
~ src/app/page.tsx                  # Logo from public/icon.png, Lucide icons
~ src/app/changelog/page.tsx        # Logo from public/icon.png, Lucide icons
- StatusBadge component             # Removed cold/warm state from UI
```

---

## [1.6.0] - 2026-01-13 — Go Backend Extractors Reorganization

### 🔧 Refactoring (Go Backend)

- **Extractors Reorganization** - Restructured `internal/extractors/` into logical subfolders:
  - `core/` - Shared types and interfaces (`types.go`)
  - `registry/` - Platform detection and extractor registry (`registry.go`, `patterns.go`)
  - `cookies/` - Cookie parsing and management (`cookies.go`)
  - `native/` - TypeScript-equivalent extractors (Facebook, Instagram, TikTok, Twitter, Pixiv)
  - `aria-extended/` - yt-dlp/gallery-dl wrapper extractors (YouTube, BiliBili, SoundCloud, etc.)
  - `tests/` - Property-based and integration tests

- **HTTP Package Simplification** - Merged and cleaned up `pkg/http/`:
  - `client.go` - HTTP client with connection pooling
  - `pool.go` - Connection pool management
  - `helpers.go` - Request/response utilities

- **Type Fixes** - Fixed `ExtractorFactory` type mismatch between registry and extractors

### 📦 Files Changed (Go)

```
.planning/fetchtium_go/internal/extractors/
├── core/types.go           # Shared types (ExtractResult, Source, etc.)
├── registry/
│   ├── registry.go         # Extractor registration & lookup
│   └── patterns.go         # URL pattern matching
├── cookies/cookies.go      # Cookie parsing (Netscape, JSON, raw)
├── native/                 # Native extractors
│   ├── facebook/
│   ├── instagram/
│   ├── tiktok/
│   ├── twitter/
│   └── pixiv/
├── aria-extended/          # yt-dlp/gallery-dl wrappers
│   ├── wrapper.go
│   ├── youtube/
│   ├── bilibili/
│   └── ...
└── tests/                  # Test files

.planning/fetchtium_go/pkg/http/
├── client.go               # Simplified HTTP client
├── pool.go                 # Connection pool
└── helpers.go              # Utilities
```

---

## [1.5.1] - 2026-01-12 — Pixiv Native Support + Hotfixes

### 🚀 What's New

- **Pixiv Native Extractor** - Direct API integration without gallery-dl dependency
  - Single and multi-page artwork support
  - Original quality images with file sizes
  - Automatic Referer header handling via proxy

- **All Resolutions Support** - No more 360p/480p/720p/1080p limit
  - Returns ALL available video qualities (144p to 4K+)
  - Deduplication by exact height (one format per resolution)

- **Changelog Page** - New `/changelog` page that reads directly from CHANGELOG.md
  - Auto-updates when changelog is modified
  - Styled markdown rendering

- **Format Badge** - Shows original format with codec in FormatList
  - Combined format: `[HLS-H.264]`, `[MP4-VP9]`, `[DASH-AV1]`, `[Opus]`
  - Mime type shown below for output format

### 🔧 Technical Changes

- **src/lib/extractors/pixiv/** - New native TypeScript extractor using Pixiv's `/ajax/illust/{id}` API
- **Removed HTTP/2 from TypeScript** - Simplified to undici only (Python keeps httpx HTTP/2)
- **Proxy support for Pixiv** - Stream/download/thumbnail routes add `Referer: https://www.pixiv.net/`
- **needsProxy flag** - Pixiv sources marked for automatic proxy routing

### 🐛 Fixes

- **PlayerModal audio leak** - Fixed audio continuing after modal close (proper cleanup with `load()`)
- **Merge loading message** - Changed to "Merging video and audio for playback... please wait"
- **FormatList Open button** - Now uses proxy for `needsProxy` sources (Pixiv images)
- **ResultCard thumbnails** - Added Pixiv to proxy thumbnail platforms

### 📦 Files Changed

```
+ src/lib/extractors/pixiv/index.ts    # New Pixiv native extractor
+ src/app/changelog/page.tsx           # Changelog page
+ src/app/api/changelog/route.ts       # Changelog API endpoint
- src/lib/core/network/http2-client.ts # Removed (Python has own httpx)
~ src/lib/core/network/client.ts       # Simplified to undici only
~ src/lib/extractors/index.ts          # Register PixivExtractor
~ src/lib/extractors/python-platforms.ts # Remove Pixiv from Python
~ src/app/api/v1/stream/route.ts       # Add Pixiv Referer
~ src/app/api/v1/download/route.ts     # Add Pixiv Referer
~ src/app/api/v1/thumbnail/route.ts    # Add pximg.net + Referer
~ src/components/PlayerModal.tsx       # Fix audio cleanup
~ src/components/FormatList.tsx        # Format badge + proxy for needsProxy
~ src/components/ResultCard.tsx        # Pixiv thumbnail proxy
~ src/app/page.tsx                     # Add changelog link in header
~ src/middleware.ts                    # Add /api/changelog to public routes
~ api/extract.py                       # Remove Pixiv, all resolutions support
```

---

## [1.5.0] - 2026-01-11 — HTTP/2 Support + Rule34Video + Stream Improvements

### 🚀 What's New

- **HTTP/2 Support (TypeScript)** - Auto-detect and use HTTP/2 for HTTPS requests when available (Vercel Functions, Railway)
- **HTTP/2 Support (Python)** - Shared `httpx` client with HTTP/2 and 5-minute connection pooling
- **Rule34Video Support** - Multi-format extraction (360p-4K) via yt-dlp with URL resolution
- **Eporner Multi-Format** - Returns all available formats (240p-1080p 60fps) with file sizes
- **URL Resolution** - Wrapper URLs (Rule34Video, Eporner) resolved to real CDN URLs in parallel
- **Stream Expired URL Detection** - Returns "URL_EXPIRED" error instead of following rickroll redirects

### 🔧 Technical Changes

- **http2-client.ts** - New HTTP/2 client with session pooling (5-min keepalive), auto-cleanup
- **client.ts** - Smart detection: HTTP/2 for HTTPS when available, fallback to undici HTTP/1.1
- **api/extract.py** - Shared `HTTP_CLIENT` with httpx HTTP/2, 5-min keepalive, 10 max connections
- **resolve_media_url()** - Resolves wrapper URLs to CDN, removes `download=true` params
- **resolve_media_urls_parallel()** - Parallel URL resolution with ThreadPoolExecutor (5 workers)
- **transform_eporner_result()** - Checks `quality` field first (Rule34Video uses this), adds "p" suffix
- **stream route** - Detects rickroll/placeholder redirects and returns 410 Gone with URL_EXPIRED code

### 🐛 Fixes

- **Rule34Video Quality** - Fixed quality showing "0", "1", "2" instead of "360p", "720p", "1080p"
- **Rule34Video Playback** - Fixed "Open in new tab" redirecting to rickroll (URL resolution)
- **Rule34Video Download** - Fixed browser downloading instead of playing (removed `download=true` param)
- **Eporner Quality** - Fixed quality string formatting for all formats

### 📦 New Files

```
src/lib/core/network/http2-client.ts  # HTTP/2 client with session pooling
```

### 📋 Dependencies

```
# Python (requirements.txt)
httpx[http2]  # HTTP/2 support for Python extractor
```

### 🔧 Environment Detection

```typescript
// Auto-detected at startup (zero runtime overhead)
- Vercel Functions → HTTP/2 ✓
- Railway Node.js → HTTP/2 ✓
- Vercel Edge → undici HTTP/1.1 (no http2 module)
- Local dev → HTTP/2 ✓
```

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
