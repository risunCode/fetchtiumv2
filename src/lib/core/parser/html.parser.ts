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

import { parse, HTMLElement } from 'node-html-parser';

/**
 * Meta tags extracted from HTML
 */
export interface MetaTags {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

/**
 * Parse options for node-html-parser
 */
export interface ParseOptions {
  lowerCaseTagName?: boolean;
  comment?: boolean;
  blockTextElements?: {
    script?: boolean;
    noscript?: boolean;
    style?: boolean;
  };
}

/**
 * Streaming buffer for HTML parsing
 * Uses sliding window to avoid loading full HTML into memory
 */
export class StreamingBuffer {
  private buffer: string = '';
  private maxSize: number;
  private bytesRead: number = 0;

  constructor(maxSize: number = 500000) {
    // 500KB default window
    this.maxSize = maxSize;
  }

  /**
   * Add chunk to buffer
   */
  add(chunk: string): void {
    this.buffer += chunk;
    this.bytesRead += chunk.length;

    // Sliding window: keep only recent data
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }

  /**
   * Get current buffer content
   */
  get(): string {
    return this.buffer;
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Get total bytes read
   */
  total(): number {
    return this.bytesRead;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = '';
  }
}


/**
 * Check if buffer contains boundary markers
 * Boundary = structural stability point where we can start extraction
 */
export function hasBoundary(buffer: string, markers: string[]): boolean {
  return markers.some((marker) => buffer.includes(marker));
}

/**
 * Extract fragment between markers
 * Used for scoped extraction (not full HTML)
 */
export function extractFragment(
  html: string,
  startMarker: string,
  endMarker: string | null = null,
  maxLength: number = 50000
): string | null {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;

  let endIdx: number;
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
 */
export function extractScriptContent(
  html: string,
  idOrPattern: string
): string | null {
  try {
    // Try to find script tag with specific ID
    const idPattern = new RegExp(
      `<script[^>]*id="${idOrPattern}"[^>]*>([\\s\\S]*?)</script>`,
      'i'
    );
    const idMatch = html.match(idPattern);
    if (idMatch) return idMatch[1];

    // Try to find script tag containing pattern
    const contentPattern = new RegExp(
      `<script[^>]*>([\\s\\S]*?${idOrPattern}[\\s\\S]*?)</script>`,
      'i'
    );
    const contentMatch = html.match(contentPattern);
    if (contentMatch) return contentMatch[1];

    return null;
  } catch (error) {
    console.error('[parser] Failed to extract script content', error);
    return null;
  }
}

/**
 * Parse HTML fragment using node-html-parser
 * Only use this for small fragments, NOT full HTML
 */
export function parseFragment(
  html: string,
  options: ParseOptions = {}
): HTMLElement {
  return parse(html, {
    lowerCaseTagName: false,
    comment: false,
    blockTextElements: {
      script: true,
      noscript: true,
      style: true,
    },
    ...options,
  });
}

/**
 * Extract meta tags from HTML
 */
export function extractMetaTags(html: string): MetaTags {
  const meta: MetaTags = {
    title: null,
    description: null,
    image: null,
    url: null,
  };

  try {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) meta.title = titleMatch[1].trim();

    // Extract og:title
    const ogTitleMatch = html.match(
      /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i
    );
    if (ogTitleMatch) meta.title = ogTitleMatch[1];

    // Extract description
    const descMatch = html.match(
      /<meta[^>]*name="description"[^>]*content="([^"]+)"/i
    );
    if (descMatch) meta.description = descMatch[1];

    // Extract og:description
    const ogDescMatch = html.match(
      /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i
    );
    if (ogDescMatch) meta.description = ogDescMatch[1];

    // Extract og:image
    const ogImageMatch = html.match(
      /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i
    );
    if (ogImageMatch) meta.image = ogImageMatch[1];

    // Extract og:url
    const ogUrlMatch = html.match(
      /<meta[^>]*property="og:url"[^>]*content="([^"]+)"/i
    );
    if (ogUrlMatch) meta.url = ogUrlMatch[1];
  } catch (error) {
    console.error('[parser] Failed to extract meta tags', error);
  }

  return meta;
}

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}
