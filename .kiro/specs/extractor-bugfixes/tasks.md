# Implementation Plan: Extractor Bugfixes

## Overview

Fix three issues: shared quality helpers, frontend download hash, and Twitter retweet extraction.

## Tasks

- [x] 1. Create Shared Quality Helpers
  - [x] 1.1 Create quality.utils.ts with threshold constants
    - Define QUALITY_THRESHOLDS array with all quality levels
    - Support 4K, 2K, 1080p, 720p, 540p, 480p, 360p, 240p, 144p
    - _Requirements: 1.1, 1.2, 1.3-1.11_
  - [x] 1.2 Implement getQualityFromBitrate and getResolutionFromBitrate
    - Loop through thresholds to find matching quality
    - Handle edge cases (negative, NaN, undefined)
    - _Requirements: 1.3-1.11_
  - [x] 1.3 Update Twitter extractor to use shared helpers
    - Remove local getQualityFromBitrate and getResolutionFromBitrate
    - Import from quality.utils.ts
    - _Requirements: 1.12_
  - [ ]* 1.4 Write property test for bitrate mapping
    - **Property 1: Bitrate to Quality Mapping Consistency**
    - **Validates: Requirements 1.3-1.11**

- [x] 2. Checkpoint - Quality Helpers
  - Run `npm run build` - ensure no errors
  - Verify Twitter extraction still works

- [x] 3. Fix Frontend Download Hash
  - [x] 3.1 Create buildDownloadUrl helper function
    - Check if source.hash exists
    - Use `h=` param when hash available, `url=` otherwise
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 Update FormatRow handleDownload to use buildDownloadUrl
    - Replace direct URL construction with helper
    - _Requirements: 2.1, 2.3_
  - [x] 3.3 Update handleDownloadAll to use buildDownloadUrl
    - Apply same hash-first logic for batch downloads
    - _Requirements: 2.5_
  - [ ]* 3.4 Write property test for download URL builder
    - **Property 2: Download URL Hash-First Logic**
    - **Validates: Requirements 2.1-2.5**

- [x] 4. Checkpoint - Frontend Download
  - Run `npm run build` - ensure no errors
  - Test download with real extraction result

- [x] 5. Fix Twitter Retweet Extraction
  - [x] 5.1 Add retweet types to scanner.ts
    - Add retweeted_status to SyndicationResponse interface
    - Add retweeted_status_result to TweetLegacy interface
    - _Requirements: 3.2, 3.3_
  - [x] 5.2 Update parseSyndication to handle retweets
    - Check for retweeted_status field
    - Extract media from original tweet if retweet
    - Add retweet indicator to description
    - _Requirements: 3.1, 3.4, 3.5_
  - [x] 5.3 Update parseGraphQL to handle retweets
    - Check for retweeted_status_result in legacy
    - Extract media from original tweet if retweet
    - Add retweet indicator to description
    - _Requirements: 3.1, 3.4, 3.5_
  - [ ]* 5.4 Write property test for retweet extraction
    - **Property 3: Retweet Media Extraction**
    - **Validates: Requirements 3.1, 3.4, 3.5**

- [x] 6. Final Checkpoint
  - Run `npm run build` - ensure no errors
  - Test Twitter retweet URL extraction
  - Verify all fixes work together

## Notes

- Tasks marked with `*` are optional property-based tests
- Quality helpers should be created first as Twitter extractor depends on them
- Frontend download fix is independent and can be done in parallel
- Retweet fix requires understanding Twitter API response structure

</content>
</invoke>