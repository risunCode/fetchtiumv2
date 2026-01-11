# Requirements Document

## Introduction

Fix several bugs and improvements identified in the multi-platform extractors implementation:
1. Quality/resolution helper functions are duplicated and incomplete (missing 144p, 540p, 2K, 4K)
2. Frontend download is broken - using raw URL instead of hash
3. Twitter retweet extraction fails - need to follow retweet to original tweet

## Glossary

- **Bitrate_Helper**: Shared utility functions for converting video bitrate to quality labels and resolutions
- **Hash**: Encrypted/encoded URL token used for secure download/stream endpoints
- **Retweet**: Twitter post that shares another user's tweet
- **Quote_Tweet**: Twitter post that includes another tweet with additional commentary

## Requirements

### Requirement 1: Shared Quality/Resolution Helpers

**User Story:** As a developer, I want centralized quality/resolution helper functions, so that all extractors use consistent quality labels and support all common resolutions.

#### Acceptance Criteria

1. THE System SHALL provide a shared `getQualityFromBitrate` function in `src/lib/utils/quality.utils.ts`
2. THE System SHALL provide a shared `getResolutionFromBitrate` function in the same file
3. WHEN bitrate >= 8000000, THE Helper SHALL return '4K' quality and '3840x2160' resolution
4. WHEN bitrate >= 4000000, THE Helper SHALL return '2K' quality and '2560x1440' resolution
5. WHEN bitrate >= 2000000, THE Helper SHALL return '1080p' quality and '1920x1080' resolution
6. WHEN bitrate >= 1000000, THE Helper SHALL return '720p' quality and '1280x720' resolution
7. WHEN bitrate >= 600000, THE Helper SHALL return '540p' quality and '960x540' resolution
8. WHEN bitrate >= 400000, THE Helper SHALL return '480p' quality and '854x480' resolution
9. WHEN bitrate >= 200000, THE Helper SHALL return '360p' quality and '640x360' resolution
10. WHEN bitrate >= 100000, THE Helper SHALL return '240p' quality and '426x240' resolution
11. WHEN bitrate < 100000, THE Helper SHALL return '144p' quality and '256x144' resolution
12. THE Twitter_Extractor SHALL use the shared helper functions instead of local implementations

### Requirement 2: Fix Frontend Download Using Hash

**User Story:** As a user, I want to download media files, so that I can save content to my device.

#### Acceptance Criteria

1. WHEN source has a hash property, THE FormatList component SHALL use hash parameter (`h=`) for download URL
2. WHEN source has no hash property, THE FormatList component SHALL fall back to url parameter
3. THE Download_URL format SHALL be `/api/v1/download?h={hash}&filename={filename}` when hash is available
4. THE Download_URL format SHALL be `/api/v1/download?url={url}&filename={filename}` when hash is not available
5. WHEN downloading all items, THE FormatList component SHALL use the same hash-first logic

### Requirement 3: Fix Twitter Retweet Extraction

**User Story:** As a user, I want to extract media from retweet URLs, so that I can download content shared via retweets.

#### Acceptance Criteria

1. WHEN a tweet is a retweet (has `retweeted_status` or `retweeted_status_result`), THE Twitter_Extractor SHALL extract media from the original tweet
2. WHEN parsing Syndication response, THE Parser SHALL check for `retweeted_status` field
3. WHEN parsing GraphQL response, THE Parser SHALL check for `retweeted_status_result` in legacy data
4. WHEN retweet is detected, THE Parser SHALL use the original tweet's media, author, and metadata
5. THE Response SHALL indicate the content is from a retweet in the description or metadata

</content>
</invoke>