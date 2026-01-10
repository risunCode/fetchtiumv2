# FetchtiumV2

Media Access Gateway Engine — bukan downloader biasa, bukan proxy polos.

## Features

- 🎬 **Facebook Extractor** - Videos, Reels, Stories, Posts, Galleries
- 🔐 **Cookie Authentication** - Support Netscape & JSON format
- 📊 **Engagement Stats** - Views, likes, comments, shares
- ⚡ **Streaming Architecture** - Memory efficient, no size limits
- 🎯 **Smart Retry** - Auto retry with cookies on auth errors
- 📥 **Direct Download** - Zero backend bandwidth when possible

## Supported Content

| Platform | Type | Status |
|----------|------|--------|
| Facebook | Videos | ✅ Active |
| Facebook | Reels | ✅ Active |
| Facebook | Stories | ✅ Active |
| Facebook | Posts (images) | ✅ Active |
| Facebook | Galleries | ✅ Active |
| Facebook | Groups | ✅ Active |
| YouTube | - | 📦 Planned |
| Instagram | - | 📦 Planned |
| TikTok | - | 📦 Planned |
| Twitter/X | - | 📦 Planned |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Open browser
http://127.0.0.1:3000
```

## API

### POST /api/extract

Extract media from URL.

**Request:**
```json
{
  "url": "https://www.facebook.com/reel/123456789"
}
```

**Response:**
```json
{
  "success": true,
  "platform": "facebook",
  "contentType": "reel",
  "title": "Video Title",
  "author": "Author Name",
  "stats": {
    "views": 15000,
    "likes": 500,
    "comments": 50,
    "shares": 20
  },
  "items": [
    {
      "index": 0,
      "type": "video",
      "thumbnail": "https://...",
      "sources": [
        {
          "quality": "hd",
          "url": "https://...",
          "resolution": "1280x720",
          "mime": "video/mp4",
          "size": 15000000
        }
      ]
    }
  ]
}
```

### GET /api/download

Proxy download for CORS-blocked URLs.

```
GET /api/download?url=https://...
```

## Cookie Setup

For private content (stories, some reels), add cookies:

1. Export cookies from browser (EditThisCookie, Cookie-Editor)
2. Save as `tests/cookies_fb/fb_netscape.txt` or `fb_json.txt`
3. Server auto-loads on startup

**Netscape format:**
```
.facebook.com	TRUE	/	TRUE	1234567890	c_user	123456789
.facebook.com	TRUE	/	TRUE	1234567890	xs	abc123...
```

**JSON format:**
```json
[
  {"name": "c_user", "value": "123456789", "domain": ".facebook.com"},
  {"name": "xs", "value": "abc123...", "domain": ".facebook.com"}
]
```

## Environment Variables

```env
PORT=3000
HOST=127.0.0.1
NODE_ENV=development
LOG_LEVEL=info
REQUEST_TIMEOUT=30000
MAX_REDIRECTS=10
```

## Project Structure

```
FetchtiumV2/
├── src/
│   ├── index.js              # Entry point
│   ├── server.js             # Fastify server
│   ├── routes/               # API routes
│   ├── core/                 # Core modules
│   │   ├── network/          # HTTP client, cookies
│   │   ├── parser/           # HTML parser, regex
│   │   └── media/            # Media pipeline
│   ├── extractors/           # Platform extractors
│   │   └── facebook/         # Facebook extractor
│   └── utils/                # Utilities
├── public/
│   └── index.html            # Frontend UI
└── tests/
    └── cookies_fb/           # Cookie files
```

## Error Codes

| Code | Description |
|------|-------------|
| `AGE_RESTRICTED` | Content is age-restricted (18+) |
| `PRIVATE_CONTENT` | Content is private or unavailable |
| `STORY_EXPIRED` | Story has expired or been deleted |
| `LOGIN_REQUIRED` | Login required to access |
| `NO_MEDIA_FOUND` | No media found in content |
| `FETCH_FAILED` | Failed to fetch page |
| `TIMEOUT` | Request timeout |

## Architecture

```
Client Request
     │
     ▼
┌─────────────┐
│ /api/extract│ → URL validation → Platform detection
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Extractor  │ → Fetch HTML (streaming) → Extract media URLs
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Response   │ → Normalized JSON with media URLs
└─────────────┘
       │
       ▼
┌─────────────┐
│   Client    │ → Direct download from CDN (or proxy fallback)
└─────────────┘
```

## License

MIT
