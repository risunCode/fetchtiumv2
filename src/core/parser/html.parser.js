/**
 * HTML Parser - Streaming-aware fragment parser
 * 
 * PRINCIPLES:
 * - NOT full HTML parsing
 * - Streaming buffer with sliding window
 * - Boundary detection (structural stability)
 * - Stop streaming when data is sufficient
 * 
 * This is NOT a DOM parser. It's a fragment extractor.
 */

import { parse } from 'node-html-parser';
import { logger } from '../../utils/logger.js';

/**
 * Streaming buffer for HTML parsing
 * Uses sliding window to avoid loading full HTML into memory
 */
export class StreamingBuffer {
  constructor(maxSize = 500000) { // 500KB default window
    this.buffer = '';
    this.maxSize = maxSize;
    this.bytesRead = 0;
  }

  /**
   * Add chunk to buffer
   * @param {string} chunk - Data chunk
   */
  add(chunk) {
    this.buffer += chunk;
    this.bytesRead += chunk.length;

    // Sliding window: keep only recent data
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }

  /**
   * Get current buffer content
   * @returns {string}
   */
  get() {
    return this.buffer;
  }

  /**
   * Get buffer size
   * @returns {number}
   */
  size() {
    return this.buffer.length;
  }

  /**
   * Get total bytes read
   * @returns {number}
   */
  total() {
    return this.bytesRead;
  }

  /**
   * Clear buffer
   */
  clear() {
    this.buffer = '';
  }
}

/**
 * Check if buffer contains boundary markers
 * Boundary = structural stability point where we can start extraction
 * 
 * @param {string} buffer - HTML buffer
 * @param {string[]} markers - Boundary markers to look for
 * @returns {boolean}
 */
export function hasBoundary(buffer, markers) {
  return markers.some(marker => buffer.includes(marker));
}

/**
 * Extract fragment between markers
 * Used for scoped extraction (not full HTML)
 * 
 * @param {string} html - HTML content
 * @param {string} startMarker - Start marker
 * @param {string} endMarker - End marker (optional)
 * @param {number} maxLength - Max fragment length
 * @returns {string|null} Extracted fragment or null
 */
export function extractFragment(html, startMarker, endMarker = null, maxLength = 50000) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;

  let endIdx;
  if (endMarker) {
    endIdx = html.indexOf(endMarker, startIdx + startMarker.length);
    if (endIdx === -1) {
      endIdx = Math.min(html.length, startIdx + maxLength);
    }
  } else {
    endIdx = Math.min(html.length, startIdx + maxLength);
  }

  return html.substring(startIdx, endIdx);
}

/**
 * Extract script tag content by ID or pattern
 * Common pattern: <script id="__NEXT_DATA__" type="application/json">...</script>
 * 
 * @param {string} html - HTML content
 * @param {string} idOrPattern - Script ID or pattern to match
 * @returns {string|null} Script content or null
 */
export function extractScriptContent(html, idOrPattern) {
  try {
    // Try to find script tag with specific ID
    const idPattern = new RegExp(`<script[^>]*id="${idOrPattern}"[^>]*>([\\s\\S]*?)</script>`, 'i');
    const idMatch = html.match(idPattern);
    if (idMatch) return idMatch[1];

    // Try to find script tag containing pattern
    const contentPattern = new RegExp(`<script[^>]*>([\\s\\S]*?${idOrPattern}[\\s\\S]*?)</script>`, 'i');
    const contentMatch = html.match(contentPattern);
    if (contentMatch) return contentMatch[1];

    return null;
  } catch (error) {
    logger.error('parser', 'Failed to extract script content', error);
    return null;
  }
}

/**
 * Parse HTML fragment using node-html-parser
 * Only use this for small fragments, NOT full HTML
 * 
 * @param {string} html - HTML fragment
 * @param {object} options - Parse options
 * @returns {object} Parsed DOM
 */
export function parseFragment(html, options = {}) {
  return parse(html, {
    lowerCaseTagName: false,
    comment: false,
    blockTextElements: {
      script: true,
      noscript: true,
      style: true
    },
    ...options
  });
}

/**
 * Extract meta tags from HTML
 * @param {string} html - HTML content
 * @returns {object} Meta tags object
 */
export function extractMetaTags(html) {
  const meta = {
    title: null,
    description: null,
    image: null,
    url: null
  };

  try {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) meta.title = titleMatch[1].trim();

    // Extract og:title
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch) meta.title = ogTitleMatch[1];

    // Extract description
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (descMatch) meta.description = descMatch[1];

    // Extract og:description
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (ogDescMatch) meta.description = ogDescMatch[1];

    // Extract og:image
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch) meta.image = ogImageMatch[1];

    // Extract og:url
    const ogUrlMatch = html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/i);
    if (ogUrlMatch) meta.url = ogUrlMatch[1];

  } catch (error) {
    logger.error('parser', 'Failed to extract meta tags', error);
  }

  return meta;
}

/**
 * Decode HTML entities
 * @param {string} str - String with HTML entities
 * @returns {string} Decoded string
 */
export function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
