/**
 * Network layer exports
 */

export { fetchStream, fetchText, resolveUrl, closeConnections, getFileSize, getFileSizes, getConnectionStats, trackRequest } from './client.js';
export { 
  getFacebookHeaders, 
  getYouTubeHeaders, 
  getInstagramHeaders,
  getTikTokHeaders,
  getTwitterHeaders,
  getHeadersForPlatform 
} from './headers.js';
export { loadCookies, getFacebookCookies, hasValidAuthCookies } from './cookies.js';
