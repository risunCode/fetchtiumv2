/**
 * Undici HTTP client wrapper with HTTP/2 support
 * 
 * Uses HTTP/2 when available (Vercel Functions, Railway Node.js)
 * Falls back to undici HTTP/1.1 for Edge runtime or when HTTP/2 unavailable
 * 
 * Provides streaming response support, connection pooling, and abort handling
 */

import { request, Agent, Dispatcher } from 'undici';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
import type { Readable, Transform } from 'stream';
import { isHttp2Available, http2Fetch, getEnvironmentInfo } from './http2-client';

// Detect HTTP/2 availability at startup (zero runtime overhead)
const USE_HTTP2 = isHttp2Available();

// Log environment info on startup (development only)
if (process.env.NODE_ENV === 'development') {
  const envInfo = getEnvironmentInfo();
  console.log('[Network] Environment:', envInfo);
  console.log('[Network] Using HTTP/2:', USE_HTTP2);
}

/**
 * Network configuration defaults
 */
const DEFAULT_REQUEST_TIMEOUT = 30000;
const DEFAULT_MAX_REDIRECTS = 5;
const KEEP_ALIVE_TIMEOUT = 60000;

/**
 * Error codes for network operations
 */
export enum NetworkErrorCode {
  FETCH_FAILED = 'FETCH_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Custom network error class
 */
export class NetworkError extends Error {
  code: NetworkErrorCode | string;
  statusCode?: number;
  originalError?: string;

  constructor(
    message: string,
    options: {
      code?: NetworkErrorCode | string;
      statusCode?: number;
      originalError?: string;
    } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.code = options.code || NetworkErrorCode.FETCH_FAILED;
    this.statusCode = options.statusCode;
    this.originalError = options.originalError;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Options for fetch operations
 */
export interface FetchOptions {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE';
  timeout?: number;
  signal?: AbortSignal;
  maxRedirects?: number;
  followRedirects?: boolean;
  /**
   * Stream mode - disables body timeout for long-running streams
   * Use for media streaming where we pipe chunks progressively
   */
  streamMode?: boolean;
}

/**
 * Result of a streaming fetch operation
 */
export interface FetchStreamResult {
  headers: Record<string, string>;
  status: number;
  stream: Readable | Transform;
  finalUrl: string;
}

/**
 * Result of a text fetch operation
 */
export interface FetchTextResult {
  headers: Record<string, string>;
  status: number;
  data: string;
  finalUrl: string;
}

/**
 * Connection pool statistics
 */
export interface ConnectionStats {
  isWarm: boolean;
  lastRequestTime: number | null;
  timeSinceLastRequest: number | null;
  keepAliveTimeout: number;
}


// Shared agent for connection pooling
const agent = new Agent({
  connections: 100,
  pipelining: 10,
  keepAliveTimeout: KEEP_ALIVE_TIMEOUT,
  keepAliveMaxTimeout: 600000,
});

// Track last request time for connection warmth detection
let lastRequestTime: number | null = null;

/**
 * Track a request for connection status monitoring
 */
export function trackRequest(): void {
  lastRequestTime = Date.now();
}

/**
 * Get connection pool statistics
 */
export function getConnectionStats(): ConnectionStats {
  const now = Date.now();
  const isWarm = lastRequestTime !== null && now - lastRequestTime < KEEP_ALIVE_TIMEOUT;

  return {
    isWarm,
    lastRequestTime,
    timeSinceLastRequest: lastRequestTime ? now - lastRequestTime : null,
    keepAliveTimeout: KEEP_ALIVE_TIMEOUT,
  };
}

/**
 * Decompress stream based on content-encoding header
 */
function decompressStream(
  stream: Dispatcher.ResponseData['body'],
  encoding?: string
): Readable | Transform {
  if (!encoding) return stream as Readable;

  const enc = encoding.toLowerCase();

  if (enc === 'br') {
    const decompress = createBrotliDecompress();
    (stream as Readable).pipe(decompress);
    return decompress;
  }

  if (enc === 'gzip') {
    const decompress = createGunzip();
    (stream as Readable).pipe(decompress);
    return decompress;
  }

  if (enc === 'deflate') {
    const decompress = createInflate();
    (stream as Readable).pipe(decompress);
    return decompress;
  }

  return stream as Readable;
}

/**
 * Fetch URL with streaming support and proper redirect tracking
 * Uses HTTP/2 when available, falls back to undici HTTP/1.1
 */
export async function fetchStream(
  url: string,
  options: FetchOptions = {}
): Promise<FetchStreamResult> {
  trackRequest();

  const {
    headers = {},
    method = 'GET',
    timeout = DEFAULT_REQUEST_TIMEOUT,
    signal,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    followRedirects = true,
    streamMode = false,
  } = options;

  // Try HTTP/2 for HTTPS URLs when available
  if (USE_HTTP2 && url.startsWith('https://')) {
    try {
      const result = await http2Fetch(url, {
        method,
        headers,
        timeout: streamMode ? 0 : timeout,
        followRedirects,
        maxRedirects,
      });

      return {
        headers: result.headers,
        status: result.status,
        stream: decompressStream(
          result.stream as unknown as Dispatcher.ResponseData['body'],
          result.headers['content-encoding']
        ),
        finalUrl: result.finalUrl,
      };
    } catch (error) {
      // Fall back to undici on HTTP/2 failure
      if (process.env.NODE_ENV === 'development') {
        console.log('[Network] HTTP/2 failed, falling back to undici:', error);
      }
    }
  }

  // Fallback: Use undici (HTTP/1.1)
  return fetchStreamUndici(url, options);
}

/**
 * Fetch URL with undici (HTTP/1.1) - internal implementation
 */
async function fetchStreamUndici(
  url: string,
  options: FetchOptions = {}
): Promise<FetchStreamResult> {
  const {
    headers = {},
    method = 'GET',
    timeout = DEFAULT_REQUEST_TIMEOUT,
    signal,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    followRedirects = true,
    streamMode = false,
  } = options;

  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    try {
      const response = await request(currentUrl, {
        method,
        headers,
        dispatcher: agent,
        headersTimeout: timeout,
        // Stream mode: no body timeout (for progressive streaming)
        // Normal mode: use timeout to prevent hanging requests
        bodyTimeout: streamMode ? 0 : timeout,
        signal,
        maxRedirections: 0, // Handle redirects manually
      } as Parameters<typeof request>[1]);

      const { statusCode, headers: responseHeaders, body } = response;

      // Convert headers to lowercase key object
      const headersObj: Record<string, string> = {};
      for (const [key, value] of Object.entries(responseHeaders)) {
        if (value !== undefined) {
          headersObj[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
        }
      }

      // Handle redirects manually to track final URL
      if (followRedirects && statusCode >= 300 && statusCode < 400 && headersObj.location) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          await body.dump();
          throw new NetworkError('Too many redirects', { code: NetworkErrorCode.FETCH_FAILED });
        }

        await body.dump();

        // Resolve relative URLs
        const newUrl = new URL(headersObj.location, currentUrl).href;
        currentUrl = newUrl;
        continue;
      }

      if (statusCode >= 400) {
        await body.dump();
        if (statusCode === 429) {
          throw new NetworkError('Rate limited', {
            code: NetworkErrorCode.RATE_LIMITED,
            statusCode,
          });
        }
        throw new NetworkError(`HTTP ${statusCode}`, { statusCode });
      }

      return {
        headers: headersObj,
        status: statusCode,
        stream: decompressStream(body, headersObj['content-encoding']),
        finalUrl: currentUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new NetworkError('Request aborted', { code: NetworkErrorCode.TIMEOUT });
        }
        if (
          (error as NodeJS.ErrnoException).code === 'UND_ERR_CONNECT_TIMEOUT' ||
          (error as NodeJS.ErrnoException).code === 'UND_ERR_HEADERS_TIMEOUT'
        ) {
          throw new NetworkError('Request timeout', { code: NetworkErrorCode.TIMEOUT });
        }
        if (error instanceof NetworkError) throw error;

        throw new NetworkError(error.message, { originalError: error.message });
      }
      throw new NetworkError('Unknown error', { originalError: String(error) });
    }
  }
}


