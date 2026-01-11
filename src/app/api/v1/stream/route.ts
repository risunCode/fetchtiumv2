/**
 * GET /api/v1/stream
 * Proxy video/audio stream with range request support
 * 
 * Query parameters:
 * - url: string (optional) - Media URL to stream (must be from previous extraction)
 * - h: string (optional) - Hash from extraction result (shorter alternative to url)
 * 
 * Use either `url` or `h` parameter. Hash is preferred for shorter URLs.
 * 
 * Supports:
 * - Range requests for seeking
 * - Content-Type passthrough with MIME-first fallback
 * - Streaming response
 * - Chunked transfer encoding
 */

import { NextRequest } from 'next/server';
import { fetchStream } from '@/lib/core/network/client';
import { isValidUrl as isStoredUrl, getUrlByHash } from '@/lib/utils/url-store';
import { analyze } from '@/lib/utils/mime.helper';
import { logger } from '@/lib/utils/logger';
import type { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Headers to forward from source response
 * These are the relevant headers for streaming media
 */
const HEADERS_TO_FORWARD = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
] as const;

/**
 * Convert Node.js Readable stream to Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', (err) => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

/**
 * GET handler for media streaming
 */
export async function GET(request: NextRequest): Promise<Response> {
  const urlParam = request.nextUrl.searchParams.get('url');
  const hashParam = request.nextUrl.searchParams.get('h');

  // Resolve URL from hash or direct param
  let url: string | null = null;
  
  if (hashParam) {
    // Lookup URL by hash
    url = getUrlByHash(hashParam);
    if (!url) {
      return new Response(JSON.stringify({ 
        error: { 
          code: 'INVALID_HASH', 
          message: 'Invalid or expired hash' 
        } 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else if (urlParam) {
    url = urlParam;
  }

  // Validate URL parameter
  if (!url) {
    return new Response(JSON.stringify({ 
      error: { 
        code: 'MISSING_PARAMETER', 
        message: 'URL or hash parameter required' 
      } 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if URL is from known platforms with their own expiry
  const isYouTubeUrl = url.includes('googlevideo.com') || url.includes('youtube.com');
  const isBiliBiliUrl = url.includes('bilivideo.') || url.includes('bilibili.') || url.includes('akamaized.net') || url.includes('bstarstatic.com');

  // Validate URL is from previous extraction (prevent open proxy) - skip if from hash
  // Skip validation for YouTube/BiliBili - they have their own expiry mechanism
  if (!hashParam && !isYouTubeUrl && !isBiliBiliUrl && !isStoredUrl(url)) {
    logger.warn('stream', 'URL not in store', { url: url.substring(0, 50) });
    return new Response(JSON.stringify({ 
      error: { 
        code: 'UNAUTHORIZED_URL', 
        message: 'URL not authorized' 
      } 
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get range header for seeking support
    const rangeHeader = request.headers.get('range');
    const headers: Record<string, string> = {};
    
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    // Add platform-specific headers
    // BiliBili requires Referer + User-Agent + Origin headers
    if (url.includes('bilivideo.') || url.includes('bilibili.') || url.includes('akamaized.net') || url.includes('bstarstatic.com')) {
      headers['Referer'] = 'https://www.bilibili.tv/';
      headers['Origin'] = 'https://www.bilibili.tv';
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    // YouTube requires Referer
    else if (url.includes('googlevideo.com') || url.includes('youtube.com')) {
      headers['Referer'] = 'https://www.youtube.com/';
    }

    logger.info('stream', 'Streaming', { 
      url: url.substring(0, 50), 
      range: rangeHeader || 'none' 
    });

    // Fetch the stream with streamMode enabled (no body timeout)
    const result = await fetchStream(url, { headers, streamMode: true });

    // Build response headers
    const responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges',
    };

    // Check if source uses chunked transfer encoding
    const isChunked = result.headers['transfer-encoding']?.toLowerCase() === 'chunked';

    // Forward relevant headers from source
    for (const header of HEADERS_TO_FORWARD) {
      const value = result.headers[header];
      if (value) {
        // Don't forward Content-Length for chunked responses
        if (header === 'content-length' && isChunked) {
          continue;
        }
        responseHeaders[header.split('-').map((w, i) => 
          i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)
        ).join('-')] = value;
      }
    }

    // Fallback: Set Accept-Ranges if not provided by source
    if (!result.headers['accept-ranges']) {
      responseHeaders['Accept-Ranges'] = 'bytes';
    }

    // Determine Content-Type using MIME-first approach if not already set
    // Priority: Content-Type header from source > URL extension analysis
    if (!responseHeaders['Content-Type']) {
      const sourceContentType = result.headers['content-type'];
      if (sourceContentType) {
        responseHeaders['Content-Type'] = sourceContentType;
      } else {
        // Fallback: use analyze() to detect from URL
        const analysis = analyze({ url });
        responseHeaders['Content-Type'] = analysis.mime || 'application/octet-stream';
      }
    }

    // Convert Node stream to Web stream
    const webStream = nodeStreamToWebStream(result.stream as Readable);

    // Return streaming response
    // Status 206 for partial content (range request), 200 for full content
    const status = result.headers['content-range'] ? 206 : 200;

    return new Response(webStream, {
      status,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error('stream', 'Stream failed', {
      url: url.substring(0, 50),
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(JSON.stringify({ 
      error: { 
        code: 'STREAM_FAILED', 
        message: 'Stream failed' 
      } 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
