/**
 * POST /api/v1/extract
 * Extract media from URL
 * 
 * Request body:
 * - url: string (required) - URL to extract from
 * - cookie?: string - Optional cookie for authenticated content
 * 
 * Response: ExtractResult | ExtractError
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtractor, isSupported } from '@/lib/extractors';
import { isPythonPlatform } from '@/lib/extractors/python-platforms';
import { getExtractorProfile, isPythonEnabled } from '@/lib/config';
import { addUrls } from '@/lib/utils/url-store';
import { buildMeta, buildErrorResponse } from '@/lib/utils/response.utils';
import { ErrorCode } from '@/lib/utils/error.utils';
import { isValidUrl } from '@/lib/utils/url.utils';
import { addFilenames } from '@/lib/utils/filename.utils';
import { logger } from '@/lib/utils/logger';
import type { ExtractRequest } from '@/types/api';
import type { ExtractResult, ExtractError, ResponseMeta } from '@/types/extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGE_RESTRICTED_SIGNATURES = [
  'age-restricted',
  'age restricted',
  'confirm your age',
  'sign in to confirm your age',
  'mature content',
  'inappropriate for some users',
  'verify your age',
];

function hasAgeRestrictedSignature(value: string): boolean {
  const lower = value.toLowerCase();
  return AGE_RESTRICTED_SIGNATURES.some((signature) => lower.includes(signature));
}

function normalizeUpstreamAgeRestrictedError(error: { code?: string; message?: string } | undefined): void {
  if (!error || !error.message) {
    return;
  }

  if (error.code !== ErrorCode.DELETED_CONTENT) {
    return;
  }

  if (hasAgeRestrictedSignature(error.message)) {
    error.code = ErrorCode.AGE_RESTRICTED;
  }
}

/**
 * POST handler for media extraction
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractResult | ExtractError>> {
  const startTime = Date.now();
  const pythonEnabled = isPythonEnabled();
  
  try {
    // Parse request body
    let body: ExtractRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        buildErrorResponse(ErrorCode.INVALID_URL, 'Invalid request body', {
          responseTime: Date.now() - startTime,
          accessMode: 'public',
        }),
        { status: 400 }
      );
    }

    const { url, cookie } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        buildErrorResponse(ErrorCode.INVALID_URL, 'URL is required', {
          responseTime: Date.now() - startTime,
          accessMode: 'public',
        }),
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        buildErrorResponse(ErrorCode.INVALID_URL, 'Invalid URL format', {
          responseTime: Date.now() - startTime,
          accessMode: 'public',
        }),
        { status: 400 }
      );
    }

    const profile = getExtractorProfile();
    const requestedPython = isPythonPlatform(url);

    logger.info('extract', 'Starting extraction', {
      url: url.substring(0, 50),
      profile,
      requestedPython,
      pythonEnabled,
    });

    // In Vercel profile, explicitly block Python platforms with dedicated error code.
    if (requestedPython && !pythonEnabled) {
      return NextResponse.json(
        buildErrorResponse(
          ErrorCode.PLATFORM_UNAVAILABLE_ON_DEPLOYMENT,
          'This platform is available on Railway/Docker deployment.',
          {
            responseTime: Date.now() - startTime,
            accessMode: 'public',
          }
        ),
        { status: 400 }
      );
    }

    // Check platform support after deployment capability gate.
    if (!isSupported(url)) {
      return NextResponse.json(
        buildErrorResponse(ErrorCode.UNSUPPORTED_PLATFORM, 'Platform not supported', {
          responseTime: Date.now() - startTime,
          accessMode: 'public',
        }),
        { status: 400 }
      );
    }

    // Route to Python extractor in full profile
    if (requestedPython) {
      return await handlePythonExtraction(url, cookie, startTime);
    }

    // Get extractor and extract
    const extractor = getExtractor(url);
    const result = await extractor.extract(url, { cookie });

    const responseTime = Date.now() - startTime;
    const usedCookie = !!cookie;

    // Build meta
    const meta: ResponseMeta = buildMeta({
      responseTime,
      accessMode: usedCookie ? 'authenticated' : 'public',
      usedCookie,
    });

    // Handle error result
    if (!result.success) {
      normalizeUpstreamAgeRestrictedError(result.error);

      logger.warn('extract', 'Extraction failed', { 
        url: url.substring(0, 50), 
        error: result.error.code 
      });
      
      return NextResponse.json(
        {
          ...result,
          meta,
        } as ExtractError,
        { status: 400 }
      );
    }

    // Store URLs for proxy validation
    const mediaUrls: string[] = [];
    for (const item of result.items) {
      for (const source of item.sources) {
        if (source.url) {
          mediaUrls.push(source.url);
        }
      }
      if (item.thumbnail) {
        mediaUrls.push(item.thumbnail);
      }
    }
    addUrls(mediaUrls);

    logger.info('extract', 'Extraction successful', {
      url: url.substring(0, 50),
      platform: result.platform,
      items: result.items.length,
      responseTime,
    });

    // Add filenames to each source using MIME-first approach
    addFilenames(result);

    // Use authorDisplay for response if available (for non-ASCII names)
    const displayAuthor = result.authorDisplay || result.author;

    // Return successful result with meta
    const response: ExtractResult = {
      ...result,
      author: displayAuthor, // Use display name for API response
      authorUsername: result.author, // Keep username for reference
      meta,
      usedCookie,
    };

    return NextResponse.json(response);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('extract', 'Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      buildErrorResponse(
        ErrorCode.EXTRACTION_FAILED,
        error instanceof Error ? error.message : 'Extraction failed',
        { responseTime, accessMode: 'public' }
      ),
      { status: 500 }
    );
  }
}

/**
 * Handle extraction via Python service
 */
