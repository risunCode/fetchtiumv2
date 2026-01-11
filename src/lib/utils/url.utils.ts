/**
 * URL parsing utilities
 * Platform-agnostic - no hardcoded platform patterns here
 * TypeScript conversion of url.utils.js
 */

import { ErrorCode } from './error.utils';

/**
 * Tracking parameters to remove during normalization
 */
const TRACKING_PARAMS: string[] = [
  'fbclid', 'igshid', 'utm_source', 'utm_medium', 'utm_campaign',
  '__cft__', '__tn__', 'ref', 'fref', 'hc_ref', 'hc_location'
];

/**
 * Parsed URL components interface
 */
export interface ParsedUrl {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
  searchParams: Record<string, string>;
  hash: string;
  href: string;
}

/**
 * Normalize URL by removing tracking parameters
 * @param url - URL to normalize
 * @returns Normalized URL
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove tracking parameters
    TRACKING_PARAMS.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Remove fragment (hash)
    urlObj.hash = '';
    
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns True if valid
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if URL matches known patterns (no resolution needed)
 * @param url - URL to check
 * @param knownPatterns - Array of known patterns
 * @returns True if matches known pattern
 */
export function isKnownPattern(url: string, knownPatterns: RegExp[]): boolean {
  return knownPatterns.some(pattern => pattern.test(url));
}

/**
 * Extract domain from URL
 * @param url - URL to parse
 * @returns Domain or null
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Parse URL and return components
 * @param url - URL to parse
 * @returns URL components
 * @throws Error if URL is invalid
 */
export function parseUrl(url: string): ParsedUrl {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      search: urlObj.search,
      searchParams: Object.fromEntries(urlObj.searchParams),
      hash: urlObj.hash,
      href: urlObj.href
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`${ErrorCode.INVALID_URL}: ${message}`);
  }
}
