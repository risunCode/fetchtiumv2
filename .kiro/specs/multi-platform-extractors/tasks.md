# Implementation Plan: Multi-Platform Extractors

## Overview

Implement Instagram, Twitter/X, and TikTok extractors following the existing Facebook extractor pattern. Each platform has its own extraction strategy based on available APIs.

## Tasks

- [x] 1. Update Extractor Registry
  - [x] 1.1 Add platform patterns for Instagram, Twitter, TikTok
    - Update PLATFORM_PATTERNS in src/lib/extractors/index.ts
    - Add URL regex patterns for each platform
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 1.2 Register new extractors in getExtractor function
    - Import and instantiate Instagram, Twitter, TikTok extractors
    - _Requirements: 6.1_
  - [ ]* 1.3 Write property test for platform detection
    - **Property 1: Platform Detection Accuracy**
    - **Validates: Requirements 1.1, 2.1, 3.1, 6.1-6.4**

- [x] 2. Implement TikTok Extractor (simplest - no cookie)
  - [x] 2.1 Create TikTok scanner (src/lib/extractors/tiktok/scanner.ts)
    - Implement URL pattern detection
    - Implement fetchTikWM function
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 Create TikTok extract (src/lib/extractors/tiktok/extract.ts)
    - Implement parseTikWM for video and slideshow
    - Extract HD/SD quality URLs
    - Extract metadata (author, stats, duration)
    - _Requirements: 3.3, 3.4, 3.5, 3.6_
  - [x] 2.3 Create TikTok index (src/lib/extractors/tiktok/index.ts)
    - Implement TikTokExtractor class extending BaseExtractor
    - Wire scanner and parser together
    - _Requirements: 3.1_
  - [ ]* 2.4 Write unit tests for TikTok parser
    - Test video parsing (HD/SD)
    - Test slideshow parsing (images array)
    - _Requirements: 3.3, 3.4_

- [x] 3. Checkpoint - TikTok Extractor
  - Ensure TikTok extraction works with real URL
  - Verify response format matches ExtractResult schema

- [x] 4. Implement Twitter Extractor
  - [x] 4.1 Create Twitter scanner (src/lib/extractors/twitter/scanner.ts)
    - Implement URL pattern detection (twitter.com, x.com)
    - Implement extractTweetInfo (tweetId, username)
    - Implement fetchSyndication (public API)
    - Implement fetchGraphQL (with cookie)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 4.2 Create Twitter extract (src/lib/extractors/twitter/extract.ts)
    - Implement parseSyndication
    - Implement parseGraphQL
    - Extract video variants sorted by bitrate
    - Extract photos in original quality
    - Extract metadata (author, stats)
    - _Requirements: 2.5, 2.6, 2.7, 2.8_
  - [x] 4.3 Create Twitter index (src/lib/extractors/twitter/index.ts)
    - Implement TwitterExtractor class
    - Implement 3-tier cookie strategy (Syndication → Server → Client)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 4.4 Write property test for video quality sorting
    - **Property 7: Video Quality Sorting**
    - **Validates: Requirements 2.5**
  - [ ]* 4.5 Write unit tests for Twitter parser
    - Test syndication response parsing
    - Test mixed media (video + images)
    - _Requirements: 2.5, 2.6, 2.7_

- [x] 5. Checkpoint - Twitter Extractor
  - Ensure Twitter extraction works with real URL
  - Test both public (Syndication) and private (GraphQL) paths

- [x] 6. Implement Instagram Extractor
  - [x] 6.1 Create Instagram scanner (src/lib/extractors/instagram/scanner.ts)
    - Implement URL pattern detection
    - Implement extractShortcode from URL
    - Implement shortcodeToMediaId conversion
    - Implement fetchGraphQL (public)
    - Implement fetchInternalAPI (with cookie)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8_
  - [x] 6.2 Create Instagram extract (src/lib/extractors/instagram/extract.ts)
    - Implement parseGraphQLResponse
    - Implement parseAPIResponse
    - Handle carousel/sidecar posts
    - Extract metadata (author, caption, stats)
    - _Requirements: 1.5, 1.6, 1.7_
  - [x] 6.3 Create Instagram index (src/lib/extractors/instagram/index.ts)
    - Implement InstagramExtractor class
    - Implement 3-tier cookie strategy (GraphQL → Server API → Client API)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 6.4 Write property test for shortcode conversion
    - **Property 2: Instagram Shortcode Conversion Round-Trip**
    - **Validates: Requirements 1.8**
  - [ ]* 6.5 Write unit tests for Instagram parser
    - Test single video/image parsing
    - Test carousel parsing (order preservation)
    - _Requirements: 1.5, 1.6_

- [x] 7. Checkpoint - Instagram Extractor
  - Ensure Instagram extraction works with real URL
  - Test public post, reel, and carousel

- [x] 8. Update Cookie Support
  - [x] 8.1 Add Instagram cookie helpers
    - Implement extractCsrfToken from cookie string
    - Add Instagram headers with X-CSRFToken, X-IG-App-ID
    - _Requirements: 4.6_
  - [x] 8.2 Add Twitter cookie helpers
    - Implement extractCt0 from cookie string
    - Add Twitter headers with X-Csrf-Token, Authorization
    - _Requirements: 4.7_
  - [x] 8.3 Update CookieModal to show Instagram/Twitter status
    - Already supports instagram/twitter platforms
    - Verify cookie count display works
    - _Requirements: 4.1, 4.2_
  - [ ]* 8.4 Write property test for cookie parsing
    - **Property 6: Cookie Parsing Correctness**
    - **Validates: Requirements 4.5, 4.6, 4.7**

- [x] 9. Final Integration
  - [x] 9.1 Update platform detection in useExtract hook
    - detectPlatformFromUrl already handles instagram/tiktok
    - Verify cookie is sent for correct platforms
    - _Requirements: 4.3_
  - [ ]* 9.2 Write property test for response schema
    - **Property 5: Response Schema Conformance**
    - **Validates: Requirements 5.1-5.6**

- [x] 10. Final Checkpoint
  - Run `npm run build` - ensure no errors
  - Test all 4 platforms with real URLs
  - Verify JSON output format is consistent

## Notes

- Tasks marked with `*` are optional property-based tests
- TikTok is implemented first as it's simplest (no cookie needed)
- Twitter second as Syndication API is reliable for public content
- Instagram last as it has most complex API (GraphQL + Internal API)
- Each checkpoint verifies the extractor works before moving on
- Property tests use fast-check library with 100+ iterations
