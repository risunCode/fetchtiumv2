/**
 * GET /api/v1/download
 * Proxy file download with Content-Disposition header
 * 
 * Query parameters:
 * - url: string (optional) - Media URL to download (must be from previous extraction)
 * - h: string (optional) - Hash from extraction result (shorter alternative to url)
 * - filename?: string - Optional filename for download (from extraction result)
 * 
 * Use either `url` or `h` parameter. Hash is preferred for shorter URLs.
 * 
 * Response: Streaming file download with proper headers
 * 
 * Filename priority:
 * 1. Use filename from query param (from source.filename in extraction result)
 * 2. Generate filename using MIME-first approach from mime.helper
 */

import { NextRequest } from 'next/server';
import { fetchStream } from '@/lib/core/network/client';
import { isValidUrl as isStoredUrl, getUrlByHash } from '@/lib/utils/url-store';
import { analyze } from '@/lib/utils/mime.helper';
import { sanitize } from '@/lib/utils/filename.utils';
import { logger } from '@/lib/utils/logger';
import {
  isYouTubeWatchUrl,
  downloadAndMergeYouTubeToMp4,
  cleanupYouTubeTempDir,
} from '@/lib/utils/youtube-fastpath';
import type { Readable } from 'stream';
import fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeStreamChunk(chunk: string | Buffer): Uint8Array {
  if (typeof chunk === 'string') {
    return new TextEncoder().encode(chunk);
  }
  return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
}

/**
 * Convert Node.js Readable stream to Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: string | Buffer) => {
        controller.enqueue(normalizeStreamChunk(chunk));
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
 * Generate filename from URL using MIME-first approach
 * Uses analyze() from mime.helper as primary detection method
 * 
 * @param url - Media URL
 * @param contentType - Content-Type header from response
 * @returns Generated filename
 */
function generateFilename(url: string, contentType?: string): string {
  try {
    // Use analyze() with Content-Type first, then URL extension fallback
    const analysis = analyze({ url, contentType });
    const ext = analysis.extension || 'mp4';
    
    // Try to get a meaningful basename from URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const pathParts = pathname.split('/').filter(Boolean);
    
    // Get last path segment
    let basename = pathParts[pathParts.length - 1] || 'download';
    
    // Remove existing extension if present
    const extMatch = basename.match(/\.([a-z0-9]+)$/i);
    if (extMatch) {
      basename = basename.slice(0, -extMatch[0].length);
    }
    
    // Sanitize basename
    basename = sanitize(basename, 50) || 'download';
    
    return `${basename}.${ext}`;
  } catch {
    return 'download.mp4';
  }
}

/**
 * Sanitize filename for Content-Disposition header
 * Returns ASCII-only version for basic filename parameter
 */
function sanitizeFilenameAscii(filename: string): string {
  return filename
    // Remove non-ASCII characters
    .replace(/[^\x20-\x7E]/g, '_')
    // Remove or replace unsafe characters
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 200) || 'download';
}

/**
 * Sanitize filename for Content-Disposition header
 * Keeps unicode but removes unsafe chars
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 200) || 'download';
}

/**
 * GET handler for file download
 * 
 * Filename priority:
 * 1. Use filename from query param (from source.filename in extraction result)
 * 2. Generate filename using MIME-first approach from mime.helper
 */
