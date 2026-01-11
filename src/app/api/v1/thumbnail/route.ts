/**
 * GET /api/v1/thumbnail
 * Proxy thumbnail images (bypass hotlink protection)
 * 
 * Query parameters:
 * - url: string (required) - Direct thumbnail URL
 * 
 * Currently supports:
 * - Instagram thumbnails (cdninstagram.com)
 * 
 * Returns proxied image with proper Content-Type
 */

import { NextRequest } from 'next/server';
import { fetchStream } from '@/lib/core/network/client';
import { logger } from '@/lib/utils/logger';
import type { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Allowed thumbnail domains (whitelist for security)
const ALLOWED_DOMAINS = [
  // Instagram
  'cdninstagram.com',
  'scontent.cdninstagram.com',
  'instagram.com',
  // Weibo
  'sinaimg.cn',
  'weibocdn.com',
  // Pixiv
  'pximg.net',
  'i.pximg.net',
  's.pximg.net',
];

/**
 * Check if URL is from allowed domain
 */
function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(domain => hostname.endsWith(domain));
  } catch {
    return false;
  }
}

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
 * GET handler for thumbnail proxy
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl.searchParams.get('url');

  // Validate URL parameter
  if (!url) {
    return new Response(JSON.stringify({ error: 'URL parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Security: only allow whitelisted domains
  if (!isAllowedDomain(url)) {
    logger.warn('thumbnail', 'Domain not allowed', { url: url.substring(0, 50) });
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    logger.debug('thumbnail', 'Proxying thumbnail', { url: url.substring(0, 50) });

    // Build request headers with platform-specific Referer
    const requestHeaders: Record<string, string> = {};
    
    // Pixiv requires Referer
    if (url.includes('pximg.net')) {
      requestHeaders['Referer'] = 'https://www.pixiv.net/';
    }
    // Weibo requires Referer
    else if (url.includes('sinaimg.cn') || url.includes('weibocdn.com')) {
      requestHeaders['Referer'] = 'https://weibo.com/';
    }

    // Fetch the thumbnail
    const result = await fetchStream(url, {
      headers: requestHeaders,
      timeout: 10000,
    });

    // Build response headers
    const responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    };

    // Pass through Content-Type
    const contentType = result.headers['content-type'];
    if (contentType) {
      responseHeaders['Content-Type'] = contentType;
    } else {
      responseHeaders['Content-Type'] = 'image/jpeg'; // Default for thumbnails
    }

    // Pass through Content-Length if available
    if (result.headers['content-length']) {
      responseHeaders['Content-Length'] = result.headers['content-length'];
    }

    // Convert Node stream to Web stream
    const webStream = nodeStreamToWebStream(result.stream as Readable);

    return new Response(webStream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error('thumbnail', 'Proxy failed', {
      url: url.substring(0, 50),
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(JSON.stringify({ error: 'Thumbnail proxy failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
