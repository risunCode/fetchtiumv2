# Architecture

## Overview

FetchtiumV2 uses a hybrid architecture combining Next.js (TypeScript) and Flask (Python) for maximum platform coverage.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    React Components                      │    │
│  │  ExtractForm → ResultCard → FormatList → PlayerModal    │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                      Next.js App Router                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    API Routes (/api/v1)                  │    │
│  │  extract │ stream │ download │ status │ hls-* │ merge   │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                       Extractor Layer                            │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ TypeScript Native   │  │     Python (Flask)              │   │
│  │ Facebook, Instagram │  │  YouTube, SoundCloud, BiliBili  │   │
│  │ Twitter, TikTok     │  │  Reddit, Pinterest, Weibo       │   │
│  │ Pixiv               │  │  (yt-dlp / gallery-dl)          │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      Infrastructure Layer                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Undici  │ │  httpx   │ │  FFmpeg  │ │URL Store │           │
│  │ (HTTP/1) │ │ (HTTP/2) │ │(transcode)│ │ (proxy)  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
fetchtiumv2/
├── api/
│   └── extract.py              # Python Flask extractors
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── extract/route.ts    # Main extraction endpoint
│   │   │   │   ├── stream/route.ts     # Media streaming proxy
│   │   │   │   ├── download/route.ts   # Download with filename
│   │   │   │   ├── status/route.ts     # Server status
│   │   │   │   ├── events/route.ts     # SSE status stream
│   │   │   │   ├── hls-proxy/route.ts  # HLS manifest proxy
│   │   │   │   ├── hls-stream/route.ts # HLS to progressive
│   │   │   │   ├── merge/route.ts      # Video+audio merge
│   │   │   │   └── thumbnail/route.ts  # Thumbnail proxy
│   │   │   ├── changelog/route.ts
│   │   │   └── health/route.ts
│   │   ├── docs/page.tsx               # API documentation
│   │   ├── changelog/page.tsx          # Changelog page
│   │   ├── page.tsx                    # Main page
│   │   ├── layout.tsx                  # Root layout
│   │   └── globals.css                 # Global styles
│   ├── components/
│   │   ├── ExtractForm.tsx             # URL input form
│   │   ├── ResultCard.tsx              # Extraction result display
│   │   ├── FormatList.tsx              # Download options
│   │   ├── PlayerModal.tsx             # Video/audio player
│   │   ├── CookieModal.tsx             # Cookie management
│   │   ├── StatusBadge.tsx             # SSE status indicator
│   │   └── JsonOutput.tsx              # JSON viewer
│   ├── hooks/
│   │   ├── useExtract.ts               # Extraction hook
│   │   └── useStatus.ts                # Status SSE hook
│   ├── lib/
│   │   ├── core/
│   │   │   ├── network/
│   │   │   │   ├── client.ts           # HTTP client (undici)
│   │   │   │   ├── cookies.ts          # Cookie parsing
│   │   │   │   └── headers.ts          # Platform headers
│   │   │   └── parser/
│   │   │       ├── html.parser.ts      # HTML parsing
│   │   │       └── regex.extractor.ts  # Regex utilities
│   │   ├── extractors/
│   │   │   ├── index.ts                # Extractor registry
│   │   │   ├── base.extractor.ts       # Base class
│   │   │   ├── facebook/               # Facebook extractor
│   │   │   ├── instagram/              # Instagram extractor
│   │   │   ├── twitter/                # Twitter extractor
│   │   │   ├── tiktok/                 # TikTok extractor
│   │   │   ├── pixiv/                  # Pixiv extractor
│   │   │   └── python-platforms.ts     # Python routing
│   │   ├── middleware/
│   │   │   ├── access.ts               # Access control
│   │   │   └── security.ts             # Security checks
│   │   └── utils/
│   │       ├── error.utils.ts          # Error handling
│   │       ├── filename.utils.ts       # Filename generation
│   │       ├── mime.helper.ts          # MIME detection
│   │       ├── url.utils.ts            # URL utilities
│   │       ├── url-store.ts            # URL storage for proxy
│   │       ├── response.utils.ts       # Response builders
│   │       └── logger.ts               # Logging
│   ├── middleware.ts                   # Next.js middleware
│   └── types/
│       ├── extract.ts                  # Extraction types
│       ├── api.ts                      # API types
│       └── config.ts                   # Config types
├── public/                             # Static assets
├── scripts/                            # Test scripts
├── .env.example                        # Environment template
├── requirements.txt                    # Python dependencies
├── package.json                        # Node dependencies
├── next.config.ts                      # Next.js config
├── tsconfig.json                       # TypeScript config
└── Dockerfile                          # Docker build
```

---

## Core Components

### Extractor Registry

The registry manages all TypeScript extractors:

```typescript
// src/lib/extractors/index.ts
const extractors: ExtractorClass[] = [
  FacebookExtractor,
  InstagramExtractor,
  TwitterExtractor,
  TikTokExtractor,
  PixivExtractor,
];

