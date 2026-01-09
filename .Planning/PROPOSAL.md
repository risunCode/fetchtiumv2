# FetchtiumV2 — Technical Proposal

> Media Access Gateway Engine  
> Version: 0.1.0-draft  
> Last Updated: 2026-01-09

---

## 1. Executive Summary

**FetchtiumV2** adalah Media Access Gateway — bukan downloader biasa, bukan proxy polos.

**Filosofi utama:**
- Backend = pembuka akses, bukan pengirim data terus-menerus
- Frontend = pemutar media, bukan pengunduh
- Redirect dulu, relay kalau terpaksa
- Unknown lebih baik daripada angka palsu

---

## 2. Supported Platforms

### 2.1 Native Extended (Built-in Extractors)

| Platform | Status | Priority |
|----------|--------|----------|
| Facebook | 🎯 Active | P0 — Fokus utama |
| YouTube | 📦 Placeholder | P1 |
| Instagram | 📦 Placeholder | P1 |
| TikTok | 📦 Placeholder | P1 |
| Twitter/X | 📦 Placeholder | P1 |

### 2.2 Extended Engine (Dedicated, Bukan Fallback)

| Engine | Scope |
|--------|-------|
| yt-dlp | Multi-platform: video, audio, foto |
| gallery-dl | Multi-platform: video, audio, foto |

> **Note:** Extended engine = dedicated handler untuk platform yang TIDAK punya native extractor.  
> **BUKAN fallback.** Kalau native gagal, ya gagal — tidak jatuh ke extended.  
> Extended hanya jalan kalau platform memang tidak di-support native.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Single Page Dev UI (Tailwind)                            │  │
│  │  - Input URL                                              │  │
│  │  - Preview metadata                                       │  │
│  │  - Stream / Download button                               │  │
│  │  - <video> / <audio> embed                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FASTIFY SERVER                             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ /api/extract│  │ /api/stream │  │ /api/download           │  │
│  │             │  │             │  │                         │  │
│  │ URL → Meta  │  │ 302 Redirect│  │ Relay stream (fallback) │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    CORE ENGINE                              ││
│  │                                                             ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ ││
│  │  │ NetworkLayer  │  │ ParseEngine   │  │ MediaPipeline   │ ││
│  │  │               │  │               │  │                 │ ││
│  │  │ - Undici      │  │ - HTML Parser │  │ - Classifier    │ ││
│  │  │ - Keep-alive  │  │ - Regex Scope │  │ - State Machine │ ││
│  │  │ - Streaming   │  │ - Fragment    │  │ - Route Decide  │ ││
│  │  └───────────────┘  └───────────────┘  └─────────────────┘ ││
│  │                                                             ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ ││
│  │  │ MediaMimeHelp │  │ MediaSizeHelp │  │ Extractors      │ ││
│  │  │               │  │               │  │                 │ ││
│  │  │ - MIME detect │  │ - Exact size  │  │ - Facebook  🎯  │ ││
│  │  │ - Extension   │  │ - Estimated   │  │ - YouTube   📦  │ ││
│  │  │ - Sniff       │  │ - Unknown     │  │ - Instagram 📦  │ ││
│  │  └───────────────┘  └───────────────┘  │ - TikTok    📦  │ ││
│  │                                        │ - Twitter   📦  │ ││
│  │                                        └─────────────────┘ ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ Extended Engine (Dedicated, BUKAN fallback)             │││
│  │  │                                                         │││
│  │  │ - yt-dlp     → Platform tanpa native extractor          │││
│  │  │ - gallery-dl → Platform tanpa native extractor          │││
│  │  │                                                         │││
│  │  │ Native gagal ≠ jatuh ke extended                        │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Project Structure

