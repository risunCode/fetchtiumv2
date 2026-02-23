/**
 * Network Module Index
 * Re-exports all network utilities
 */

// Client exports
export {
  fetchStream,
  fetchText,
  resolveUrl,
  closeConnections,
  getFileSize,
  getFileSizes,
  NetworkError,
  NetworkErrorCode,
} from './client';

export type {
  FetchOptions,
  FetchStreamResult,
  FetchTextResult,
} from './client';

// Cookie exports
export {
  parseCookies,
  loadCookies,
  hasValidAuthCookies,
  getFacebookCookies,
  getPlatformCookies,
  // Instagram cookie helpers
  extractInstagramCsrfToken,
  extractInstagramSessionId,
  hasValidInstagramCookies,
  buildInstagramHeaders,
  INSTAGRAM_APP_ID,
  // Twitter cookie helpers
  extractTwitterCt0,
  extractTwitterAuthToken,
  hasValidTwitterCookies,
  buildTwitterHeaders,
  TWITTER_BEARER_TOKEN,
} from './cookies';

export type { GetCookiesOptions } from './cookies';

// Header exports
export {
  USER_AGENTS,
  getFacebookHeaders,
  getYouTubeHeaders,
  getInstagramHeaders,
  getTikTokHeaders,
  getTwitterHeaders,
  getHeadersForPlatform,
  withCookie,
} from './headers';

export type { UserAgentType, HttpHeaders, HeaderOptions, Platform } from './headers';