export async function GET(request: NextRequest): Promise<Response> {
  const urlParam = request.nextUrl.searchParams.get('url');
  const watchUrlParam =
    request.nextUrl.searchParams.get('watchUrl') ||
    request.nextUrl.searchParams.get('sourceUrl') ||
    request.nextUrl.searchParams.get('watch');
  const hashParam = request.nextUrl.searchParams.get('h');
  const requestedFilename = request.nextUrl.searchParams.get('filename');
  const qualityParam = request.nextUrl.searchParams.get('quality');

  logger.debug('download', 'Download request', {
    hasUrl: !!urlParam,
    hasHash: !!hashParam,
    hashLength: hashParam?.length,
    filename: requestedFilename?.substring(0, 30),
  });

  // Resolve URL from hash or direct param
  let url: string | null = null;
  
  if (hashParam) {
    url = getUrlByHash(hashParam);
    logger.debug('download', 'Hash lookup result', {
      hashPrefix: hashParam.substring(0, 20),
      urlFound: !!url,
      urlPrefix: url?.substring(0, 50),
    });
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
  } else if (watchUrlParam) {
    url = watchUrlParam;
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
  const isYouTubeUrl = url.includes('googlevideo.com') || url.includes('youtube.com') || url.includes('youtu.be');
  const isBiliBiliUrl = url.includes('bilivideo.') || url.includes('bilibili.') || url.includes('akamaized.net');
  const isYouTubeWatchRequest = isYouTubeWatchUrl(url);

  // Validate URL is from previous extraction (prevent open proxy) - skip if from hash
  // Skip validation for YouTube/BiliBili - they have their own expiry mechanism
  if (!hashParam && !isYouTubeUrl && !isBiliBiliUrl && !isStoredUrl(url)) {
    logger.warn('download', 'URL not in store', { url: url.substring(0, 50) });
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
    logger.info('download', 'Starting download', { 
      url: url.substring(0, 50),
      filename: requestedFilename || 'auto',
    });

    if (isYouTubeWatchRequest) {
      try {
        const { filePath, tempDir } = await downloadAndMergeYouTubeToMp4(url, qualityParam);
        const fileStat = await fs.promises.stat(filePath);

        let filename = requestedFilename
          ? sanitizeFilename(requestedFilename)
          : generateFilename(url, 'video/mp4');
        filename = filename.toLowerCase().endsWith('.mp4') ? filename : `${filename}.mp4`;

        const fileStream = fs.createReadStream(filePath);
        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) {
            return;
          }
          cleanedUp = true;
          cleanupYouTubeTempDir(tempDir).catch(() => {});
        };

        fileStream.on('close', cleanup);
        fileStream.on('error', cleanup);

        const filenameAscii = sanitizeFilenameAscii(filename);
        const filenameUtf8 = encodeURIComponent(sanitizeFilename(filename));

        const webStream = new ReadableStream<Uint8Array>({
          start(controller) {
            fileStream.on('data', (chunk: string | Buffer) => {
              controller.enqueue(normalizeStreamChunk(chunk));
            });
            fileStream.on('end', () => {
              controller.close();
            });
            fileStream.on('error', (error) => {
              controller.error(error);
            });
          },
          cancel() {
            fileStream.destroy();
            cleanup();
          },
        });

        return new Response(webStream, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(fileStat.size),
            'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameUtf8}`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition, Content-Type',
          },
        });
      } catch (fastPathError) {
        logger.warn('download', 'YouTube fast path failed, falling back to proxy stream', {
          url: url.substring(0, 80),
          error: fastPathError instanceof Error ? fastPathError.message : String(fastPathError),
        });
      }
    }

    // Build request headers with platform-specific Referer
    const requestHeaders: Record<string, string> = {};
    
    // BiliBili requires Referer + User-Agent + Origin headers
    if (url.includes('bilivideo.') || url.includes('bilibili.') || url.includes('akamaized.net')) {
      requestHeaders['Referer'] = 'https://www.bilibili.tv/';
      requestHeaders['Origin'] = 'https://www.bilibili.tv';
      requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    // YouTube requires Referer
    else if (url.includes('googlevideo.com') || url.includes('youtube.com') || url.includes('youtu.be')) {
      requestHeaders['Referer'] = 'https://www.youtube.com/';
    }
    // Pixiv requires Referer (images from i.pximg.net)
    else if (url.includes('pximg.net') || url.includes('pixiv.net')) {
      requestHeaders['Referer'] = 'https://www.pixiv.net/';
    }

    // Fetch the file with streamMode enabled (no body timeout for large files)
    const result = await fetchStream(url, { headers: requestHeaders, streamMode: true });

    // Get Content-Type from response headers
    const responseContentType = result.headers['content-type'];
    
    // Determine content type using MIME-first approach
    // Priority: Content-Type header > URL extension
    const analysis = analyze({ url, contentType: responseContentType });
    const contentType = analysis.mime || responseContentType || 'application/octet-stream';

    // Determine filename
    // Priority: 1. Requested filename (from extraction), 2. Generate using MIME-first
    let filename: string;
    if (requestedFilename) {
      // Use the filename from extraction result (already properly formatted)
      filename = sanitizeFilename(requestedFilename);
    } else {
      // Generate filename using MIME-first approach
      filename = generateFilename(url, responseContentType);
      filename = sanitizeFilename(filename);
    }

    // Build response headers
    // Use ASCII-only for basic filename, UTF-8 encoded for filename*
    const filenameAscii = sanitizeFilenameAscii(filename);
    const filenameUtf8 = encodeURIComponent(sanitizeFilename(filename));
    
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameUtf8}`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition, Content-Type',
    };

    // Pass through content length if available
    if (result.headers['content-length']) {
      responseHeaders['Content-Length'] = result.headers['content-length'];
    }

    // Convert Node stream to Web stream
    const webStream = nodeStreamToWebStream(result.stream as Readable);

    logger.info('download', 'Download started', { 
      filename,
      contentType,
      size: result.headers['content-length'] || 'unknown',
    });

    return new Response(webStream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('download', 'Download failed', {
      url: url.substring(0, 50),
      error: errorMessage,
      stack: errorStack?.substring(0, 200),
    });

    return new Response(JSON.stringify({ 
      error: { 
        code: 'DOWNLOAD_FAILED', 
        message: 'Download failed' 
      } 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
