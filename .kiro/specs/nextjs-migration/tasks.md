# Implementation Plan: Next.js Migration

## Overview

Migration from Fastify + Vanilla JS to Next.js + TypeScript + React. Core logic is copied and converted to TypeScript. API routes converted to Next.js App Router. Frontend converted to React components.

## Tasks

- [x] 1. Setup Type Definitions
  - [x] 1.1 Create extract types (ExtractResult, MediaItem, MediaSource, etc.)
    - Define all interfaces in `src/types/extract.ts`
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Create API types (request/response types)
    - Define request body and response types in `src/types/api.ts`
    - _Requirements: 1.4_
  - [x] 1.3 Create config types
    - Define environment config types in `src/types/config.ts`
    - _Requirements: 9.1_
  - [x] 1.4 Create index exports
    - Export all types from `src/types/index.ts`

- [x] 2. Migrate Core Network Module
  - [x] 2.1 Convert client.js to TypeScript
    - Copy from `old_vanilla/src/core/network/client.js`
    - Add types, convert to `src/lib/core/network/client.ts`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Convert cookies.js to TypeScript
    - Copy from `old_vanilla/src/core/network/cookies.js`
    - Add types, convert to `src/lib/core/network/cookies.ts`
    - _Requirements: 2.4, 2.5_
  - [x] 2.3 Convert headers.js to TypeScript
    - Copy from `old_vanilla/src/core/network/headers.js`
    - Add types, convert to `src/lib/core/network/headers.ts`
    - _Requirements: 2.6_
  - [x] 2.4 Create network index exports
    - Export all from `src/lib/core/network/index.ts`

- [x] 3. Migrate Core Parser Module
  - [x] 3.1 Convert html.parser.js to TypeScript
    - Copy from `old_vanilla/src/core/parser/html.parser.js`
    - Add types, convert to `src/lib/core/parser/html.parser.ts`
    - _Requirements: 3.1, 3.2_
  - [x] 3.2 Convert regex.extractor.js to TypeScript
    - Copy from `old_vanilla/src/core/parser/regex.extractor.js`
    - Add types, convert to `src/lib/core/parser/regex.extractor.ts`
    - _Requirements: 3.3, 3.4, 3.5_
  - [x] 3.3 Create parser index exports
    - Export all from `src/lib/core/parser/index.ts`

- [x] 4. Migrate Utility Modules
  - [x] 4.1 Convert error.utils.js to TypeScript
    - Copy from `old_vanilla/src/utils/error.utils.js`
    - Add types, convert to `src/lib/utils/error.utils.ts`
    - _Requirements: 4.1, 4.2_
  - [x] 4.2 Convert url.utils.js to TypeScript
    - Copy from `old_vanilla/src/utils/url.utils.js`
    - Add types, convert to `src/lib/utils/url.utils.ts`
    - _Requirements: 4.3_
  - [x] 4.3 Convert url-store.js to TypeScript
    - Copy from `old_vanilla/src/utils/url-store.js`
    - Add types, convert to `src/lib/utils/url-store.ts`
    - _Requirements: 4.4_
  - [x] 4.4 Convert filename.utils.js to TypeScript
    - Copy from `old_vanilla/src/utils/filename.utils.js`
    - Add types, convert to `src/lib/utils/filename.utils.ts`
    - _Requirements: 4.5_
  - [x] 4.5 Convert response.utils.js to TypeScript
    - Copy from `old_vanilla/src/utils/response.utils.js`
    - Add types, convert to `src/lib/utils/response.utils.ts`
    - _Requirements: 4.6_
  - [x] 4.6 Convert mime.helper.js to TypeScript
    - Copy from `old_vanilla/src/utils/mime.helper.js`
    - Add types, convert to `src/lib/utils/mime.helper.ts`
    - _Requirements: 4.7_
  - [x] 4.7 Create logger.ts (simplified)
    - Create simple console-based logger in `src/lib/utils/logger.ts`
    - _Requirements: 4.8_
  - [x] 4.8 Create utils index exports
    - Export all from `src/lib/utils/index.ts`

- [x] 5. Checkpoint - Core & Utils Complete
  - Ensure all core and utils modules compile without errors
  - Run `npm run build` to verify

- [x] 6. Migrate Facebook Extractor
  - [x] 6.1 Convert base.extractor.js to TypeScript
    - Copy from `old_vanilla/src/extractors/base.extractor.js`
    - Add types, convert to `src/lib/extractors/base.extractor.ts`
    - _Requirements: 5.1_
  - [x] 6.2 Convert extractors/index.js to TypeScript
    - Copy from `old_vanilla/src/extractors/index.js`
    - Add types, convert to `src/lib/extractors/index.ts`
    - _Requirements: 5.2_
  - [x] 6.3 Convert facebook/scanner.js to TypeScript
    - Copy from `old_vanilla/src/extractors/facebook/scanner.js`
    - Add types, convert to `src/lib/extractors/facebook/scanner.ts`
    - _Requirements: 5.6, 5.7_
  - [x] 6.4 Convert facebook/extract.js to TypeScript
    - Copy from `old_vanilla/src/extractors/facebook/extract.js`
    - Add types, convert to `src/lib/extractors/facebook/extract.ts`
    - _Requirements: 5.8, 5.9_
  - [x] 6.5 Convert facebook/index.js to TypeScript
    - Copy from `old_vanilla/src/extractors/facebook/index.js`
    - Add types, convert to `src/lib/extractors/facebook/index.ts`
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 7. Checkpoint - Extractors Complete
  - Ensure all extractor modules compile without errors
  - Run `npm run build` to verify

