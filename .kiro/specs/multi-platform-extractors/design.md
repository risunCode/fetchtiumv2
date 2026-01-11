# Design Document: Multi-Platform Extractors

## Overview

This design extends FetchtiumV2 to support Instagram, Twitter/X, and TikTok media extraction. The architecture follows the existing Facebook extractor pattern with platform-specific implementations.

## Architecture

```
src/lib/extractors/
├── index.ts              # Registry & platform detection
├── base.extractor.ts     # Base class (existing)
├── facebook/             # Existing
├── instagram/
│   ├── index.ts          # InstagramExtractor class
│   ├── scanner.ts        # URL detection, API fetching
│   └── extract.ts        # Response parsing, media extraction
├── twitter/
│   ├── index.ts          # TwitterExtractor class
│   ├── scanner.ts        # URL detection, API fetching
│   └── extract.ts        # Response parsing, media extraction
└── tiktok/
    ├── index.ts          # TikTokExtractor class
    ├── scanner.ts        # URL detection, API fetching
    └── extract.ts        # Response parsing, media extraction
```

## Components and Interfaces

### Platform Detection

```typescript
// src/lib/extractors/index.ts
const PLATFORM_PATTERNS: Record<string, RegExp[]> = {
  facebook: [/facebook\.com/i, /fb\.watch/i, /fb\.me/i],
  instagram: [/instagram\.com/i, /instagr\.am/i],
  twitter: [/twitter\.com/i, /x\.com/i, /t\.co/i],
  tiktok: [/tiktok\.com/i, /vm\.tiktok\.com/i, /vt\.tiktok\.com/i],
};

function detectPlatform(url: string): string | null;
function getExtractor(url: string): BaseExtractor;
function isSupported(url: string): boolean;
```

### Instagram Extractor

```typescript
// Strategy: GraphQL (public) → Internal API (server cookie) → Internal API (client cookie)

interface InstagramExtractor {
  extract(url: string, options?: ExtractOptions): Promise<InternalExtractResponse>;
}

// Scanner functions
function extractShortcode(url: string): string | null;
function shortcodeToMediaId(shortcode: string): string;
function fetchGraphQL(shortcode: string, headers: Headers): Promise<GraphQLResponse>;
function fetchInternalAPI(mediaId: string, headers: Headers): Promise<APIResponse>;

// Parser functions
function parseGraphQLResponse(data: GraphQLResponse): ParsedResult;
function parseAPIResponse(data: APIResponse): ParsedResult;
```

### Twitter Extractor

```typescript
// Strategy: Syndication API (public) → GraphQL (server cookie) → GraphQL (client cookie)

interface TwitterExtractor {
  extract(url: string, options?: ExtractOptions): Promise<InternalExtractResponse>;
}

// Scanner functions
function extractTweetInfo(url: string): { tweetId: string; username: string };
function fetchSyndication(tweetId: string): Promise<SyndicationResponse>;
function fetchGraphQL(tweetId: string, headers: Headers): Promise<GraphQLResponse>;

// Parser functions
function parseSyndication(data: SyndicationResponse): ParsedResult;
function parseGraphQL(data: GraphQLResponse): ParsedResult;
```

### TikTok Extractor

```typescript
// Strategy: TikWM API only (no cookie needed)

interface TikTokExtractor {
  extract(url: string, options?: ExtractOptions): Promise<InternalExtractResponse>;
}

// Scanner functions
function fetchTikWM(url: string): Promise<TikWMResponse>;

// Parser functions
function parseTikWM(data: TikWMResponse): ParsedResult;
```

## Data Models

### Instagram Types

```typescript
interface GraphQLResponse {
  data: {
    xdt_shortcode_media: {
      id: string;
      shortcode: string;
      display_url: string;
      video_url?: string;
      is_video: boolean;
      edge_sidecar_to_children?: { edges: SidecarEdge[] };
      owner: { username: string };
      edge_media_to_caption?: { edges: CaptionEdge[] };
      like_count: number;
      comment_count: number;
      video_view_count?: number;
    };
  };
}

interface APIResponse {
  items: Array<{
    id: string;
    code: string;
    media_type: 1 | 2 | 8; // 1=image, 2=video, 8=carousel
    video_versions?: VideoVersion[];
    image_versions2?: { candidates: ImageCandidate[] };
    carousel_media?: CarouselItem[];
    user: { username: string; full_name: string };
    caption?: { text: string };
    like_count: number;
    comment_count: number;
    play_count?: number;
  }>;
  status: string;
}
```

### Twitter Types