async function handlePythonExtraction(
  url: string,
  cookie: string | undefined,
  startTime: number
): Promise<NextResponse<ExtractResult | ExtractError>> {
  try {
    let pyUrl: string;

    // In development/full profile, call local Python service
    if (process.env.NODE_ENV === 'development') {
      pyUrl = 'http://127.0.0.1:5000/api/extract';
    } else if (process.env.PYTHON_API_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL) {
      // Explicit Python endpoint for non-Vercel deployments
      const base = (process.env.PYTHON_API_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL || '').replace(/\/$/, '');
      pyUrl = `${base}/api/extract`;
    } else {
      // Docker/Railway default where python runs as sidecar process
      pyUrl = 'http://127.0.0.1:5000/api/extract';
    }

    const pyResponse = await fetch(pyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookie }),
    });

    const result = await pyResponse.json();
    const responseTime = Date.now() - startTime;
    const usedCookie = !!cookie;

    // Build meta
    const meta: ResponseMeta = buildMeta({
      responseTime,
      accessMode: usedCookie ? 'authenticated' : 'public',
      usedCookie,
    });

    if (!result.success) {
      normalizeUpstreamAgeRestrictedError(result.error);

      logger.warn('extract', 'Python extraction failed', {
        url: url.substring(0, 50),
        error: result.error?.code,
        status: pyResponse.status,
      });

      return NextResponse.json(
        {
          ...result,
          meta,
        } as ExtractError,
        { status: 400 }
      );
    }

    // Store URLs for proxy validation
    const mediaUrls: string[] = [];
    for (const item of result.items || []) {
      for (const source of item.sources || []) {
        if (source.url) {
          mediaUrls.push(source.url);
        }
      }
      if (item.thumbnail) {
        mediaUrls.push(item.thumbnail);
      }
    }
    addUrls(mediaUrls);

    addFilenames(result);

    logger.info('extract', 'Python extraction successful', {
      url: url.substring(0, 50),
      platform: result.platform,
      items: result.items?.length || 0,
      responseTime,
    });

    const response: ExtractResult = {
      ...result,
      meta,
      usedCookie,
    };

    return NextResponse.json(response);
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('extract', 'Python extraction error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      buildErrorResponse(
        ErrorCode.EXTRACTION_FAILED,
        error instanceof Error ? error.message : 'Python extraction failed',
        { responseTime, accessMode: 'public' }
      ),
      { status: 500 }
    );
  }
}
