# Requirements Document

## Introduction

Migration of FetchtiumV2 from Fastify + Vanilla JS to Next.js + TypeScript + React. The core extraction logic remains the same, only the framework and frontend change.

## Glossary

- **Extractor**: Module that extracts media URLs from a specific platform (Facebook, YouTube, etc.)
- **API_Route**: Next.js route handler in `app/api/` directory
- **SSE**: Server-Sent Events for real-time status updates
- **Undici**: HTTP client library for Node.js (kept from original)

## Requirements

### Requirement 1: TypeScript Type Definitions

**User Story:** As a developer, I want TypeScript types for all data structures, so that I have better IDE support and catch errors early.

#### Acceptance Criteria

1. THE Type_System SHALL define ExtractResult interface with success, platform, contentType, title, author, stats, items, and meta fields
2. THE Type_System SHALL define MediaItem interface with index, type, thumbnail, and sources fields
3. THE Type_System SHALL define MediaSource interface with quality, url, resolution, mime, size, and filename fields
4. THE Type_System SHALL define API request and response types for all endpoints

---

### Requirement 2: Core Network Module

**User Story:** As a developer, I want the network module converted to TypeScript, so that HTTP requests work the same as before with type safety.

#### Acceptance Criteria

1. THE Network_Client SHALL provide fetchStream function using undici with same signature as original
2. THE Network_Client SHALL provide resolveUrl function for URL resolution with redirects
3. THE Network_Client SHALL provide getFileSizes function for batch HEAD requests
4. THE Cookie_Manager SHALL parse Netscape, JSON, and raw cookie formats
5. THE Cookie_Manager SHALL implement priority: client cookie > server cookie > file cookie
6. THE Header_Builder SHALL generate platform-specific headers (Facebook iPad, etc.)

---

### Requirement 3: Core Parser Module

**User Story:** As a developer, I want the HTML parser converted to TypeScript, so that content extraction works the same as before.

#### Acceptance Criteria

1. THE HTML_Parser SHALL decode HTML entities using node-html-parser
2. THE HTML_Parser SHALL extract meta tags from HTML content
3. THE Regex_Extractor SHALL provide extractAll function for pattern matching
4. THE Regex_Extractor SHALL provide decodeUrl function for URL decoding
5. THE Regex_Extractor SHALL provide cleanJsonString function for JSON cleanup

---

### Requirement 4: Utility Modules

**User Story:** As a developer, I want all utility modules converted to TypeScript, so that helper functions are type-safe.

#### Acceptance Criteria

1. THE Error_Utils SHALL define ErrorCode enum with all error types
2. THE Error_Utils SHALL provide createErrorResponse function
3. THE URL_Utils SHALL provide isValidUrl, normalizeUrl, and parseUrl functions
4. THE URL_Store SHALL store extracted URLs for proxy validation with TTL
5. THE Filename_Utils SHALL generate filenames in format: author_contentType_title_quality.ext
6. THE Response_Utils SHALL build standardized API responses with meta object
7. THE Mime_Helper SHALL detect MIME types and provide extension mapping
8. THE Logger SHALL provide debug, info, warn, error logging functions

---

### Requirement 5: Facebook Extractor

**User Story:** As a developer, I want the Facebook extractor converted to TypeScript, so that Facebook media extraction works the same as before.

#### Acceptance Criteria

1. THE Facebook_Extractor SHALL extend BaseExtractor class
2. THE Facebook_Extractor SHALL define static patterns for URL matching
3. THE Facebook_Extractor SHALL extract videos, reels, stories, posts, and galleries
4. THE Facebook_Extractor SHALL use guest mode first, retry with cookies on auth error
5. THE Facebook_Extractor SHALL always use cookies for stories
6. THE Facebook_Scanner SHALL detect content type from URL patterns
7. THE Facebook_Scanner SHALL detect content issues (private, deleted, age-restricted)
8. THE Facebook_Extract SHALL extract video URLs, image URLs, and metadata
9. THE Facebook_Extract SHALL extract engagement stats from JSON and title fallback

---

### Requirement 6: API Routes

**User Story:** As a developer, I want all API endpoints converted to Next.js route handlers, so that the API works the same as before.

#### Acceptance Criteria

1. WHEN a POST request is made to /api/v1/extract THEN the API_Route SHALL extract media and return standardized response
2. WHEN a GET request is made to /api/v1/stream THEN the API_Route SHALL proxy video stream with range request support
3. WHEN a GET request is made to /api/v1/download THEN the API_Route SHALL proxy file download with Content-Disposition header
4. WHEN a GET request is made to /api/v1/status THEN the API_Route SHALL return server status
5. WHEN a GET request is made to /api/v1/events THEN the API_Route SHALL return SSE stream for real-time status
6. WHEN a GET request is made to /api/health THEN the API_Route SHALL return health check response

---

### Requirement 7: Security Middleware

**User Story:** As a developer, I want security protections in place, so that the API is protected from common attacks.

#### Acceptance Criteria

1. THE Security_Middleware SHALL validate and sanitize all input using xss library
2. THE Security_Middleware SHALL block path traversal attempts
3. THE Security_Middleware SHALL block SSRF attempts (internal IPs, metadata endpoints)
4. THE Security_Middleware SHALL implement rate limiting
5. THE Access_Control SHALL validate Origin header or API key for protected routes
6. THE Access_Control SHALL allow public access to stream, download, and events routes

---

### Requirement 8: Frontend Components

**User Story:** As a user, I want a React-based frontend, so that I can extract and download media with a modern UI.

#### Acceptance Criteria

1. THE ExtractForm_Component SHALL accept URL input and trigger extraction
2. THE ResultCard_Component SHALL display title, author, stats, and thumbnail
3. THE FormatList_Component SHALL display available formats with play, open, and download buttons
4. THE PlayerModal_Component SHALL play video/audio using proxy stream
5. THE CookieModal_Component SHALL allow cookie input for multiple platforms
6. THE StatusBadge_Component SHALL show server status via SSE connection
7. WHEN extraction succeeds THEN the UI SHALL display results with all formats
8. WHEN extraction fails THEN the UI SHALL display error message

---

### Requirement 9: Configuration

**User Story:** As a developer, I want proper configuration management, so that the app works in different environments.

#### Acceptance Criteria

1. THE Config_Module SHALL read environment variables from .env files
2. THE Config_Module SHALL provide ALLOWED_ORIGINS for CORS
3. THE Config_Module SHALL provide API_KEYS for authentication
4. THE Next_Config SHALL configure security headers
5. THE Next_Config SHALL configure CORS headers for API routes