```
FetchtiumV2/
├── package.json
├── .env.example
├── .gitignore
│
├── src/
│   ├── index.js                    # Entry point
│   ├── server.js                   # Fastify setup
│   │
│   ├── routes/
│   │   ├── index.js                # Route aggregator
│   │   ├── extract.route.js        # POST /api/extract
│   │   ├── stream.route.js         # GET  /api/stream/:id
│   │   └── download.route.js       # GET  /api/download/:id
│   │
│   ├── core/
│   │   ├── network/
│   │   │   ├── index.js
│   │   │   ├── client.js           # Undici client wrapper
│   │   │   └── headers.js          # Header utilities
│   │   │
│   │   ├── parser/
│   │   │   ├── index.js
│   │   │   ├── html.parser.js      # node-html-parser wrapper
│   │   │   └── regex.extractor.js  # Scoped regex utilities
│   │   │
│   │   └── media/
│   │       ├── index.js
│   │       ├── pipeline.js         # MediaPipeline state machine
│   │       ├── mime.helper.js      # MediaMimeHelper
│   │       └── size.helper.js      # MediaSizeHelper
│   │
│   ├── extractors/
│   │   ├── index.js                # Extractor registry
│   │   ├── base.extractor.js       # Base class / interface
│   │   │
│   │   ├── facebook/               # 🎯 FOKUS UTAMA
│   │   │   ├── index.js            # Main extractor
│   │   │   ├── scanner.js          # HTML scanning & pattern detection
│   │   │   ├── extract.js          # Data extraction logic
│   │   │   ├── patterns.js         # URL patterns & regex
│   │   │   └── normalizer.js       # Format normalization
│   │   │
│   │   ├── youtube/                # 📦 Placeholder
│   │   │   └── index.js
│   │   │
│   │   ├── instagram/              # 📦 Placeholder
│   │   │   └── index.js
│   │   │
│   │   ├── tiktok/                 # 📦 Placeholder
│   │   │   └── index.js
│   │   │
│   │   └── twitter/                # 📦 Placeholder
│   │       └── index.js
│   │
│   ├── extended/
│   │   ├── index.js                # Extended engine registry
│   │   │
│   │   ├── ytdlp/
│   │   │   ├── index.js            # Main wrapper
│   │   │   ├── executor.js         # Process execution
│   │   │   ├── parser.js           # Output parsing
│   │   │   └── normalizer.js       # Format normalization
│   │   │
│   │   └── gallerydl/
│   │       ├── index.js            # Main wrapper
│   │       ├── executor.js         # Process execution
│   │       ├── parser.js           # Output parsing
│   │       └── normalizer.js       # Format normalization
│   │
│   ├── utils/
│   │   ├── url.utils.js            # URL parsing, platform detect
│   │   ├── error.utils.js          # Custom errors
│   │   └── logger.js               # Pino wrapper
│   │
│   └── config/
│       └── index.js                # Environment config
│
├── public/
│   └── index.html                  # Single page dev UI (Tailwind)
│
└── tests/                          # Future: test files
    └── .gitkeep
```

---

## 5. Data Flow

### 5.1 Extract Flow

```
User Input URL
      │
      ▼
┌─────────────────┐
│ URL Utils       │ ──→ Detect platform (facebook/youtube/etc)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extractor       │ ──→ Platform-specific atau Generic
│ Registry        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Network Layer   │ ──→ Fetch HTML/API response
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse Engine    │ ──→ Extract media URLs dari response
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Media Pipeline  │ ──→ Classify & determine delivery strategy
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response        │ ──→ { mediaUrl, mime, size, streamable, ... }
└─────────────────┘
```

### 5.2 Stream/Download Decision

```
┌─────────────────────────────────────────────────────────┐
│                  DELIVERY STRATEGY                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Media URL accessible?                                 │
│         │                                               │
│    YES  │  NO                                           │
│    ▼    ▼                                               │
│  ┌────────────┐  ┌────────────────────────────────────┐ │
│  │ MODE A     │  │ MODE B                             │ │
│  │ REDIRECT   │  │ RELAY                              │ │
│  │            │  │                                    │ │
│  │ 302/307    │  │ Backend fetch → pipe → client      │ │
│  │ to CDN URL │  │                                    │ │
│  │            │  │ Used when:                         │ │
│  │ Zero       │  │ - URL requires auth/cookies        │ │
│  │ bandwidth  │  │ - CORS blocked                     │ │
│  │ backend    │  │ - URL expires quickly              │ │
│  └────────────┘  └────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. API Endpoints

### 6.1 POST /api/extract

**Request:**
```json
{
  "url": "https://www.facebook.com/watch?v=123456789"
}
```

**Response:**
```json
{
  "success": true,
  "platform": "facebook",
  "data": {
    "id": "abc123",
    "title": "Video Title",
    "thumbnail": "https://...",
    "duration": 120,
    "formats": [
      {
        "quality": "hd",
        "url": "https://...",
        "mime": "video/mp4",
        "size": 15000000,
        "sizeType": "exact"
      },
      {
        "quality": "sd",
        "url": "https://...",
        "mime": "video/mp4",
        "size": null,
        "sizeType": "unknown"
      }
    ]
  }
}
```

### 6.2 GET /api/stream/:id

**Behavior:**
- Default: 302 redirect ke media URL
- Fallback: Relay stream jika redirect tidak memungkinkan

**Query params:**
- `quality` — hd / sd / audio
- `relay` — force relay mode (true/false)

### 6.3 GET /api/download/:id

**Behavior:**
- Sama seperti stream, tapi dengan header:
  - `Content-Disposition: attachment`

---

## 7. Core Components Spec

### 7.1 NetworkLayer

```
Responsibilities:
├── HTTP client management (Undici)
├── Connection pooling & keep-alive
├── Request/response streaming
├── Header inspection
├── Abort handling
└── Timeout management

