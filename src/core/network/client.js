/**
 * Undici HTTP client wrapper
 * Provides streaming response support, connection pooling, and abort handling
 */

import { request, Agent } from 'undici';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable, PassThrough } from 'stream';
import { config } from '../../config/index.js';
import { NetworkError, ErrorCode } from '../../utils/error.utils.js';
import { logger } from '../../utils/logger.js';

const agent = new Agent({
  connections: 100,
  pipelining: 10,
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 600000
});

/**
 * Fetch URL with streaming support and proper redirect tracking
 */
export async function fetchStream(url, options = {}) {
  trackRequest(); // Track for connection status
  
  const {
    headers = {},
    method = 'GET',
    timeout = config.requestTimeout,
    signal,
    maxRedirects = config.maxRedirects,
    followRedirects = true
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
        bodyTimeout: timeout,
        signal,
        maxRedirections: 0, // Handle redirects manually
        throwOnError: false
      });

      const { statusCode, headers: responseHeaders, body } = response;

      const headersObj = {};
      for (const [key, value] of Object.entries(responseHeaders)) {
        headersObj[key.toLowerCase()] = value;
      }

      // Handle redirects manually to track final URL
      if (followRedirects && statusCode >= 300 && statusCode < 400 && headersObj.location) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          await body.dump(); // Properly consume body
          throw new NetworkError('Too many redirects', { code: ErrorCode.FETCH_FAILED });
        }

        await body.dump(); // Properly consume body before redirect
        
        // Resolve relative URLs
        const newUrl = new URL(headersObj.location, currentUrl).href;
        currentUrl = newUrl;
        continue;
      }

      if (statusCode >= 400) {
        await body.dump();
        if (statusCode === 429) {
          throw new NetworkError('Rate limited', { code: ErrorCode.RATE_LIMITED, statusCode });
        }
        throw new NetworkError(`HTTP ${statusCode}`, { statusCode });
      }

      return {
        headers: headersObj,
        status: statusCode,
        stream: decompressStream(body, headersObj['content-encoding']),
        finalUrl: currentUrl
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new NetworkError('Request aborted', { code: ErrorCode.TIMEOUT });
      }
      if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.code === 'UND_ERR_HEADERS_TIMEOUT') {
        throw new NetworkError('Request timeout', { code: ErrorCode.TIMEOUT });
      }
      if (error instanceof NetworkError) throw error;
      
      logger.error('network', 'Fetch failed', error);
      throw new NetworkError(error.message, { originalError: error.message });
    }
  }
}

/**
 * Fetch URL and return full body as string
 */
export async function fetchText(url, options = {}) {
  const { stream, headers, status, finalUrl } = await fetchStream(url, options);
  
  try {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return { headers, status, data: buffer.toString('utf-8'), finalUrl };
  } catch (error) {
    logger.error('network', 'Failed to read stream', error);
    throw new NetworkError('Failed to read response body', { originalError: error.message });
  }
}

/**
 * Follow redirects and return final URL
 */
export async function resolveUrl(url, options = {}) {
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
        throwOnError: false
      });

      const { statusCode, headers: respHeaders, body } = response;
      await body.dump();

      if (statusCode >= 300 && statusCode < 400 && respHeaders.location) {
        redirectCount++;
        currentUrl = new URL(respHeaders.location, currentUrl).href;
        continue;
      }

      return currentUrl;
    } catch (error) {
      logger.warn('network', 'HEAD failed, trying GET', { url: currentUrl });
      
      // Fallback to GET
      const { finalUrl } = await fetchStream(currentUrl, { headers, timeout, maxRedirects: maxRedirects - redirectCount });
      return finalUrl;
    }
  }

  return currentUrl;
}

export async function closeConnections() {
  await agent.close();
  logger.info('network', 'Connections closed');
}

/**
 * Get connection pool stats
 * @returns {object} Connection stats
 */
let lastRequestTime = null;

export function getConnectionStats() {
  const now = Date.now();
  const keepAliveTimeout = 60000; // 60s
  const isWarm = lastRequestTime && (now - lastRequestTime) < keepAliveTimeout;
  
  return {
    isWarm,
    lastRequestTime,
    timeSinceLastRequest: lastRequestTime ? now - lastRequestTime : null,
    keepAliveTimeout
  };
}

export function trackRequest() {
  lastRequestTime = Date.now();
}

/**
 * Get file size from URL using HEAD request
 * @param {string} url - URL to check
 * @param {number} timeout - Timeout in ms (default 5000)
 * @returns {Promise<number|null>} File size in bytes or null
 */
export async function getFileSize(url, timeout = 5000) {
  try {
    const response = await request(url, {
      method: 'HEAD',
      dispatcher: agent,
      headersTimeout: timeout,
      maxRedirections: 5,
      throwOnError: false
    });

    await response.body.dump();
    
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get file sizes for multiple URLs in parallel
 * @param {string[]} urls - Array of URLs
 * @param {number} timeout - Timeout per request
 * @returns {Promise<Map<string, number|null>>} Map of URL to size
 */
export async function getFileSizes(urls, timeout = 5000) {
  const results = new Map();
  
  await Promise.all(
    urls.map(async (url) => {
      const size = await getFileSize(url, timeout);
      results.set(url, size);
    })
  );
  
  return results;
}

/**
 * Decompress stream based on content-encoding
 */
function decompressStream(stream, encoding) {
  if (!encoding) return stream;
  
  const enc = encoding.toLowerCase();
  
  if (enc === 'br') {
    const decompress = createBrotliDecompress();
    stream.pipe(decompress);
    return decompress;
  }
  
  if (enc === 'gzip') {
    const decompress = createGunzip();
    stream.pipe(decompress);
    return decompress;
  }
  
  if (enc === 'deflate') {
    const decompress = createInflate();
    stream.pipe(decompress);
    return decompress;
  }
  
  return stream;
}