- [x] 8. Create API Routes
  - [x] 8.1 Create /api/v1/extract route
    - Create `src/app/api/v1/extract/route.ts`
    - Handle POST request, call extractor, return response
    - _Requirements: 6.1_
  - [x] 8.2 Create /api/v1/stream route
    - Create `src/app/api/v1/stream/route.ts`
    - Handle GET request, proxy video stream with range support
    - _Requirements: 6.2_
  - [x] 8.3 Create /api/v1/download route
    - Create `src/app/api/v1/download/route.ts`
    - Handle GET request, proxy file download
    - _Requirements: 6.3_
  - [x] 8.4 Create /api/v1/status route
    - Create `src/app/api/v1/status/route.ts`
    - Handle GET request, return server status
    - _Requirements: 6.4_
  - [x] 8.5 Create /api/v1/events route (SSE)
    - Create `src/app/api/v1/events/route.ts`
    - Handle GET request, return SSE stream
    - _Requirements: 6.5_
  - [x] 8.6 Create /api/health route
    - Create `src/app/api/health/route.ts`
    - Handle GET request, return health check
    - _Requirements: 6.6_

- [x] 9. Create Middleware
  - [x] 9.1 Create security helpers
    - Create `src/lib/middleware/security.ts`
    - Input sanitization, SSRF protection, path traversal protection
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 9.2 Create access control helpers
    - Create `src/lib/middleware/access.ts`
    - Origin validation, API key validation
    - _Requirements: 7.5, 7.6_
  - [x] 9.3 Create Next.js middleware
    - Create `src/middleware.ts`
    - Apply security checks to API routes
    - _Requirements: 7.1-7.6_

- [x] 10. Checkpoint - API Routes Complete
  - Test all API routes with curl/Postman
  - Verify extraction works end-to-end

- [x] 11. Create Frontend Components
  - [x] 11.1 Create ExtractForm component
    - Create `src/components/ExtractForm.tsx`
    - URL input, paste button, extract button
    - _Requirements: 8.1_
  - [x] 11.2 Create ResultCard component
    - Create `src/components/ResultCard.tsx`
    - Display title, author, stats, thumbnail
    - _Requirements: 8.2_
  - [x] 11.3 Create FormatList component
    - Create `src/components/FormatList.tsx`
    - Display formats with play, open, download buttons
    - _Requirements: 8.3_
  - [x] 11.4 Create PlayerModal component
    - Create `src/components/PlayerModal.tsx`
    - Video/audio player using proxy stream
    - _Requirements: 8.4_
  - [x] 11.5 Create CookieModal component
    - Create `src/components/CookieModal.tsx`
    - Cookie input for multiple platforms
    - _Requirements: 8.5_
  - [x] 11.6 Create StatusBadge component
    - Create `src/components/StatusBadge.tsx`
    - Show server status via SSE
    - _Requirements: 8.6_

- [x] 12. Create Custom Hooks
  - [x] 12.1 Create useExtract hook
    - Create `src/hooks/useExtract.ts`
    - Handle extraction state and API calls
    - _Requirements: 8.7_
  - [x] 12.2 Create useStatus hook
    - Create `src/hooks/useStatus.ts`
    - Handle SSE connection for status updates
    - _Requirements: 8.6_

- [x] 13. Create Main Page
  - [x] 13.1 Update page.tsx
    - Compose all components in `src/app/page.tsx`
    - Wire up state and handlers
    - _Requirements: 8.7, 8.8_
  - [x] 13.2 Update globals.css
    - Add custom styles to `src/app/globals.css`
    - Dark theme, animations
  - [x] 13.3 Update layout.tsx
    - Update metadata, fonts in `src/app/layout.tsx`

- [x] 14. Configuration & Assets
  - [x] 14.1 Create config module
    - Create `src/lib/config/index.ts`
    - Read environment variables
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 14.2 Update next.config.ts
    - Add security headers, CORS config
    - _Requirements: 9.4, 9.5_
  - [x] 14.3 Create .env.example
    - Document all environment variables
  - [x] 14.4 Copy icons to public
    - Copy icon.png, icon-512.png from old_vanilla

- [x] 15. Final Checkpoint
  - Run `npm run build` - ensure no errors
  - Run `npm run dev` - test full flow
  - Test extraction with real Facebook URL
  - Test player, download, cookie modal

- [x] 16. Frontend Fixes & Enhancements
  - [x] 16.1 Add JSON Output section with Copy button
    - Add collapsible JSON output section like old frontend
    - Add copy to clipboard functionality
    - _Requirements: 8.7_
  - [x] 16.2 Fix responsive layout for mobile/desktop
    - Adjust container widths and padding for mobile
    - Fix button sizes and spacing for touch
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 16.3 Fix Cold/Ready status display
    - Show "Cold • Ready" when server is cold
    - Show "Warm • Xs left" when server is warm
    - _Requirements: 8.6_

- [x] 17. Download & Filename Fixes
  - [x] 17.1 Fix download filename generation
    - Ensure filename uses MIME-first approach from mime.helper
    - Match old filename format: author_contentType_title_quality.ext
    - _Requirements: 4.5, 4.7_
  - [x] 17.2 Update download route to use proper filename
    - Use filename from source if available
    - Generate filename using mime.helper if not
    - _Requirements: 6.3_
  - [x] 17.3 Ensure MIME type detection is unified
    - Use analyze() function from mime.helper as primary
    - Content-Type header first, then URL extension fallback
    - _Requirements: 4.7_

- [x] 18. Final Verification
  - Run `npm run build` - ensure no errors
  - Test full extraction flow with real URL
  - Verify JSON output and copy works
  - Verify download filename is correct
  - Verify status badge shows Cold/Warm correctly

## Notes

- All TypeScript conversions should maintain exact same logic
- Use `@/` import alias for all imports
- Logger simplified to console (no pino)
- SSE uses ReadableStream in Next.js
- Middleware uses Next.js middleware.ts pattern