Rules:
├── TIDAK memutuskan data cukup atau tidak
├── TIDAK tahu ini media atau HTML
├── Hanya transport layer murni
└── Output: { headers, status, stream }
```

### 7.2 ParseEngine

```
Responsibilities:
├── HTML fragment parsing (node-html-parser)
├── Scoped regex extraction
├── Boundary detection (<script>, markers)
└── Streaming buffer (sliding window)

Rules:
├── TIDAK parse full HTML
├── TIDAK regex seluruh HTML
├── Mulai parse saat structural stability
└── Output: extracted data fragments
```

### 7.3 MediaPipeline

```
Responsibilities:
├── Media classification
├── State machine management
├── Delivery strategy decision
└── Format normalization

States:
├── INIT → URL received
├── FETCHING → Getting source
├── PARSING → Extracting media
├── CLASSIFIED → Media info ready
├── READY → Delivery strategy decided
└── ERROR → Something went wrong

Output:
├── kind: video | audio | image | playlist
├── streaming: boolean
├── container: mp4 | webm | mpegts | ...
├── deliveryMode: redirect | relay
└── formats: array of available qualities
```

### 7.4 MediaMimeHelper

```
Responsibilities:
├── MIME type detection
├── Extension mapping
├── Content sniffing (light)
└── Format validation

Input sources:
├── Content-Type header
├── URL extension
├── Magic bytes (optional)
└── Platform hints

Output:
├── mime: string
├── extension: string
├── category: video | audio | image
└── confidence: high | medium | low
```

### 7.5 MediaSizeHelper

```
Responsibilities:
├── File size determination
├── Anti HEAD-bohong detection
├── Stream-aware estimation
└── Honest reporting

Size types:
├── exact → Content-Length valid & trusted
├── estimated → Calculated from bitrate/duration
├── unknown → Cannot determine, don't lie

Rules:
├── HEAD response bisa bohong
├── Beberapa CDN tidak kasih Content-Length
├── Unknown lebih baik dari angka palsu
└── Always report sizeType alongside size
```

---

## 8. Extractor Interface

### 8.1 Base Extractor Contract

```
class BaseExtractor {
  
  // Platform identifier
  static platform = 'base'
  
  // URL patterns yang di-handle
  static patterns = []
  
  // Check apakah URL match
  static match(url) → boolean
  
  // Main extraction
  async extract(url, options) → ExtractResult
  
  // Optional: refresh expired URL
  async refresh(mediaId) → ExtractResult
}
```

### 8.2 ExtractResult Schema

```
{
  id: string,
  platform: string,
  url: string,
  title: string,
  description?: string,
  thumbnail?: string,
  duration?: number,        // seconds
  uploadDate?: string,
  uploader?: {
    name: string,
    url?: string
  },
  formats: [
    {
      formatId: string,
      quality: string,      // hd, sd, 1080p, 720p, audio
      url: string,
      mime: string,
      size?: number,
      sizeType: 'exact' | 'estimated' | 'unknown',
      width?: number,
      height?: number,
      bitrate?: number,
      hasAudio: boolean,
      hasVideo: boolean,
      expiresAt?: number    // timestamp
    }
  ],
  _raw?: object             // debug: raw extracted data
}
```

---

## 9. Facebook Extractor Detail

> 🎯 Fokus utama development

### 9.1 Supported URL Patterns

```
- facebook.com/watch?v={id}
- facebook.com/{user}/videos/{id}
- facebook.com/reel/{id}
- facebook.com/story.php?story_fbid={id}
- fb.watch/{shortcode}
- m.facebook.com/...
```

### 9.2 Extraction Strategy

```
┌─────────────────────────────────────────────────────────┐
│              FACEBOOK EXTRACTION FLOW                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Fetch HTML (mobile UA lebih reliable)               │
│         │                                               │
│         ▼                                               │
│  2. Find <script> dengan data marker                    │
│     - "playable_url"                                    │
│     - "browser_native_hd_url"                           │
│     - "browser_native_sd_url"                           │
│         │                                               │
│         ▼                                               │
│  3. Regex extract JSON fragment                         │
│         │                                               │
│         ▼                                               │
│  4. Parse & normalize ke ExtractResult                  │
│         │                                               │
│         ▼                                               │
│  5. Validate URLs (some might be expired)               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 9.3 Known Challenges

