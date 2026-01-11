# Design Document

## Overview

This design covers the migration of FetchtiumV2 from Fastify + Vanilla JS to Next.js 16 + TypeScript + React. The core extraction logic (network, parser, extractors) remains functionally identical, converted to TypeScript. The API routes are converted from Fastify handlers to Next.js App Router route handlers. The frontend is converted from vanilla DOM manipulation to React components.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)           │  Backend (API Routes)         │
│  ┌───────────────────────┐  │  ┌─────────────────────────┐  │
│  │ page.tsx              │  │  │ /api/v1/extract         │  │
│  │ ├── ExtractForm       │  │  │ /api/v1/stream          │  │
│  │ ├── ResultCard        │  │  │ /api/v1/download        │  │
│  │ ├── FormatList        │  │  │ /api/v1/status          │  │
│  │ ├── PlayerModal       │  │  │ /api/v1/events (SSE)    │  │
│  │ └── CookieModal       │  │  │ /api/health             │  │
│  └───────────────────────┘  │  └─────────────────────────┘  │
├─────────────────────────────┴───────────────────────────────┤
│                      Shared Library (src/lib)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ core/       │  │ extractors/ │  │ utils/              │  │
│  │ ├─ network/ │  │ ├─ base     │  │ ├─ error.utils     │  │
│  │ │  ├─client │  │ ├─ index    │  │ ├─ url.utils       │  │
│  │ │  ├─cookies│  │ └─ facebook/│  │ ├─ filename.utils  │  │
│  │ │  └─headers│  │    ├─index  │  │ ├─ response.utils  │  │
│  │ └─ parser/  │  │    ├─extract│  │ ├─ mime.helper     │  │
│  │    ├─html   │  │    └─scanner│  │ └─ logger          │  │
│  │    └─regex  │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Type Definitions

```typescript
// src/types/extract.ts

export interface ExtractResult {
  success: boolean;
  platform: string;
  contentType: string;
  title?: string;
  author?: string;
  id?: string;
  description?: string;
  uploadDate?: string;
  stats?: EngagementStats;
  items: MediaItem[];
  meta: ResponseMeta;
  usedCookie?: boolean;
}

export interface EngagementStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface MediaItem {
  index: number;
  type: 'video' | 'image' | 'audio';
  thumbnail?: string;
  sources: MediaSource[];
}

export interface MediaSource {
  quality: string;
  url: string;
  resolution?: string;
  mime?: string;
  size?: number;
  filename?: string;
}

export interface ResponseMeta {
  responseTime: number;
  accessMode: string;
  publicContent: boolean;
}

export interface ExtractError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta: ResponseMeta;
}
```

### Network Client Interface

```typescript
// src/lib/core/network/client.ts

export interface FetchStreamResult {
  stream: ReadableStream<Uint8Array>;
  headers: Record<string, string>;
  finalUrl: string;
  status: number;
}

export interface FetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeout?: number;
  maxRedirects?: number;
}

export async function fetchStream(
  url: string, 
  options?: FetchOptions
): Promise<FetchStreamResult>;

export async function resolveUrl(
  url: string, 
  options?: FetchOptions
): Promise<string>;

export async function getFileSizes(
  urls: string[], 
  timeout?: number
): Promise<Map<string, number>>;
```

### Extractor Interface

```typescript
// src/lib/extractors/base.extractor.ts

export interface ExtractOptions {
  signal?: AbortSignal;
  timeout?: number;
  cookie?: string;
}

export abstract class BaseExtractor {
  static platform: string;
  static patterns: RegExp[];
  
  static match(url: string): boolean;
  abstract extract(url: string, options?: ExtractOptions): Promise<ExtractResult | ExtractError>;
}
```

### API Route Handlers

```typescript
// Next.js App Router pattern

// POST /api/v1/extract
export async function POST(request: NextRequest): Promise<NextResponse>;

// GET /api/v1/stream?url=...
export async function GET(request: NextRequest): Promise<Response>;

// GET /api/v1/events (SSE)
export async function GET(request: NextRequest): Promise<Response>;
```

## Data Models

### Cookie Storage (Client-side)

```typescript
// localStorage keys
'ck_facebook' -> Netscape format cookie string
'ck_instagram' -> Netscape format cookie string
'ck_tiktok' -> Netscape format cookie string
```

### URL Store (Server-side, in-memory)

```typescript
// src/lib/utils/url-store.ts

interface StoredUrl {
  baseUrl: string;
  timestamp: number;
}

// Map<baseUrl, timestamp>
// TTL: 1 hour
// Used for proxy validation
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Type Conversion Equivalence
*For any* valid JavaScript function from the old codebase, converting it to TypeScript SHALL produce functionally equivalent output for the same inputs.
**Validates: Requirements 1.1-1.4, 2.1-2.6, 3.1-3.5, 4.1-4.8**

### Property 2: API Response Format Consistency
*For any* extraction request, the API response SHALL match the ExtractResult or ExtractError interface exactly.
**Validates: Requirements 6.1**

### Property 3: Cookie Priority Order
*For any* extraction with multiple cookie sources available, the Cookie_Manager SHALL use client cookie over server cookie over file cookie.
**Validates: Requirements 2.4, 2.5**

### Property 4: Stream Proxy Transparency
*For any* valid media URL, the stream proxy SHALL return the same bytes as a direct request to the source URL.
**Validates: Requirements 6.2, 6.3**

### Property 5: SSE Connection Stability
*For any* SSE connection, the server SHALL send status updates every 2 seconds until client disconnects.
**Validates: Requirements 6.5**

### Property 6: Security Input Sanitization
*For any* user input containing XSS or injection patterns, the Security_Middleware SHALL sanitize or reject the input.
**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

### Error Codes (from original)

```typescript
export enum ErrorCode {
  INVALID_URL = 'INVALID_URL',
  UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
  FETCH_FAILED = 'FETCH_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  PRIVATE_CONTENT = 'PRIVATE_CONTENT',
  LOGIN_REQUIRED = 'LOGIN_REQUIRED',
  AGE_RESTRICTED = 'AGE_RESTRICTED',
  STORY_EXPIRED = 'STORY_EXPIRED',
  NO_MEDIA_FOUND = 'NO_MEDIA_FOUND',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
}
```

### Error Response Format

```typescript
{
  success: false,
  error: {
    code: ErrorCode,
    message: string
  },
  meta: {
    responseTime: number,
    accessMode: string,
    publicContent: boolean
  }
}
```

## Testing Strategy

### Unit Tests
- Type validation tests for all interfaces
- Cookie parser tests (Netscape, JSON, raw formats)
- URL utility tests (validation, normalization)
- Filename generation tests

### Integration Tests
- API route tests with mock extractors
- Stream proxy tests
- SSE connection tests

### Property-Based Tests
- Cookie priority property test
- Input sanitization property test

### Manual Tests
- Full extraction flow with real Facebook URLs
- Player modal functionality
- Download functionality
