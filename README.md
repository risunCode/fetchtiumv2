# FetchtiumV2

The Ultimate JS Scrapper For social media extraction tool for Facebook, Instagram, TikTok, xTwitter and more. Built with Next.js 16, TypeScript, and React.

## Features

- 🎬 Extract videos, images, and audio from social media
- 🔒 Guest-first approach with automatic cookie retry for private content
- 📱 Responsive dark UI with real-time status
- 🎵 Built-in media player with streaming proxy
- 📦 Batch download support for galleries
- 🔄 SSE-based server status (warm/cold indicator)

## Supported Platforms

| Platform | Videos | Images | Stories | Reels |
|----------|--------|--------|---------|-------|
| Facebook | ✅ | ✅ | ✅ | ✅ |
| Instagram | 🔜 | 🔜 | 🔜 | 🔜 |
| TikTok | 🔜 | 🔜 | - | - |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/extract` | Extract media from URL |
| GET | `/api/v1/stream` | Proxy video stream |
| GET | `/api/v1/download` | Download file with proper filename |
| GET | `/api/v1/status` | Server status |
| GET | `/api/v1/events` | SSE status stream |
| GET | `/api/health` | Health check |

### Extract Example

```bash
curl -X POST http://localhost:3000/api/v1/extract \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"url": "https://www.facebook.com/share/p/xxx/"}'
```

## Project Structure

```
src/
├── app/
│   ├── api/v1/          # API routes
│   ├── page.tsx         # Main page
│   └── layout.tsx       # Root layout
├── components/          # React components
├── hooks/               # Custom hooks
├── lib/
│   ├── core/            # Network & parser
│   ├── extractors/      # Platform extractors
│   ├── middleware/      # Security helpers
│   └── utils/           # Utilities
└── types/               # TypeScript types
```

## Environment Variables

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
API_KEYS=
REQUEST_TIMEOUT=30000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Undici
- **HTML Parser**: node-html-parser

## License

GPL-3