/**
 * Fetch URL and return full body as string
 */
export async function fetchText(
  url: string,
  options: FetchOptions = {}
): Promise<FetchTextResult> {
  const { stream, headers, status, finalUrl } = await fetchStream(url, options);

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    return { headers, status, data: buffer.toString('utf-8'), finalUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NetworkError('Failed to read response body', { originalError: message });
  }
}

/**
 * Follow redirects and return final URL
 */
export async function resolveUrl(
  url: string,
  options: { headers?: Record<string, string>; timeout?: number; maxRedirects?: number } = {}
): Promise<string> {
  const { headers = {}, timeout = 10000, maxRedirects = 10 } = options;

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    try {
      const response = await request(currentUrl, {
        method: 'HEAD',
        headers,
        dispatcher: agent,
        headersTimeout: timeout,
        maxRedirections: 0,
      } as Parameters<typeof request>[1]);

      const { statusCode, headers: respHeaders, body } = response;
      await body.dump();

      const location = respHeaders.location;
      if (statusCode >= 300 && statusCode < 400 && location) {
        redirectCount++;
        const locationStr = Array.isArray(location) ? location[0] : location;
        currentUrl = new URL(locationStr, currentUrl).href;
        continue;
      }

      return currentUrl;
    } catch {
      // Fallback to GET if HEAD fails
      const { finalUrl } = await fetchStream(currentUrl, {
        headers,
        timeout,
        maxRedirects: maxRedirects - redirectCount,
      });
      return finalUrl;
    }
  }

  return currentUrl;
}

/**
 * Close all connections in the pool
 */
export async function closeConnections(): Promise<void> {
  await agent.close();
}

/**
 * Get file size from URL using HEAD request
 */
export async function getFileSize(url: string, timeout = 5000): Promise<number | null> {
  try {
    const response = await request(url, {
      method: 'HEAD',
      dispatcher: agent,
      headersTimeout: timeout,
      bodyTimeout: timeout,
    } as Parameters<typeof request>[1]);

    await response.body.dump();

    const contentLength = response.headers['content-length'];
    if (contentLength) {
      const lengthStr = Array.isArray(contentLength) ? contentLength[0] : contentLength;
      return parseInt(lengthStr, 10);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get file sizes for multiple URLs in parallel
 */
export async function getFileSizes(
  urls: string[],
  timeout = 5000
): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();

  await Promise.all(
    urls.map(async (url) => {
      const size = await getFileSize(url, timeout);
      results.set(url, size);
    })
  );

  return results;
}

// Re-export HTTP/2 utilities
export { isHttp2Available, getEnvironmentInfo, getSessionStats, closeAllSessions } from './http2-client';

/**
 * Check if HTTP/2 is being used
 */
export function isUsingHttp2(): boolean {
  return USE_HTTP2;
}
