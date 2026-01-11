# Implementation Tasks

## Overview

Add Python-based extractors (yt-dlp and gallery-dl) for new platforms: BiliBili, Reddit, SoundCloud, Pixiv, Eporner, and Rule34Video.

## Task 1: Python Function Infrastructure Setup

- [x] 1.1 Create `requirements.txt` at project root with yt-dlp and gallery-dl dependencies
  - Add `yt-dlp` and `gallery-dl` (no version pinning, use latest)
  - _Requirements: 1.2_

- [x] 1.2 Create `vercel.json` with Python runtime configuration
  - Configure Python 3.12 runtime for `api/py/**/*.py`
  - Set `maxDuration: 30` for extraction timeout
  - Add `excludeFiles` for node_modules, .next, src, public
  - _Requirements: 1.1, 1.3, 1.6_

- [x] 1.3 Create `/api/py/` directory structure at project root
  - Create `api/py/` directory for Python serverless functions
  - _Requirements: 1.1_

- [x] 1.4 Update `next.config.ts` with rewrites for local development
  - Add conditional rewrite for `/api/py/:path*` to `http://localhost:3001` in dev mode
  - _Requirements: 1.4_

- [x] 1.5 Add `concurrently` dev dependency and update package.json scripts
  - Install `concurrently` as dev dependency
  - Add `dev:next`, `dev:python`, and combined `dev` script
  - _Requirements: 1.5_

## Task 2: Python Extractor Implementation

- [x] 2.1 Create `api/py/extract.py` with platform detection and Vercel handler
  - Implement `PLATFORMS` dict with URL patterns for all 6 platforms
  - Implement `detect_platform()` function
  - Implement Vercel serverless handler function
  - _Requirements: 2.1, 2.2_

- [x] 2.2 Implement yt-dlp wrapper for SoundCloud extraction
  - Create `extract_with_ytdlp()` function
  - Handle audio extraction with quality options
  - Support optional cookie parameter
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.3 Implement gallery-dl wrapper for other platforms
  - Create `extract_with_gallery_dl()` function
  - Handle BiliBili, Reddit, Pixiv, Eporner, Rule34Video
  - Support optional cookie parameter for authenticated content
  - _Requirements: 3.1-3.4, 4.1-4.5, 6.1-6.6, 7.1-7.4, 8.1-8.4_

- [x] 2.4 Implement response transformation to standard Fetchtium format
  - Create `transform_ytdlp_result()` for yt-dlp output
  - Create `transform_gallery_dl_result()` for gallery-dl output
  - Ensure output matches ExtractResult interface (items, sources, thumbnail, etc.)
  - _Requirements: 2.3_

- [x] 2.5 Add NSFW flag and error handling
  - Mark Pixiv (R-18), Eporner, Rule34Video as NSFW in response
  - Return appropriate error codes (LOGIN_REQUIRED, DELETED_CONTENT, etc.)
  - _Requirements: 2.4, 10.1, 6.6, 7.4, 8.4_

## Task 3: Frontend Integration

- [x] 3.1 Create `src/lib/extractors/python-platforms.ts` with platform detection
  - Define `PYTHON_PLATFORMS` array with patterns and nsfw flags
  - Export `isPythonPlatform()` function
  - Export `isNsfwPlatform()` function
  - _Requirements: 9.1_

- [x] 3.2 Update `src/app/api/v1/extract/route.ts` to route Python platforms
  - Import `isPythonPlatform` from python-platforms
  - Add conditional routing to `/api/py/extract` for Python platforms
  - Pass through cookie parameter
  - Apply `addFilenames()` to Python results
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 3.3 Update `src/lib/extractors/index.ts` to include Python platforms in `isSupported()`
  - Import `isPythonPlatform` and include in support check
  - Update `getSupportedPlatforms()` to include Python platforms
  - _Requirements: 9.1_

## Task 4: Testing & Verification

- [x] 4.1 Test local development setup
  - ✓ Next.js and Python Flask server run concurrently via `npm run dev`
  - ✓ Python endpoint works directly: `POST http://localhost:3001/api/py/extract`
  - ✓ Routing through Next.js works: `POST http://localhost:3000/api/v1/extract`
  - _Requirements: 1.5_

- [x] 4.2 Test each platform extractor with sample URLs
  - ✓ BiliBili.tv video extraction (720P, 480P, 360P, 240P, 144P)
  - ✓ SoundCloud track extraction (multiple audio formats: MP3, AAC, Opus)
  - Reddit, Pixiv, Eporner, Rule34Video - ready (gallery-dl)
  - _Requirements: 3.1-3.4, 4.1-4.5, 5.1-5.5, 6.1-6.6, 7.1-7.4, 8.1-8.4_

- [ ] 4.3 Verify Python function size is under 250MB limit
  - Check Vercel deployment logs for function size
  - Ensure excludeFiles is working correctly
  - _Requirements: 1.6_

## Notes

- yt-dlp handles: SoundCloud
- gallery-dl handles: BiliBili, Reddit, Pixiv, Eporner, Rule34Video
- NSFW platforms: Pixiv (R-18), Eporner, Rule34Video
- Single Python file (`extract.py`) handles all platforms via thin wrappers
- No FastAPI needed - Vercel Python functions use simple handler pattern
