# Requirements Document

## Introduction

Add support for Instagram, Twitter/X, and TikTok media extraction to FetchtiumV2. This extends the existing Facebook extractor architecture to support multiple social media platforms with consistent API response format.

## Glossary

- **Extractor**: Module that fetches and parses media from a specific platform
- **Scanner**: Component that fetches raw HTML/JSON from platform
- **Parser**: Component that extracts media URLs from raw response
- **Cookie_Pool**: Collection of authenticated cookies for private content access
- **TikWM**: Third-party API service for TikTok media extraction
- **Syndication_API**: Twitter's public API for tweet data (no auth required)
- **GraphQL_API**: Instagram/Twitter authenticated API endpoints
- **Shortcode**: Instagram's unique identifier for posts (e.g., `CxYz123`)
- **Media_ID**: Numeric identifier converted from shortcode

## Requirements

### Requirement 1: Instagram Extractor

**User Story:** As a user, I want to extract media from Instagram posts, reels, and carousels, so that I can download Instagram content.

#### Acceptance Criteria

1. WHEN a user provides an Instagram URL (instagram.com/p/*, /reel/*, /tv/*), THE Instagram_Extractor SHALL detect and handle the URL
2. WHEN extracting public content, THE Instagram_Extractor SHALL try GraphQL API without cookie first
3. WHEN GraphQL fails or returns no media, THE Instagram_Extractor SHALL retry with server cookie using Internal API (/api/v1/media/{id}/info/)
4. WHEN server cookie fails, THE Instagram_Extractor SHALL retry with client cookie if provided
5. WHEN parsing Instagram response, THE Parser SHALL extract video URLs with quality labels (HD)
6. WHEN parsing carousel posts, THE Parser SHALL extract all images and videos in order
7. WHEN extracting metadata, THE Instagram_Extractor SHALL return author username, caption, likes, comments, and views
8. THE Instagram_Extractor SHALL convert shortcode to media_id using base64 decoding for Internal API

### Requirement 2: Twitter/X Extractor

**User Story:** As a user, I want to extract media from Twitter/X tweets, so that I can download Twitter videos and images.

#### Acceptance Criteria

1. WHEN a user provides a Twitter URL (twitter.com/*/status/*, x.com/*/status/*), THE Twitter_Extractor SHALL detect and handle the URL
2. WHEN extracting content, THE Twitter_Extractor SHALL try Syndication API first (no cookie required)
3. WHEN Syndication API fails, THE Twitter_Extractor SHALL retry with server cookie using GraphQL API
4. WHEN server cookie fails, THE Twitter_Extractor SHALL retry with client cookie if provided
5. WHEN parsing video tweets, THE Parser SHALL extract all quality variants (720p, 480p, 360p) sorted by bitrate
6. WHEN parsing image tweets, THE Parser SHALL extract all photos in original quality
7. WHEN parsing mixed media tweets, THE Parser SHALL extract both videos and images
8. WHEN extracting metadata, THE Twitter_Extractor SHALL return author name, username, tweet text, likes, retweets, and replies

### Requirement 3: TikTok Extractor

**User Story:** As a user, I want to extract media from TikTok videos and slideshows, so that I can download TikTok content.

#### Acceptance Criteria

1. WHEN a user provides a TikTok URL (tiktok.com/@*/video/*, vm.tiktok.com/*), THE TikTok_Extractor SHALL detect and handle the URL
2. WHEN extracting content, THE TikTok_Extractor SHALL use TikWM API (no cookie required)
3. WHEN TikWM returns video, THE Parser SHALL extract HD and SD quality URLs
4. WHEN TikWM returns slideshow (images array), THE Parser SHALL extract all image URLs
5. WHEN extracting metadata, THE TikTok_Extractor SHALL return author name, username, description, views, likes, comments, and shares
6. THE TikTok_Extractor SHALL include video duration and thumbnail URL

### Requirement 4: Cookie Management

**User Story:** As a user, I want to provide cookies for private content, so that I can access authenticated Instagram and Twitter content.

#### Acceptance Criteria

1. THE Cookie_Modal SHALL support saving cookies for Instagram and Twitter platforms
2. WHEN cookies are saved, THE System SHALL store them in localStorage with platform prefix (ck_instagram, ck_twitter)
3. WHEN extracting content, THE Frontend SHALL send client cookie to backend if available for the platform
4. THE Backend SHALL implement 3-tier cookie strategy: Guest → Server Cookie → Client Cookie
5. WHEN parsing Netscape cookie format, THE Cookie_Parser SHALL convert to HTTP header format (name=value; name2=value2)
6. FOR Instagram cookies, THE System SHALL extract csrftoken for X-CSRFToken header
7. FOR Twitter cookies, THE System SHALL extract ct0 for X-Csrf-Token header

### Requirement 5: Unified Response Format

**User Story:** As a developer, I want consistent API response format across all platforms, so that the frontend can handle all platforms uniformly.

#### Acceptance Criteria

1. THE Extract_API SHALL return the same ExtractResult structure for all platforms
2. WHEN extraction succeeds, THE Response SHALL include: platform, contentType, title, author, items[], meta
3. WHEN extraction fails, THE Response SHALL include: error.code, error.message, meta
4. THE items[] array SHALL contain MediaItem objects with: index, type (video/image/audio), thumbnail, sources[]
5. THE sources[] array SHALL contain MediaSource objects with: quality, url, resolution, mime, size, filename, hash
6. THE Response SHALL include cookieSource field indicating which cookie tier was used (none/server/client)

### Requirement 6: Platform Detection

**User Story:** As a user, I want the system to automatically detect the platform from URL, so that I don't need to specify which extractor to use.

#### Acceptance Criteria

1. WHEN a URL is provided, THE Extractor_Registry SHALL detect platform from URL patterns
2. THE System SHALL support these URL patterns for Instagram: instagram.com, instagr.am
3. THE System SHALL support these URL patterns for Twitter: twitter.com, x.com, t.co
4. THE System SHALL support these URL patterns for TikTok: tiktok.com, vm.tiktok.com, vt.tiktok.com
5. WHEN platform is not supported, THE System SHALL return UNSUPPORTED_PLATFORM error

### Requirement 7: Error Handling

**User Story:** As a user, I want clear error messages when extraction fails, so that I understand why content cannot be downloaded.

#### Acceptance Criteria

1. WHEN Instagram returns login required, THE System SHALL return LOGIN_REQUIRED error
2. WHEN Twitter returns protected/suspended account, THE System SHALL return PRIVATE_CONTENT error
3. WHEN TikTok returns video not found, THE System SHALL return CONTENT_NOT_FOUND error
4. WHEN API rate limit is hit, THE System SHALL return RATE_LIMITED error
5. WHEN network timeout occurs, THE System SHALL return TIMEOUT error
6. WHEN no media found in response, THE System SHALL return NO_MEDIA_FOUND error