| Challenge | Mitigation |
|-----------|------------|
| URL expires cepat | Cache metadata, refresh URL on-demand |
| Login-wall content | Return error, suggest login (future: cookie support) |
| Rate limiting | Request throttling, rotating headers |
| HTML structure berubah | Multiple fallback patterns |

---

## 10. Frontend Dev UI

### 10.1 Scope

- Single HTML page
- Tailwind CSS (CDN)
- Vanilla JS (no framework)
- Development/testing only

### 10.2 Features

```
┌─────────────────────────────────────────────────────────┐
│  FetchtiumV2 Dev UI                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔗 Paste URL here...                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                         [ Extract ]     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │              Video Preview                      │   │
│  │              (if available)                     │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Title: Video Title Here                                │
│  Platform: facebook                                     │
│  Duration: 2:30                                         │
│                                                         │
│  Formats:                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ HD (1080p) - 15 MB     [ Stream ] [ Download ] │   │
│  │ SD (480p)  - ~8 MB     [ Stream ] [ Download ] │   │
│  │ Audio only - 2 MB      [ Stream ] [ Download ] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Debug Output (JSON)                             │   │
│  │ { ... }                                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 11. Tech Stack Summary

| Layer | Technology | Reason |
|-------|------------|--------|
| Runtime | Node.js LTS | Long-lived process, streaming support |
| Server | Fastify | Fast, streaming-friendly, clean lifecycle |
| HTTP Client | Undici | Connection pooling, keep-alive, streaming |
| HTML Parse | node-html-parser | Lightweight, fragment-based |
| Logging | Pino | Built-in Fastify, fast |
| Frontend | Tailwind (CDN) | Quick dev UI, no build step |
| Extended | yt-dlp | Dedicated engine untuk platform non-native |
| Extended | gallery-dl | Dedicated engine untuk platform non-native |

---

## 12. Development Phases

### Phase 0: Foundation ✅
- Mental model alignment
- Architecture decision

### Phase 1: Project Setup
- [ ] Initialize project structure
- [ ] Setup Fastify server
- [ ] Basic routing
- [ ] Environment config
- [ ] Logger setup

### Phase 2: Core Engine
- [ ] NetworkLayer implementation
- [ ] ParseEngine implementation
- [ ] MediaPipeline skeleton

### Phase 3: Helpers
- [ ] MediaMimeHelper
- [ ] MediaSizeHelper
- [ ] URL utilities

### Phase 4: Facebook Extractor 🎯
- [ ] URL pattern matching
- [ ] HTML fetching
- [ ] Data extraction
- [ ] Format normalization

### Phase 5: API Routes
- [ ] /api/extract endpoint
- [ ] /api/stream endpoint
- [ ] /api/download endpoint

### Phase 6: Frontend Dev UI
- [ ] Single page HTML
- [ ] Tailwind styling
- [ ] Extract form
- [ ] Result display
- [ ] Stream/download buttons

### Phase 7: Polish
- [ ] Error handling
- [ ] Edge cases
- [ ] Placeholder extractors

---

## 13. Non-Goals (Out of Scope)

- ❌ User authentication
- ❌ Database / persistence
- ❌ Queue system
- ❌ Production deployment config
- ❌ Full implementation of all extractors
- ❌ Mobile app
- ❌ Browser extension

---

## 14. Open Questions

1. **Cookie support** — Perlu untuk private content?
2. **Caching strategy** — In-memory atau file-based?
3. **Rate limiting** — Per-IP atau global?
4. **Error reporting** — Format standar?

---

*Document ini akan di-update seiring development.*