export function getExtractor(url: string): BaseExtractor {
  for (const Extractor of extractors) {
    if (Extractor.match(url)) {
      return new Extractor();
    }
  }
  throw new ExtractorError(ErrorCode.UNSUPPORTED_PLATFORM);
}
```

### Base Extractor

All TypeScript extractors extend the base class:

```typescript
// src/lib/extractors/base.extractor.ts
export abstract class BaseExtractor {
  static platform: string;
  static patterns: RegExp[];
  
  static match(url: string): boolean {
    return this.patterns.some(p => p.test(url));
  }
  
  abstract extract(url: string, options: ExtractOptions): Promise<ExtractResponse>;
}
```

### Python Routing

Python platforms are detected and routed to Flask:

```typescript
// src/lib/extractors/python-platforms.ts
export const PYTHON_PLATFORMS = [
  { platform: 'youtube', patterns: [/youtube\.com/, /youtu\.be/] },
  { platform: 'soundcloud', patterns: [/soundcloud\.com/] },
  { platform: 'bilibili', patterns: [/bilibili\.com/, /b23\.tv/] },
  // ...
];

export function isPythonPlatform(url: string): boolean {
  return PYTHON_PLATFORMS.some(p => 
    p.patterns.some(r => r.test(url))
  );
}
```

### URL Store

Temporary URL storage for proxy validation:

```typescript
// src/lib/utils/url-store.ts
const urlStore = new Map<string, { url: string; expires: number }>();

export function addUrls(urls: string[]): void {
  for (const url of urls) {
    const hash = generateHash(url);
    urlStore.set(hash, { url, expires: Date.now() + TTL });
  }
}

export function isValidUrl(url: string): boolean {
  return urlStore.has(generateHash(url));
}
```

---

## Request Flow

### Extract Request

```
1. Client POST /api/v1/extract {"url": "..."}
2. Next.js middleware: security checks, rate limiting
3. extract/route.ts:
   a. Validate URL
   b. Detect platform (TypeScript or Python)
   c. If Python → proxy to Flask server
   d. If TypeScript → use extractor registry
   e. Store URLs for proxy validation
   f. Add filenames to sources
   g. Return JSON response
```

### Stream Request

```
1. Client GET /api/v1/stream?url=...
2. stream/route.ts:
   a. Validate URL is in store (or from known platform)
   b. Add platform-specific headers
   c. Fetch from upstream
   d. Stream response to client
```

### HLS Stream Request

```
1. Client GET /api/v1/hls-stream?url=...&type=audio
2. hls-stream/route.ts:
   a. Validate URL
   b. Detect stream type (HLS/DASH)
   c. Execute FFmpeg conversion
   d. Stream output to client
```

---

## Python Extractor (Flask)

The Python server handles platforms requiring yt-dlp or gallery-dl:

```python
# api/extract.py
@app.route('/api/extract', methods=['POST'])
def extract():
    data = request.json
    url = data.get('url')
    cookie = data.get('cookie')
    
    platform = detect_platform(url)
    
    if platform in YTDLP_PLATFORMS:
        result = extract_with_ytdlp(url, cookie)
    elif platform in GALLERY_DL_PLATFORMS:
        result = extract_with_gallery_dl(url, cookie)
    else:
        return error_response('UNSUPPORTED_PLATFORM')
    
    return jsonify(transform_result(result, platform))
```

---

## Security

### Middleware Chain

```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  // 1. Rate limiting
  // 2. CORS validation
  // 3. API key validation
  // 4. Security headers
}
```

### URL Validation

```python
# api/extract.py
def validate_url(url: str) -> tuple[bool, str]:
    # Check length
    # Check for attack patterns
    # Validate protocol (http/https only)
    # Block internal hosts (SSRF protection)
```

### Cookie Sanitization

```python
def sanitize_cookie(cookie: str) -> str | None:
    # Check length
    # Check for attack patterns
    # Remove control characters
```

---

## FFmpeg Integration

FFmpeg is used for:
- HLS to MP3/MP4 conversion
- Video + audio merge (BiliBili, YouTube DASH)

```typescript
// Uses ffmpeg-static package
import ffmpegPath from 'ffmpeg-static';

const ffmpeg = spawn(ffmpegPath, [
  '-i', inputUrl,
  '-c:a', 'libmp3lame',
  '-f', 'mp3',
  '-'
]);
```

---

## Error Handling

Standardized error codes across TypeScript and Python:

```typescript
// src/lib/utils/error.utils.ts
export enum ErrorCode {
  INVALID_URL = 'INVALID_URL',
  UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
  PRIVATE_CONTENT = 'PRIVATE_CONTENT',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  // ...
}
```

```python
# api/extract.py
class ErrorCode:
    INVALID_URL = 'INVALID_URL'
    UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM'
    PRIVATE_CONTENT = 'PRIVATE_CONTENT'
    EXTRACTION_FAILED = 'EXTRACTION_FAILED'
    # ...
```
