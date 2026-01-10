/**
 * URL parsing utilities
 * Platform-agnostic - no hardcoded platform patterns here
 */

import { ErrorCode } from './error.utils.js';

/**
 * Tracking parameters to remove during normalization
 */
const TRACKING_PARAMS = [
  'fbclid', 'igshid', 'utm_source', 'utm_medium', 'utm_campaign',
  '__cft__', '__tn__', 'ref', 'fref', 'hc_ref', 'hc_location'
];

/**
 * Normalize URL by removing tracking parameters
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
