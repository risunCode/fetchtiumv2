/**
 * HTTP headers utilities
 * Provides User-Agent rotation and platform-specific headers
 */

/**
 * User agent strings for different platforms/browsers
 */
export const USER_AGENTS = {
  // iPad latest (primary for Facebook)
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',

  // Chrome 131 (fallback)
  chrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
} as const;

/**
 * User agent type
 */
export type UserAgentType = keyof typeof USER_AGENTS;

/**
 * HTTP headers record type
 */
export type HttpHeaders = Record<string, string>;

/**
 * Options for platform-specific headers
 */
export interface HeaderOptions {
  /** User agent type to use */
  userAgent?: UserAgentType;
  /** Custom cookie string */
  cookie?: string;
}

/**
 * Get base headers for requests
 */
function getBaseHeaders(userAgent: string): HttpHeaders {
  return {
    'User-Agent': userAgent,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };
}

/**
 * Get Chrome-specific headers (Sec-Ch-* headers)
 * Important for bypassing bot detection
 */
function getChromeHeaders(): HttpHeaders {
  return {
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
  };
}


/**
 * Get Facebook-specific headers
 * @param userAgent - User agent to use (ipad or chrome)
 * @returns Facebook headers
 */
export function getFacebookHeaders(userAgent: UserAgentType = 'ipad'): HttpHeaders {
  const ua = USER_AGENTS[userAgent];
  const baseHeaders = getBaseHeaders(ua);

  const facebookHeaders: HttpHeaders = {
    ...baseHeaders,
    Referer: 'https://web.facebook.com/',
    Origin: 'https://web.facebook.com',
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
 */
export function getYouTubeHeaders(): HttpHeaders {
  const baseHeaders = getBaseHeaders(USER_AGENTS.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    Referer: 'https://www.youtube.com/',
    Origin: 'https://www.youtube.com',
  };
}

/**
 * Get Instagram-specific headers
 */
export function getInstagramHeaders(): HttpHeaders {
  const baseHeaders = getBaseHeaders(USER_AGENTS.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    Referer: 'https://www.instagram.com/',
    Origin: 'https://www.instagram.com',
  };
}

/**
 * Get TikTok-specific headers
 */
export function getTikTokHeaders(): HttpHeaders {
  const baseHeaders = getBaseHeaders(USER_AGENTS.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    Referer: 'https://www.tiktok.com/',
    Origin: 'https://www.tiktok.com',
  };
}

/**
 * Get Twitter/X-specific headers
 */
export function getTwitterHeaders(): HttpHeaders {
  const baseHeaders = getBaseHeaders(USER_AGENTS.chrome);
  return {
    ...baseHeaders,
    ...getChromeHeaders(),
    Referer: 'https://twitter.com/',
    Origin: 'https://twitter.com',
  };
}

/**
 * Supported platform names
 */
export type Platform = 'facebook' | 'youtube' | 'instagram' | 'tiktok' | 'twitter';

/**
 * Get headers for a specific platform
 * @param platform - Platform name
 * @param options - Additional options
 * @returns Platform-specific headers
 */
export function getHeadersForPlatform(platform: Platform | string, options: HeaderOptions = {}): HttpHeaders {
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
      return getBaseHeaders(USER_AGENTS.chrome);
  }
}

/**
 * Add cookie header to existing headers
 * @param headers - Existing headers
 * @param cookie - Cookie string
 * @returns Headers with cookie added
 */
export function withCookie(headers: HttpHeaders, cookie: string): HttpHeaders {
  if (!cookie) return headers;
  return {
    ...headers,
    Cookie: cookie,
  };
}
