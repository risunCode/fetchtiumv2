# Getting Started

## Prerequisites

### Required

- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **Python 3.10+** - [Download Python](https://python.org/)

### Optional (for full functionality)

- **FFmpeg** - Required for HLS conversion and video-audio merge
- **yt-dlp** - Required for YouTube, SoundCloud, BiliBili, Twitch, Bandcamp
- **gallery-dl** - Required for Reddit, Pinterest, Weibo

### Installing Dependencies

**FFmpeg:**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

**Python tools:**
```bash
pip install yt-dlp gallery-dl flask httpx[http2]
# or
pip install -r requirements.txt
```

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-repo/fetchtiumv2.git
cd fetchtiumv2

# Install Node dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings (see [Configuration](Configuration.md)).

### 3. Run Development Server

```bash
npm run dev
```

This starts both Next.js (port 3000) and Python Flask (port 3001) servers.

### 4. Open the App

Visit [http://localhost:3000](http://localhost:3000)

## Test the API

```bash
# Health check
curl http://localhost:3000/health

# Status endpoint
curl http://localhost:3000/api/v1/status

# Extract media
curl -X POST http://localhost:3000/api/v1/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://twitter.com/user/status/123456789"}'
```

## Project Structure

```
fetchtiumv2/
├── api/
│   └── extract.py           # Python Flask extractors
├── src/
│   ├── app/
│   │   ├── api/v1/          # API routes
│   │   ├── docs/            # API documentation page
│   │   ├── changelog/       # Changelog page
│   │   └── page.tsx         # Main page
│   ├── components/          # React components
│   ├── hooks/               # Custom hooks
│   ├── lib/
│   │   ├── core/            # Network & parser
│   │   ├── extractors/      # TypeScript extractors
│   │   ├── middleware/      # Security middleware
│   │   └── utils/           # Utilities
│   └── types/               # TypeScript types
├── scripts/                 # Test scripts
├── public/                  # Static assets
├── .env.example             # Environment template
├── requirements.txt         # Python dependencies
└── package.json             # Node dependencies
```

## Available Scripts

```bash
# Development (Next.js + Python)
npm run dev

# Development (Next.js only)
npm run dev:next

# Development (Python only)
npm run dev:python

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Next Steps

- [API Reference](API-Reference.md) - Learn about all available endpoints
- [Configuration](Configuration.md) - Configure the server
- [Supported Platforms](Supported-Platforms.md) - See all supported platforms
