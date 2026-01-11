# Design Document

## Overview

This design describes how to integrate Python-based extractors (yt-dlp and gallery-dl) into the existing Fetchtium Next.js application using Vercel serverless functions.

**Key Insight**: yt-dlp and gallery-dl are installed as dependencies via `requirements.txt`. We only need to create thin wrapper functions that call these libraries and transform their output to our standard response format.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Fetchtium Frontend                       │
│                    (Next.js React App)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    /api/v1/extract                           │
│                  (Next.js API Route)                         │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ TypeScript      │    │ Python Platforms                │ │
│  │ Extractors      │    │ (BiliBili, Reddit, SoundCloud,  │ │
│  │ (Twitter, IG)   │    │  Pixiv, Eporner, Rule34Video)   │ │
│  └────────┬────────┘    └────────────────┬────────────────┘ │
│           │                              │                   │
│           ▼                              ▼                   │
│    Direct Extract              Proxy to /api/py/extract      │
└─────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    /api/py/extract                           │
│               (Python Serverless Function)                   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Platform Router                           │  │
│  │         (detect URL → call appropriate lib)            │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│              ┌───────────────┴───────────────┐              │
│              ▼                               ▼              │
│  ┌─────────────────────┐       ┌─────────────────────────┐  │
│  │      yt-dlp         │       │      gallery-dl         │  │
│  │   (SoundCloud)      │       │  (BiliBili, Reddit,     │  │
│  │                     │       │   Pixiv, Eporner,       │  │
│  │                     │       │   Rule34Video)          │  │
│  └─────────────────────┘       └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
fetchtiumv2/
├── api/                          # Python serverless functions (Vercel)
│   └── py/
│       ├── extract.py            # Main endpoint + all platform wrappers
│       └── utils.py              # Response formatting utilities
├── requirements.txt              # Python dependencies (yt-dlp, gallery-dl)
├── vercel.json                   # Vercel configuration
├── src/                          # Existing Next.js app
│   ├── app/
│   │   └── api/
│   │       └── v1/
│   │           └── extract/
│   │               └── route.ts  # Modified to route Python platforms
│   └── lib/
│       └── extractors/
│           └── python-platforms.ts  # Python platform detection
└── next.config.ts                # Modified for local dev rewrites
```

## Component Design

### Component 1: Python Function Infrastructure

Addresses: Requirement 1

#### vercel.json Configuration

```json
{
  "functions": {
    "api/py/**/*.py": {
      "runtime": "python3.12",
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/py/:path*",
      "destination": "/api/py/:path*"
    }
  ],
  "excludeFiles": [
    "node_modules/**",
    ".next/**",
    "src/**",
    "public/**"
  ]
}
```

#### requirements.txt

```
yt-dlp>=2024.1.0
gallery-dl>=1.27.0
```

Note: FastAPI is NOT needed - Vercel Python functions use a simple handler pattern.

#### Local Development Setup

For local development, use `concurrently` to run both Next.js and a simple Python server:

```json
// package.json scripts
{
  "dev": "concurrently \"next dev\" \"python -m http.server 3001\"",
  "dev:next": "next dev",
  "dev:python": "python api/py/extract.py"
}
```

```typescript
// next.config.ts rewrites for local dev
async rewrites() {
  if (process.env.NODE_ENV === 'development') {
    return [
      {
        source: '/api/py/:path*',
        destination: 'http://localhost:3001/api/py/:path*',
      },
    ];
  }
  return [];
}
```

### Component 2: Python Extractor API

Addresses: Requirement 2

#### Main Endpoint (api/py/extract.py)

This is a thin wrapper that:
1. Detects platform from URL
2. Calls yt-dlp or gallery-dl
3. Transforms output to standard format

```python
# api/py/extract.py
import json
import re
import yt_dlp
import gallery_dl

# Platform patterns
PLATFORMS = {
    'bilibili': [r'bilibili\.com', r'b23\.tv'],
    'reddit': [r'reddit\.com', r'redd\.it', r'v\.redd\.it'],
    'soundcloud': [r'soundcloud\.com'],
    'pixiv': [r'pixiv\.net'],
    'eporner': [r'eporner\.com'],
    'rule34video': [r'rule34video\.com'],
}

# Platforms using yt-dlp vs gallery-dl
YTDLP_PLATFORMS = ['soundcloud']
GALLERY_DL_PLATFORMS = ['bilibili', 'reddit', 'pixiv', 'eporner', 'rule34video']
NSFW_PLATFORMS = ['pixiv', 'eporner', 'rule34video']

def detect_platform(url: str) -> str | None:
    for platform, patterns in PLATFORMS.items():
        if any(re.search(p, url) for p in patterns):
            return platform
    return None

