/**
 * Regex Extractor - Scoped regex extraction utilities
 *
 * RULES:
 * - Extract from FRAGMENT, NOT full HTML
 * - Scoped extraction only
 * - Helper functions for common patterns
 */

/**
 * Options for URL extraction
 */
export interface ExtractUrlOptions {
  /** Filter by protocol (http/https) */
  protocol?: string;
  /** Filter by domain pattern */
  domain?: string;
}

/**
 * Decode URL-encoded string
 */
export function decodeUrl(str: string): string {
  try {
    return decodeURIComponent(str.replace(/\\\//g, '/'));
  } catch {
    return str.replace(/\\\//g, '/');
  }
}

/**
 * Clean JSON string (remove escapes)
 */
export function cleanJsonString(str: string): string {
  return str
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&');
}

/**
 * Extract all matches for a regex pattern
 */
export function extractAll(
  text: string,
  pattern: RegExp,
  limit: number = 100
): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = pattern.exec(text)) !== null && count < limit) {
    matches.push(match);
    count++;
  }

  return matches;
}

/**
 * Extract first match for a regex pattern
 */
export function extractFirst(
  text: string,
  pattern: RegExp
): RegExpMatchArray | null {
  return text.match(pattern);
}


/**
 * Extract JSON from text
 * Handles common JSON extraction patterns
 */
export function extractJson<T = unknown>(
  text: string,
  startMarker: string | null = null
): T | null {
  try {
    let jsonText = text;

    if (startMarker) {
      const startIdx = text.indexOf(startMarker);
      if (startIdx === -1) return null;
      jsonText = text.substring(startIdx);
    }

    // Try to find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

/**
 * Extract URLs from text
 */
export function extractUrls(
  text: string,
  options: ExtractUrlOptions = {}
): string[] {
  const { protocol, domain } = options;

  // URL pattern
  const urlPattern = /https?:\/\/[^\s"'<>\\]+/gi;
  const matches = extractAll(text, urlPattern);

  let urls = matches.map((m) => m[0]);

  // Filter by protocol
  if (protocol) {
    urls = urls.filter((url) => url.startsWith(protocol + '://'));
  }

  // Filter by domain
  if (domain) {
    const domainPattern = new RegExp(domain, 'i');
    urls = urls.filter((url) => domainPattern.test(url));
  }

  // Deduplicate
  return [...new Set(urls)];
}

/**
 * Extract video URLs from fragment
 * Common patterns for video URLs
 */
export function extractVideoUrls(
  fragment: string,
  options: ExtractUrlOptions = {}
): string[] {
  const videoExtensions = /\.(mp4|webm|m4v|mov|avi|mkv|flv)/i;
  const urls = extractUrls(fragment, options);

  return urls.filter((url) => {
    // Check extension
    if (videoExtensions.test(url)) return true;

    // Check common video CDN patterns
    if (/video|stream|cdn|fbcdn|scontent/i.test(url)) return true;

    return false;
  });
}

/**
 * Extract image URLs from fragment
 * Common patterns for image URLs
 */
export function extractImageUrls(
  fragment: string,
  options: ExtractUrlOptions = {}
): string[] {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)/i;
  const urls = extractUrls(fragment, options);

  return urls.filter((url) => {
    // Check extension
    if (imageExtensions.test(url)) return true;

    // Check common image CDN patterns
    if (/image|photo|img|cdn|fbcdn|scontent/i.test(url)) return true;

    return false;
  });
}

/**
 * Extract value by key from JSON-like text
 * Handles cases where text is not valid JSON but contains key-value pairs
 */
export function extractValueByKey(text: string, key: string): string | null {
  // Try exact key match with quotes
  const quotedPattern = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
  const quotedMatch = text.match(quotedPattern);
  if (quotedMatch) return quotedMatch[1];

  // Try key match with number value
  const numberPattern = new RegExp(`"${key}"\\s*:\\s*(\\d+)`, 'i');
  const numberMatch = text.match(numberPattern);
  if (numberMatch) return numberMatch[1];

  // Try key match with boolean value
  const boolPattern = new RegExp(`"${key}"\\s*:\\s*(true|false)`, 'i');
  const boolMatch = text.match(boolPattern);
  if (boolMatch) return boolMatch[1];

  return null;
}

/**
 * Check if text contains any of the patterns
 */
export function containsAny(
  text: string,
  patterns: Array<string | RegExp>
): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return text.includes(pattern);
    }
    if (pattern instanceof RegExp) {
      return pattern.test(text);
    }
    return false;
  });
}

/**
 * Find position of first occurrence of any pattern
 */
export function findFirst(
  text: string,
  patterns: Array<string | RegExp>
): number {
  let minPos = -1;

  for (const pattern of patterns) {
    let pos = -1;

    if (typeof pattern === 'string') {
      pos = text.indexOf(pattern);
    } else if (pattern instanceof RegExp) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) pos = match.index;
    }

    if (pos !== -1 && (minPos === -1 || pos < minPos)) {
      minPos = pos;
    }
  }

  return minPos;
}
