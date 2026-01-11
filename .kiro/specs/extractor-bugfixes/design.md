# Design Document: Extractor Bugfixes

## Overview

This design addresses three issues in the multi-platform extractors:
1. Duplicate and incomplete quality/resolution helper functions
2. Frontend download using raw URL instead of hash
3. Twitter retweet extraction not following to original tweet

## Architecture

```
src/lib/utils/
├── quality.utils.ts      # NEW: Shared quality/resolution helpers

src/lib/extractors/twitter/
├── extract.ts            # UPDATE: Use shared helpers, handle retweets

src/components/
├── FormatList.tsx        # UPDATE: Use hash for download URLs
```

## Components and Interfaces

### Shared Quality Helpers

```typescript
// src/lib/utils/quality.utils.ts

/**
 * Bitrate thresholds for quality detection
 * Covers: 4K, 2K, 1080p, 720p, 540p, 480p, 360p, 240p, 144p
 */
interface QualityThreshold {
  minBitrate: number;
  quality: string;
  resolution: string;
}

const QUALITY_THRESHOLDS: QualityThreshold[] = [
  { minBitrate: 8000000, quality: '4K', resolution: '3840x2160' },
  { minBitrate: 4000000, quality: '2K', resolution: '2560x1440' },
  { minBitrate: 2000000, quality: '1080p', resolution: '1920x1080' },
  { minBitrate: 1000000, quality: '720p', resolution: '1280x720' },
  { minBitrate: 600000, quality: '540p', resolution: '960x540' },
  { minBitrate: 400000, quality: '480p', resolution: '854x480' },
  { minBitrate: 200000, quality: '360p', resolution: '640x360' },
  { minBitrate: 100000, quality: '240p', resolution: '426x240' },
  { minBitrate: 0, quality: '144p', resolution: '256x144' },
];

function getQualityFromBitrate(bitrate: number): string;
function getResolutionFromBitrate(bitrate: number): string;
function getQualityInfo(bitrate: number): { quality: string; resolution: string };
```

### Twitter Retweet Handling

```typescript
// src/lib/extractors/twitter/extract.ts

/**
 * Check if Syndication response is a retweet
 */
function isRetweet(data: SyndicationResponse): boolean {
  return !!data.retweeted_status;
}

/**
 * Get original tweet from retweet (Syndication)
 */
function getOriginalTweet(data: SyndicationResponse): SyndicationResponse {
  return data.retweeted_status || data;
}

/**
 * Check if GraphQL response is a retweet
 */
function isGraphQLRetweet(result: TweetResult): boolean {
  return !!result.legacy?.retweeted_status_result;
}

/**
 * Get original tweet from GraphQL retweet
 */
function getOriginalGraphQLTweet(result: TweetResult): TweetResult {
  return result.legacy?.retweeted_status_result?.result || result;
}
```

### Frontend Download URL Builder

```typescript
// src/components/FormatList.tsx

/**
 * Build download URL using hash-first approach
 * @param source - Media source with optional hash
 * @param filename - Filename for download
 * @returns Download URL with h= or url= parameter
 */
function buildDownloadUrl(source: MediaSource, filename: string): string {
  const params = new URLSearchParams();
  
  // Prefer hash over raw URL
  if (source.hash) {
    params.set('h', source.hash);
  } else {
    params.set('url', source.url);
  }
  
  params.set('filename', filename);
  
  return `/api/v1/download?${params.toString()}`;
}
```

## Data Models

### Quality Threshold Model

```typescript
interface QualityThreshold {
  minBitrate: number;  // Minimum bitrate for this quality
  quality: string;     // Quality label (e.g., '1080p', '4K')
  resolution: string;  // Resolution string (e.g., '1920x1080')
}
```

### Extended Syndication Response (Retweet)

```typescript
interface SyndicationResponse {
  // ... existing fields ...
  
  // Retweet data (present if this is a retweet)
  retweeted_status?: SyndicationResponse;
}
```

### Extended GraphQL Response (Retweet)

```typescript
interface TweetLegacy {
  // ... existing fields ...
  
  // Retweet data (present if this is a retweet)
  retweeted_status_result?: {
    result: TweetResult;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Bitrate to Quality Mapping Consistency

*For any* valid bitrate value, the `getQualityFromBitrate` function SHALL return a quality label that corresponds to the correct threshold range, and `getResolutionFromBitrate` SHALL return the matching resolution.

**Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11**

### Property 2: Download URL Hash-First Logic

*For any* MediaSource object, the download URL builder SHALL use the `h=` parameter when `source.hash` is present, and fall back to `url=` parameter when hash is absent.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: Retweet Media Extraction

*For any* Twitter response that contains a retweet, the parser SHALL extract media from the original tweet (not the retweet wrapper), and the response SHALL indicate the content is from a retweet.

**Validates: Requirements 3.1, 3.4, 3.5**

## Error Handling

### Quality Helper Errors

| Scenario | Handling |
|----------|----------|
| Negative bitrate | Treat as 0, return '144p' |
| NaN/undefined bitrate | Return '144p' as fallback |

### Retweet Errors

| Scenario | Handling |
|----------|----------|
| Retweet with no media | Return NO_MEDIA_FOUND error |
| Retweet original deleted | Return DELETED_CONTENT error |
| Nested retweet | Follow to deepest original |

## Testing Strategy

### Unit Tests

- Quality helper threshold boundaries
- Download URL generation with/without hash
- Retweet detection in Syndication response
- Retweet detection in GraphQL response

### Property-Based Tests

Using fast-check library with minimum 100 iterations:

1. **Bitrate Mapping**: Generate random bitrates, verify quality/resolution matches threshold
2. **Download URL**: Generate MediaSource objects with/without hash, verify URL format
3. **Retweet Extraction**: Generate mock retweet responses, verify original media extracted

</content>
</invoke>