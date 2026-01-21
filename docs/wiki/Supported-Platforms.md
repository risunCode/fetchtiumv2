# Supported Platforms

FetchtiumV2 supports 16+ platforms through two types of extractors:

## Native Extractors (TypeScript)

Native extractors are written in TypeScript, providing the best performance with no external dependencies.

| Platform | Videos | Images | Stories | Reels | Notes |
|----------|--------|--------|---------|-------|-------|
| **Facebook** | ✅ | ✅ | ✅ | ✅ | Posts, Groups, Watch |
| **Instagram** | ✅ | ✅ | ✅ | ✅ | Posts, IGTV, Carousel |
| **TikTok** | ✅ | ✅ | - | - | Videos, Slideshows |
| **Twitter/X** | ✅ | ✅ | - | - | Tweets, Spaces |
| **Pixiv** | - | ✅ | - | - | Illustrations, Manga, Ugoira |

### Facebook

```bash
# Supported URLs
https://www.facebook.com/watch?v=123456789
https://www.facebook.com/user/videos/123456789
https://www.facebook.com/reel/123456789
https://www.facebook.com/stories/123456789
https://fb.watch/abc123
```

**Features:**
- Guest-first approach with automatic cookie retry
- Stories always use cookies (required)
- Engagement stats extraction
- Content issue detection (age-restricted, private, deleted)

### Instagram

```bash
# Supported URLs
https://www.instagram.com/p/ABC123/
https://www.instagram.com/reel/ABC123/
https://www.instagram.com/reels/ABC123/
https://www.instagram.com/stories/username/123456789/
https://www.instagram.com/tv/ABC123/
```

**Features:**
- Posts, Reels, Stories, IGTV
- Carousel/gallery support
- Private content with cookie

### Twitter/X

```bash
# Supported URLs
https://twitter.com/user/status/123456789
https://x.com/user/status/123456789
```

**Features:**
- Video tweets
- Twitter Spaces
- Cookie support for protected tweets

### TikTok

```bash
# Supported URLs
https://www.tiktok.com/@user/video/123456789
https://vm.tiktok.com/ABC123/
```

**Features:**
- Videos and slideshows
- Multiple quality options

### Pixiv

```bash
# Supported URLs
https://www.pixiv.net/artworks/123456789
https://www.pixiv.net/en/artworks/123456789
```

**Features:**
- Single and multi-page artwork
- Original quality images
- Automatic Referer header handling
- Cookie required for R-18 content

---

## Python Extractors (yt-dlp / gallery-dl)

Python extractors use yt-dlp or gallery-dl as backends, supporting a wide range of platforms.

### yt-dlp Based

| Platform | Type | Notes |
|----------|------|-------|
| **YouTube** | Video/Audio | HLS streaming, quality selection, codec info |
| **SoundCloud** | Audio | Multiple formats (MP3, AAC, Opus) |
| **BiliBili** | Video | DASH merge (video+audio), 144p-720p |
| **Twitch** | Video | Clips & VODs |
| **Bandcamp** | Audio | Track extraction |
| **Eporner** | Video | NSFW, multi-format (240p-1080p 60fps) |
| **Rule34Video** | Video | NSFW, multi-format (360p-4K) |

### gallery-dl Based

| Platform | Type | Notes |
|----------|------|-------|
| **Reddit** | Video/Image | Gallery support |
| **Pinterest** | Image | Pin extraction |
| **Weibo** | Video/Image | Posts, Stories |

---

## Platform-Specific Notes

### YouTube

- Requires yt-dlp installed
- Returns all available qualities (144p to 4K+)
- Includes codec info (H.264, VP9, AV1)
- HLS streams can be proxied via `/api/v1/hls-proxy`
- Separate video/audio can be merged via `/api/v1/merge`

**Quality Selection:**
- 1 format per resolution (deduplication by height)
- Priority: hasAudio > H.264 > VP9 > AV1
- Audio: AAC ~128kbps + Opus ~128kbps

### SoundCloud

- Requires yt-dlp installed
- Returns HLS streams
- Use `/api/v1/hls-stream?type=audio` for MP3 conversion
- Opus format marked as ⚡ Experimental

### BiliBili

- Requires yt-dlp installed
- Returns separate video (.m4s) and audio (.m4s) streams
- Use `/api/v1/merge` for combined output
- Short URLs (b23.tv) automatically resolved

### Instagram

- Private content requires cookie
- Stories expire after 24 hours
- Supports carousel posts (multiple images/videos)
- Internal API used for better quality

### Pixiv

- Cookie required for R-18 content
- Images require Referer header (handled by proxy)
- Thumbnail proxy available via `/api/v1/thumbnail`

---

## Cookie Support

Some platforms require authentication cookies for:
- Private content
- Age-restricted content
- Higher quality options

### Providing Cookies

**Via API:**
```json
{
  "url": "https://instagram.com/p/private_post/",
  "cookie": "sessionid=abc123; csrftoken=xyz789"
}
```

**Via UI:**
Click the 🍪 button to open the Cookie Modal and paste your cookies.

### Cookie Formats Supported

1. **Raw string**: `name=value; name2=value2`
2. **Netscape format**: Standard cookie.txt format
3. **JSON format**: `[{"name": "...", "value": "..."}]`

The system automatically converts between formats as needed.

---

## Platform Detection

FetchtiumV2 automatically detects the platform from the URL:

```
facebook.com, fb.watch     → Facebook (TypeScript)
instagram.com              → Instagram (TypeScript)
twitter.com, x.com         → Twitter (TypeScript)
tiktok.com, vm.tiktok.com  → TikTok (TypeScript)
pixiv.net                  → Pixiv (TypeScript)
youtube.com, youtu.be      → YouTube (Python/yt-dlp)
soundcloud.com             → SoundCloud (Python/yt-dlp)
bilibili.com, b23.tv       → BiliBili (Python/yt-dlp)
twitch.tv                  → Twitch (Python/yt-dlp)
bandcamp.com               → Bandcamp (Python/yt-dlp)
reddit.com, redd.it        → Reddit (Python/gallery-dl)
pinterest.com, pin.it      → Pinterest (Python/gallery-dl)
weibo.com                  → Weibo (Python/gallery-dl)
eporner.com                → Eporner (Python/yt-dlp) [NSFW]
rule34video.com            → Rule34Video (Python/yt-dlp) [NSFW]
```

---

## NSFW Platforms

NSFW platforms are marked in the response:

```json
{
  "success": true,
  "platform": "eporner",
  "isNsfw": true,
  ...
}
```

NSFW platforms:
- Eporner
- Rule34Video
