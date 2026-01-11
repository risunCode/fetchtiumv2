/**
 * Platform Header Utilities
 * 
 * Provides platform detection and header generation for FFmpeg input streams.
 * Used by merge and hls-stream endpoints to handle platform-specific requirements.
 */

/**
 * Common browser User-Agent for all platform requests
 */
export const COMMON_USER_AGENT = 
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Platform headers interface for FFmpeg input options
 */
export interface PlatformHeaders {
  referer?: string;
  origin?: string;
  userAgent: string;
}

/**
 * BiliBili domain patterns
 * Includes CDN domains used for video/audio delivery
 */
const BILIBILI_PATTERNS = [
  'bilivideo.',
  'bilibili.',
  'akamaized.net',
  'bstarstatic.com',
];

/**
 * YouTube domain patterns
 * Includes CDN domains used for video/audio delivery
 */
const YOUTUBE_PATTERNS = [
  'googlevideo.com',
  'youtube.com',
];

/**
 * Check if URL is from BiliBili platform
 * @param url - URL to check
 * @returns true if URL matches BiliBili patterns
 */
export function isBiliBiliUrl(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return BILIBILI_PATTERNS.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Check if URL is from YouTube platform
 * @param url - URL to check
 * @returns true if URL matches YouTube patterns
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return YOUTUBE_PATTERNS.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Get platform-specific headers for a URL
 * Used to configure FFmpeg input options for platform CDNs
 * 
 * @param url - Media URL to get headers for
 * @returns Platform headers with referer, origin, and userAgent
 */
export function getPlatformHeaders(url: string): PlatformHeaders {
  if (isBiliBiliUrl(url)) {
    return {
      referer: 'https://www.bilibili.tv/',
      origin: 'https://www.bilibili.tv',
      userAgent: COMMON_USER_AGENT,
    };
  }

  if (isYouTubeUrl(url)) {
    return {
      referer: 'https://www.youtube.com/',
      origin: 'https://www.youtube.com',
      userAgent: COMMON_USER_AGENT,
    };
  }

  // Default: just user agent, no referer/origin needed
  return {
    userAgent: COMMON_USER_AGENT,
  };
}

/**
 * Build FFmpeg headers string from platform headers
 * Format: "Header: value\r\n" for each header
 * 
 * @param headers - Platform headers object
 * @returns Formatted headers string for FFmpeg -headers option
 */
export function buildFFmpegHeadersString(headers: PlatformHeaders): string {
  const parts: string[] = [];
  
  if (headers.referer) {
    parts.push(`Referer: ${headers.referer}`);
  }
  
  if (headers.origin) {
    parts.push(`Origin: ${headers.origin}`);
  }
  
  if (parts.length === 0) {
    return '';
  }
  
  return parts.join('\r\n') + '\r\n';
}
