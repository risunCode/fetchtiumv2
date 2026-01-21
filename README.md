# FetchtiumV2

Media extraction tool for 16+ social media platforms. Built with Next.js 16, TypeScript, React, and Python.

## Features

- 🎬 Extract videos, images, and audio from social media
- 🔒 Guest-first approach with automatic cookie retry for private content
- 📱 Responsive dark UI with real-time status
- 🎵 Built-in media player with FFmpeg transcoding
- 📦 Batch download support for galleries
- 🔄 SSE-based server status (warm/cold indicator)
- 📖 API documentation page with examples

## Supported Platforms

### Native Extractors (TypeScript)
| Platform | Videos | Images | Stories | Reels |
|----------|--------|--------|---------|-------|
| Facebook | ✅ | ✅ | ✅ | ✅ |
| Instagram | ✅ | ✅ | ✅ | ✅ |
| TikTok | ✅ | ✅ | - | - |
| Twitter/X | ✅ | ✅ | - | - |

### Python Extractors (yt-dlp / gallery-dl)
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
| Pixiv | Image | NSFW (requires cookie) |
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

Optional API key via `X-API-Key` header for higher rate limits.

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

# Access Control
ALLOWED_ORIGINS=http://localhost:3000
API_KEYS=ftm_your_api_key_here

# URL Encryption
URL_ENCRYPT_KEY=your_32_char_hex_key

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Python (dev only)
PYTHON_SERVER_PORT=3001
FLASK_DEBUG=false
```

## Deployment

### Railway (Recommended)
Full support with FFmpeg for video/audio merge and HLS transcoding.

### Vercel
All extractors work, but no FFmpeg support:
- ❌ BiliBili video+audio merge
- ❌ YouTube HLS transcoding
- ❌ SoundCloud Opus playback

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript + Python
- **Styling**: Tailwind CSS
- **HTTP Client**: Undici
- **Media Processing**: FFmpeg (ffmpeg-static)
- **Python**: yt-dlp, gallery-dl, Flask

## License

GPL-3
