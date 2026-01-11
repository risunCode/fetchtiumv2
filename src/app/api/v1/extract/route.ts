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
import { addUrls } from '@/lib/utils/url-store';
import { buildMeta, buildErrorResponse } from '@/lib/utils/response.utils';
import { ErrorCode } from '@/lib/utils/error.utils';
import { isValidUrl } from '@/lib/utils/url.utils';
import { addFilenames } from '@/lib/utils/filename.utils';
import { logger } from '@/lib/utils/logger';
import { updateLastRequestTime } from '@/app/api/v1/events/route';
import type { ExtractRequest } from '@/types/api';
import type { ExtractResult, ExtractError, ResponseMeta } from '@/types/extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST handler for media extraction
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractResult | ExtractError>> {
  const startTime = Date.now();
  
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

    // Check platform support (TypeScript or Python)
    const isPython = isPythonPlatform(url);
    if (!isPython && !isSupported(url)) {
      return NextResponse.json(
        buildErrorResponse(ErrorCode.UNSUPPORTED_PLATFORM, 'Platform not supported', {
          responseTime: Date.now() - startTime,
          accessMode: 'public',
        }),
        { status: 400 }
      );
    }

    logger.info('extract', 'Starting extraction', { url: url.substring(0, 50), isPython });

    // Update last request time for warm/cold status tracking
    updateLastRequestTime();

    // Route to Python extractor if needed
    if (isPython) {
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
 * Handle extraction via Python serverless function
 */
async function handlePythonExtraction(
  url: string,
  cookie: string | undefined,
  startTime: number
): Promise<NextResponse<ExtractResult | ExtractError>> {
  try {
    // In development, call Python server directly
    // In production (Vercel), call the Python function via internal URL
    let pyUrl: string;
    
    if (process.env.NODE_ENV === 'development') {
      // Direct call to Python Flask server
      pyUrl = 'http://127.0.0.1:3001/api/extract';
    } else if (process.env.VERCEL_URL) {
      // Vercel production/preview - call Python function directly
      // Use relative URL to avoid middleware (internal call)
      pyUrl = `https://${process.env.VERCEL_URL}/api/extract`;
    } else {
      // Fallback
      pyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/extract`;
    }

    // Add internal header to bypass middleware for Vercel internal calls
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.VERCEL_URL) {
      headers['x-internal-call'] = 'true';
    }

    const pyResponse = await fetch(pyUrl, {
      method: 'POST',
      headers,
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

    // Handle error from Python extractor
    if (!result.success) {
      logger.warn('extract', 'Python extraction failed', {
        url: url.substring(0, 50),
        error: result.error?.code,
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

    logger.info('extract', 'Python extraction successful', {
      url: url.substring(0, 50),
      platform: result.platform,
      items: result.items?.length || 0,
      responseTime,
    });

    // Add filenames
    addFilenames(result);

    // Return successful result
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