```typescript
interface SyndicationResponse {
  id_str: string;
  text: string;
  full_text?: string;
  user: { name: string; screen_name: string };
  mediaDetails?: MediaDetail[];
  photos?: Photo[];
  video?: { variants: VideoVariant[] };
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
}

interface VideoVariant {
  url: string;
  content_type: string;
  bitrate?: number;
}
```

### TikTok Types

```typescript
interface TikWMResponse {
  code: number;
  msg: string;
  data: {
    id: string;
    title: string;
    cover: string;
    duration: number;
    play: string;      // SD URL
    hdplay: string;    // HD URL
    size: number;
    hd_size: number;
    images?: string[]; // Slideshow images
    author: { unique_id: string; nickname: string; avatar: string };
    digg_count: number;
    comment_count: number;
    share_count: number;
    play_count: number;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Platform Detection Accuracy

*For any* valid social media URL from supported platforms (Instagram, Twitter, TikTok, Facebook), the platform detection function SHALL correctly identify the platform and return the appropriate extractor.

**Validates: Requirements 1.1, 2.1, 3.1, 6.1, 6.2, 6.3, 6.4**

### Property 2: Instagram Shortcode Conversion Round-Trip

*For any* valid Instagram shortcode, converting to media_id and back SHALL produce the original shortcode (or equivalent numeric representation).

**Validates: Requirements 1.8**

### Property 3: Parser Output Completeness

*For any* valid API response containing media, the parser SHALL extract all media items with required fields (url, quality, type) and preserve the original order for carousels/galleries.

**Validates: Requirements 1.5, 1.6, 2.5, 2.6, 2.7, 3.3, 3.4**

### Property 4: Metadata Extraction Completeness

*For any* successful extraction, the response SHALL contain all required metadata fields (author, title/caption, engagement stats) when present in the source data.

**Validates: Requirements 1.7, 2.8, 3.5, 3.6**

### Property 5: Response Schema Conformance

*For any* extraction result (success or error), the response SHALL conform to the ExtractResult or ExtractError schema with all required fields present.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

### Property 6: Cookie Parsing Correctness

*For any* valid Netscape or JSON cookie format, parsing SHALL produce a valid HTTP Cookie header string containing all cookie name=value pairs.

**Validates: Requirements 4.5, 4.6, 4.7**

### Property 7: Video Quality Sorting

*For any* extraction result with multiple video qualities, the sources SHALL be sorted by quality (highest first) based on resolution or bitrate.

**Validates: Requirements 2.5**

## Error Handling

### Platform-Specific Error Detection

```typescript
// Instagram errors
function detectInstagramError(response: any): ErrorCode | null {
  if (response.status === 'fail') return ErrorCode.EXTRACTION_FAILED;
  if (response.message?.includes('login')) return ErrorCode.LOGIN_REQUIRED;
  if (response.message?.includes('not found')) return ErrorCode.CONTENT_NOT_FOUND;
  return null;
}

// Twitter errors
function detectTwitterError(status: number, body: string): ErrorCode | null {
  if (status === 404) return ErrorCode.CONTENT_NOT_FOUND;
  if (status === 403) return ErrorCode.PRIVATE_CONTENT;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (body.includes('TweetTombstone')) return ErrorCode.CONTENT_NOT_FOUND;
  return null;
}

// TikTok errors
function detectTikTokError(code: number, msg: string): ErrorCode | null {
  if (code === -1) return ErrorCode.CONTENT_NOT_FOUND;
  if (code === 10000) return ErrorCode.RATE_LIMITED;
  return null;
}
```

### Error Codes

| Code | Description |
|------|-------------|
| LOGIN_REQUIRED | Content requires authentication |
| PRIVATE_CONTENT | Content is private or protected |
| CONTENT_NOT_FOUND | Content deleted or doesn't exist |
| RATE_LIMITED | API rate limit exceeded |
| TIMEOUT | Request timeout |
| NO_MEDIA_FOUND | No extractable media in response |
| UNSUPPORTED_PLATFORM | Platform not supported |

## Testing Strategy

### Unit Tests

- URL pattern matching for each platform
- Shortcode extraction and conversion
- Response parsing for each API format
- Error detection functions
- Cookie parsing (Netscape, JSON formats)

### Property-Based Tests

Using fast-check library with minimum 100 iterations per property:

1. **Platform Detection**: Generate random URLs, verify correct platform detection
2. **Shortcode Conversion**: Generate random shortcodes, verify round-trip
3. **Parser Output**: Generate mock API responses, verify all media extracted
4. **Response Schema**: Generate extraction results, verify schema conformance
5. **Cookie Parsing**: Generate cookie strings, verify header format output
6. **Quality Sorting**: Generate multi-quality responses, verify sort order

### Integration Tests

- End-to-end extraction with real URLs (manual)
- Cookie retry flow verification
- Error handling for various failure scenarios
