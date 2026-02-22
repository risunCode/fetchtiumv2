# FetchtiumV2

Media extraction tool for 16+ social media platforms. Built with Next.js 16, TypeScript, React, and Python.

## Features

- 🎬 Extract videos, images, and audio from social media
- 🔒 Guest-first approach with automatic cookie retry for private content
- 📱 Responsive dark UI with Lucide icons
- 🎵 Built-in media player with FFmpeg transcoding
- 📦 Batch download support for galleries
-  API documentation page with examples
- 🚀 Dynamic deployment: Vercel (native) or Docker/Railway (full)

## Supported Platforms

### Native Extractors (TypeScript) - Works on Vercel
| Platform | Videos | Images | Stories | Reels |
|----------|--------|--------|---------|-------|
| Facebook | ✅ | ✅ | ✅ | ✅ |
| Instagram | ✅ | ✅ | ✅ | ✅ |
| TikTok | ✅ | ✅ | - | - |
| Twitter/X | ✅ | ✅ | - | - |
| Pixiv | - | ✅ | - | - |

### Python Extractors (yt-dlp / gallery-dl) - Docker/Railway Only
| Platform | Type | Notes |
|----------|------|-------|
| YouTube | Video/Audio | HLS streaming, quality selection |
| BiliBili | Video | DASH merge (video+audio) |
| SoundCloud | Audio | Multiple formats |
| Twitch | Video | Clips & VODs |
| Bandcamp | Audio | Track extraction |
| Reddit | Video/Image | Gallery support |
| Pinterest | Image | Pin extraction |
| Weibo | Video/Image | - |
| Eporner | Video | NSFW |
| Rule34Video | Video | NSFW |

## Quick Start

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Copy environment file
cp .env.example .env.local

# Run development server (Next.js + Python Flask)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Documentation

Visit `/docs` for complete API reference with examples.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/extract` | Extract media from URL |
| GET | `/api/v1/stream` | Proxy media stream |
| GET | `/api/v1/download` | Download with filename |
| GET | `/api/v1/merge` | Merge video+audio (FFmpeg) |
| GET | `/api/v1/hls-stream` | Transcode HLS to progressive |
| GET | `/api/v1/status` | Server status & platforms |
| GET | `/api/v1/events` | SSE status stream |

### Extract Example

```bash
# cURL
curl -X POST https://your-domain.com/api/v1/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'

# PowerShell
$body = @{ url = "https://youtube.com/watch?v=dQw4w9WgXcQ" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://your-domain.com/api/v1/extract" -Method POST -Body $body -ContentType "application/json"
```

### Authentication

Public access - no API key required.

## Project Structure

```
├── api/py/              # Python Flask extractors
│   └── extract.py       # yt-dlp & gallery-dl wrapper
├── src/
│   ├── app/
│   │   ├── api/v1/      # API routes
│   │   ├── docs/        # API documentation page
│   │   └── page.tsx     # Main page
│   ├── components/      # React components
│   ├── hooks/           # Custom hooks
│   ├── lib/
│   │   ├── core/        # Network & parser
│   │   ├── extractors/  # TypeScript extractors
│   │   └── utils/       # Utilities
│   └── types/           # TypeScript types
├── scripts/             # Test scripts
├── requirements.txt     # Python dependencies
└── .planning/fetchtium_go/  # Go backend (WIP)
    ├── cmd/             # CLI entrypoints
    ├── internal/
    │   └── extractors/
    │       ├── core/        # Shared types
    │       ├── registry/    # Platform detection
    │       ├── cookies/     # Cookie parsing
    │       ├── native/      # Native extractors
    │       ├── aria-extended/  # yt-dlp wrappers
    │       └── tests/       # Test files
    └── pkg/
        ├── http/        # HTTP client & pool
        └── utils/       # Utilities
```

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Deployment Profile (auto-detected if not set)
# - "vercel": Native extractors only (for Vercel deployment)
# - "full": Native + Python extractors (for Docker/Railway)
EXTRACTOR_PROFILE=full

# Access Control
ALLOWED_ORIGINS=http://localhost:3000

# Python API URL (for non-Vercel deployments)
PYTHON_API_URL=http://127.0.0.1:3001

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

## Deployment

### Deployment Profiles

| Profile | Platforms | Environment |
|---------|-----------|-------------|
| `vercel` | Native only (5) | Vercel auto-detected |
| `full` | Native + Python (15) | Docker/Railway default |

Profile resolution order:
1. `EXTRACTOR_PROFILE` env var (explicit override)
2. Auto-detect Vercel (`VERCEL` or `VERCEL_ENV` env vars)
3. Default to `full`

### Railway (Recommended)
Full support with FFmpeg for video/audio merge and HLS transcoding.

```bash
# Deploy with Dockerfile
railway run ./start.sh
```

### Vercel
Native extractors only (Facebook, Instagram, TikTok, Twitter, Pixiv).

Python platforms (YouTube, BiliBili, etc.) will return `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT` error.

Limitations:
- ❌ No FFmpeg support
- ❌ No Python extractors

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript + Python
- **Styling**: Tailwind CSS
- **HTTP Client**: Undici
- **Media Processing**: FFmpeg (ffmpeg-static)
- **Python**: yt-dlp, gallery-dl, Flask

## License

GPL-3
