# Requirements Document

## Introduction

Add support for additional platforms using Python-based extractors (yt-dlp and gallery-dl) running as Vercel serverless functions alongside the existing Next.js application.

### New Platforms
- **BiliBili** - Chinese video platform (gallery-dl)
- **Reddit** - Social media with video/image posts (gallery-dl)
- **SoundCloud** - Audio streaming platform (yt-dlp)
- **Pixiv** - Japanese art platform (gallery-dl) 🔞
- **Eporner** - Adult video platform (gallery-dl) 🔞
- **Rule34Video** - Adult video platform (gallery-dl) 🔞

## Glossary

- **yt-dlp**: Python-based media downloader, fork of youtube-dl with additional features
- **gallery-dl**: Python-based image/video downloader for various platforms
- **Vercel_Python_Function**: Serverless Python function hosted on Vercel alongside Next.js
- **FastAPI**: Modern Python web framework for building APIs

## Requirements

### Requirement 1: Python Function Infrastructure

**User Story:** As a developer, I want to run Python functions alongside Next.js, so that I can use yt-dlp and gallery-dl for extraction.

#### Acceptance Criteria

1. THE System SHALL have a `/api/` directory at project root for Python serverless functions
2. THE System SHALL have a `requirements.txt` file with yt-dlp and gallery-dl dependencies
3. THE System SHALL configure `vercel.json` to exclude Next.js files from Python function builds
4. THE System SHALL configure `next.config.ts` rewrites for local development
5. WHEN running locally, THE System SHALL use concurrently to run both Next.js and FastAPI servers
6. THE Python_Function size SHALL NOT exceed Vercel's 250MB unzipped limit

### Requirement 2: Python Extractor API

**User Story:** As a developer, I want a unified Python API endpoint, so that the Next.js frontend can call Python extractors.

#### Acceptance Criteria

1. THE Python_API SHALL expose a POST endpoint at `/api/py/extract`
2. WHEN receiving a URL, THE Python_API SHALL detect the platform and use appropriate extractor
3. THE Python_API SHALL return JSON response matching the existing ExtractResult format
4. IF extraction fails, THE Python_API SHALL return error response with code and message
5. THE Python_API SHALL support optional cookie parameter for authenticated content

### Requirement 3: BiliBili Extractor

**User Story:** As a user, I want to extract media from BiliBili, so that I can download Chinese video content.

#### Acceptance Criteria

1. THE System SHALL detect BiliBili URLs (bilibili.com, b23.tv)
2. WHEN extracting BiliBili video, THE Extractor SHALL return video URL, title, author, thumbnail
3. THE Extractor SHALL support multiple quality options if available
4. IF video is region-locked, THE Extractor SHALL return appropriate error

### Requirement 4: Reddit Extractor

**User Story:** As a user, I want to extract media from Reddit, so that I can download videos and images from posts.

#### Acceptance Criteria

1. THE System SHALL detect Reddit URLs (reddit.com, redd.it, v.redd.it)
2. WHEN extracting Reddit post, THE Extractor SHALL return video/image URLs
3. THE Extractor SHALL handle Reddit's DASH video format (separate video/audio streams)
4. THE Extractor SHALL support gallery posts with multiple images
5. IF post is from private subreddit, THE Extractor SHALL return appropriate error

### Requirement 5: SoundCloud Extractor

**User Story:** As a user, I want to extract audio from SoundCloud, so that I can download music tracks.

#### Acceptance Criteria

1. THE System SHALL detect SoundCloud URLs (soundcloud.com)
2. WHEN extracting SoundCloud track, THE Extractor SHALL return audio URL, title, artist, artwork
3. THE Extractor SHALL return highest available audio quality
4. THE Extractor SHALL support playlist extraction (return multiple items)
5. IF track is private or removed, THE Extractor SHALL return appropriate error

### Requirement 6: Pixiv Extractor (NSFW)

**User Story:** As a user, I want to extract images from Pixiv, so that I can download artwork.

#### Acceptance Criteria

1. THE System SHALL detect Pixiv URLs (pixiv.net)
2. WHEN extracting Pixiv artwork, THE Extractor SHALL return image URLs, title, artist
3. THE Extractor SHALL support multi-page illustrations (manga)
4. THE Extractor SHALL support ugoira (animated illustrations) as video
5. WHEN cookie is provided, THE Extractor SHALL access R-18 content
6. IF artwork requires login, THE Extractor SHALL return LOGIN_REQUIRED error

### Requirement 7: Eporner Extractor (NSFW)

**User Story:** As a user, I want to extract videos from Eporner, so that I can download adult content.

#### Acceptance Criteria

1. THE System SHALL detect Eporner URLs (eporner.com)
2. WHEN extracting Eporner video, THE Extractor SHALL return video URL, title, thumbnail
3. THE Extractor SHALL support multiple quality options (240p to 1080p+)
4. IF video is removed, THE Extractor SHALL return DELETED_CONTENT error

### Requirement 8: Rule34Video Extractor (NSFW)

**User Story:** As a user, I want to extract videos from Rule34Video, so that I can download adult content.

#### Acceptance Criteria

1. THE System SHALL detect Rule34Video URLs (rule34video.com)
2. WHEN extracting Rule34Video, THE Extractor SHALL return video URL, title, tags, thumbnail
3. THE Extractor SHALL support multiple quality options if available
4. IF video is removed, THE Extractor SHALL return DELETED_CONTENT error

### Requirement 9: Frontend Integration

**User Story:** As a user, I want to use Python extractors through the same UI, so that the experience is consistent.

#### Acceptance Criteria

1. THE Frontend SHALL detect Python-supported platforms and route to Python API
2. THE Frontend SHALL display results from Python extractors in the same format
3. THE Frontend SHALL handle Python API errors gracefully
4. THE System SHALL add platform icons/badges for new platforms

### Requirement 10: NSFW Content Handling

**User Story:** As a developer, I want to properly handle NSFW content, so that users are aware of content type.

#### Acceptance Criteria

1. THE System SHALL mark NSFW platforms (Pixiv R-18, Eporner, Rule34Video) in response
2. THE Frontend MAY display NSFW warning before showing results
3. THE System SHALL NOT cache NSFW thumbnails on server