def extract_with_ytdlp(url: str, cookie: str = None) -> dict:
    """Extract using yt-dlp (SoundCloud, etc.)"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    if cookie:
        ydl_opts['cookiefile'] = cookie
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return transform_ytdlp_result(info)

def extract_with_gallery_dl(url: str, cookie: str = None) -> dict:
    """Extract using gallery-dl (BiliBili, Reddit, Pixiv, etc.)"""
    # gallery-dl returns generator of (url, metadata) tuples
    config = {}
    if cookie:
        config['cookies'] = cookie
    
    results = list(gallery_dl.job.UrlJob(url).run())
    return transform_gallery_dl_result(results, url)

def handler(request):
    """Vercel serverless function handler"""
    body = json.loads(request.body)
    url = body.get('url')
    cookie = body.get('cookie')
    
    platform = detect_platform(url)
    if not platform:
        return {'success': False, 'error': {'code': 'UNSUPPORTED_PLATFORM', 'message': 'Platform not supported'}}
    
    try:
        if platform in YTDLP_PLATFORMS:
            result = extract_with_ytdlp(url, cookie)
        else:
            result = extract_with_gallery_dl(url, cookie)
        
        result['platform'] = platform
        result['isNsfw'] = platform in NSFW_PLATFORMS
        return result
    except Exception as e:
        return {'success': False, 'error': {'code': 'EXTRACTION_FAILED', 'message': str(e)}}
```

#### Response Transformation

Transform yt-dlp/gallery-dl output to standard Fetchtium format:

```python
def transform_ytdlp_result(info: dict) -> dict:
    """Transform yt-dlp info_dict to standard format"""
    items = []
    
    # Handle formats
    formats = info.get('formats', [])
    sources = []
    for fmt in formats:
        if fmt.get('acodec') != 'none':  # Has audio
            sources.append({
                'quality': fmt.get('format_note', 'unknown'),
                'url': fmt.get('url'),
                'resolution': f"{fmt.get('width', 0)}x{fmt.get('height', 0)}",
                'mime': fmt.get('ext', 'mp4'),
            })
    
    items.append({
        'index': 0,
        'type': 'audio' if info.get('extractor') == 'soundcloud' else 'video',
        'thumbnail': info.get('thumbnail'),
        'sources': sources,
    })
    
    return {
        'success': True,
        'contentType': 'audio' if info.get('extractor') == 'soundcloud' else 'video',
        'title': info.get('title'),
        'author': info.get('uploader'),
        'id': info.get('id'),
        'description': info.get('description'),
        'uploadDate': info.get('upload_date'),
        'items': items,
    }

def transform_gallery_dl_result(results: list, url: str) -> dict:
    """Transform gallery-dl results to standard format"""
    items = []
    
    for i, (media_url, metadata) in enumerate(results):
        media_type = 'video' if any(ext in media_url for ext in ['.mp4', '.webm']) else 'image'
        items.append({
            'index': i,
            'type': media_type,
            'thumbnail': metadata.get('thumbnail'),
            'sources': [{
                'quality': 'original',
                'url': media_url,
                'mime': 'video/mp4' if media_type == 'video' else 'image/jpeg',
            }],
        })
    
    # Get metadata from first result
    meta = results[0][1] if results else {}
    
    return {
        'success': True,
        'contentType': 'video' if any(i['type'] == 'video' for i in items) else 'image',
        'title': meta.get('title'),
        'author': meta.get('uploader') or meta.get('author'),
        'id': meta.get('id'),
        'description': meta.get('description'),
        'items': items,
    }
```

### Component 3: Frontend Integration

Addresses: Requirement 9

#### Python Platform Detection (src/lib/extractors/python-platforms.ts)

```typescript
export const PYTHON_PLATFORMS = [
  { platform: 'bilibili', patterns: [/bilibili\.com/, /b23\.tv/] },
  { platform: 'reddit', patterns: [/reddit\.com/, /redd\.it/, /v\.redd\.it/] },
  { platform: 'soundcloud', patterns: [/soundcloud\.com/] },
  { platform: 'pixiv', patterns: [/pixiv\.net/], nsfw: true },
  { platform: 'eporner', patterns: [/eporner\.com/], nsfw: true },
  { platform: 'rule34video', patterns: [/rule34video\.com/], nsfw: true },
];

export function isPythonPlatform(url: string): boolean {
  return PYTHON_PLATFORMS.some(p => p.patterns.some(r => r.test(url)));
}

export function isNsfwPlatform(url: string): boolean {
  const platform = PYTHON_PLATFORMS.find(p => p.patterns.some(r => r.test(url)));
  return platform?.nsfw ?? false;
}
```

#### Modified Extract Route

```typescript
// In src/app/api/v1/extract/route.ts
import { isPythonPlatform } from '@/lib/extractors/python-platforms';

// Inside POST handler, before TypeScript extractor logic:
if (isPythonPlatform(url)) {
  const pyResponse = await fetch(`${getBaseUrl()}/api/py/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, cookie }),
  });
  
  const result = await pyResponse.json();
  // Add filenames and return
  return NextResponse.json(addFilenames(result));
}
```

### Component 4: NSFW Content Handling

Addresses: Requirement 10

- Python extractors add `isNsfw: true` for NSFW platforms
- Frontend can optionally show warning badge
- NSFW thumbnails are NOT cached on server

## Size Optimization

To stay under Vercel's 250MB limit:

1. Use `excludeFiles` in vercel.json to exclude Next.js files from Python builds
2. yt-dlp and gallery-dl are lightweight (no FFmpeg bundling needed)
3. Single Python file keeps deployment small

## Testing Strategy

### Local Testing

1. Run `npm run dev` (starts both Next.js and Python server)
2. Test Python endpoint: `curl -X POST http://localhost:3001/api/py/extract -d '{"url":"..."}'`
3. Test through Next.js: `curl -X POST http://localhost:3000/api/py/extract -d '{"url":"..."}'`

### Production Testing

1. Deploy to Vercel preview
2. Test each platform with sample URLs
3. Verify response format matches TypeScript extractors
