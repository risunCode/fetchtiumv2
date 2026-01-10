/**
 * URL parsing and platform detection utilities
 */

import { ErrorCode } from './error.utils.js';

/**
 * Platform patterns for detection
 */
const PLATFORM_PATTERNS = {
  facebook: [
    /(?:www\.|m\.|web\.|mobile\.)?facebook\.com/i,
    /fb\.watch/i,
    /fb\.me/i
  ],
  youtube: [
    /(?:www\.)?youtube\.com/i,
    /youtu\.be/i
  ],
  instagram: [
    /(?:www\.)?instagram\.com/i,
    /instagr\.am/i
  ],
  tiktok: [
    /(?:www\.)?tiktok\.com/i,
    /vm\.tiktok\.com/i,
    /vt\.tiktok\.com/i
  ],
  twitter: [
    /(?:www\.)?twitter\.com/i,
    /(?:www\.)?x\.com/i,
    /t\.co/i
  ]
};

/**
 * Tracking parameters to remove during normalization
 */
const TRACKING_PARAMS = [
  'fbclid', 'igshid', 'utm_source', 'utm_medium', 'utm_campaign',
  '__cft__', '__tn__', 'ref', 'fref', 'hc_ref', 'hc_location'
];

/**
 * Detect platform from URL
 * @param {string} url - URL to analyze
 * @returns {string|null} Platform name or null if not supported
 */
export function detectPlatform(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(hostname))) {
        return platform;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Normalize URL by removing tracking parameters
 * NOTE: Does NOT convert domain (e.g., m.facebook.com stays as is)
 * User-Agent handles mobile/desktop response
 * 
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Remove tracking parameters
    TRACKING_PARAMS.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Remove fragment (hash)
    urlObj.hash = '';
    
    return urlObj.toString();
  } catch (error) {
    return url;
  }
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

/**
 * Check if URL matches known patterns (no resolution needed)
 * @param {string} url - URL to check
 * @param {RegExp[]} knownPatterns - Array of known patterns
 * @returns {boolean} True if matches known pattern
 */
export function isKnownPattern(url, knownPatterns) {
  return knownPatterns.some(pattern => pattern.test(url));
}

/**
 * Extract domain from URL
 * @param {string} url - URL to parse
 * @returns {string|null} Domain or null
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return null;
  }
}

/**
 * Parse URL and return components
 * @param {string} url - URL to parse
 * @returns {object} URL components
 */
export function parseUrl(url) {
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
    throw new Error(`${ErrorCode.INVALID_URL}: ${error.message}`);
  }
}
