/**
 * HTTP headers utilities
 * Provides User-Agent rotation and platform-specific headers
 */

import { config } from '../../config/index.js';

/**
 * Get base headers for requests
 * @param {string} userAgent - User agent string
 * @returns {object} Headers object
 */
function getBaseHeaders(userAgent) {
  return {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
}

/**
 * Get Chrome-specific headers (Sec-Ch-* headers)
 * Important for bypassing bot detection
 * @returns {object} Chrome headers
 */
function getChromeHeaders() {
  return {
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document'
  };
}

/**
 * Get Facebook-specific headers
 * @param {string} userAgent - User agent to use (ipad or chrome)
 * @returns {object} Facebook headers
 */
export function getFacebookHeaders(userAgent = 'ipad') {
  const ua = userAgent === 'chrome' ? config.userAgents.chrome : config.userAgents.ipad;
  const baseHeaders = getBaseHeaders(ua);
  
  const facebookHeaders = {
    ...baseHeaders,
    'Referer': 'https://web.facebook.com/',
    'Origin': 'https://web.facebook.com'
  };

  // Add Chrome-specific headers if using Chrome UA
  if (userAgent === 'chrome') {
    Object.assign(facebookHeaders, getChromeHeaders());
    // Override Sec-Fetch-Site for Facebook
    facebookHeaders['Sec-Fetch-Site'] = 'same-origin';
  }

  return facebookHeaders;
}

/**
 * Get YouTube-specific headers
 * @returns {object} YouTube headers
 */
export function getYouTubeHeaders() {
  const baseHeaders = getBaseHeaders(config.userAgents.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com'
  };
}

/**
 * Get Instagram-specific headers
 * @returns {object} Instagram headers
 */
export function getInstagramHeaders() {
  const baseHeaders = getBaseHeaders(config.userAgents.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    'Referer': 'https://www.instagram.com/',
    'Origin': 'https://www.instagram.com'
  };
}

/**
 * Get TikTok-specific headers
 * @returns {object} TikTok headers
 */
export function getTikTokHeaders() {
  const baseHeaders = getBaseHeaders(config.userAgents.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    'Referer': 'https://www.tiktok.com/',
    'Origin': 'https://www.tiktok.com'
  };
}

/**
 * Get Twitter/X-specific headers
 * @returns {object} Twitter headers
 */
export function getTwitterHeaders() {
  const baseHeaders = getBaseHeaders(config.userAgents.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    'Referer': 'https://twitter.com/',
    'Origin': 'https://twitter.com'
  };
}

/**
 * Get headers for a specific platform
 * @param {string} platform - Platform name
 * @param {object} options - Additional options
 * @returns {object} Platform-specific headers
 */
export function getHeadersForPlatform(platform, options = {}) {
  switch (platform) {
    case 'facebook':
      return getFacebookHeaders(options.userAgent);
    case 'youtube':
      return getYouTubeHeaders();
    case 'instagram':
      return getInstagramHeaders();
    case 'tiktok':
      return getTikTokHeaders();
    case 'twitter':
      return getTwitterHeaders();
    default:
      return getBaseHeaders(config.userAgents.chrome);
  }
}
