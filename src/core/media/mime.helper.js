/**
 * Media MIME Helper
 * MIME type detection, extension mapping, format validation
 * 
 * UNIFIED approach - no separate handlers per format
 * Media format = attributes, not behavior
 */

import { logger } from '../../utils/logger.js';

/**
 * MIME type to extension mapping
 */
const MIME_TO_EXT = {
  // Video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/x-flv': 'flv',
  'video/MP2T': 'ts',
  'video/3gpp': '3gp',
  
  // Audio
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'audio/opus': 'opus',
  
  // Image
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  
  // Playlist
  'application/vnd.apple.mpegurl': 'm3u8',
  'application/x-mpegURL': 'm3u8',
  'application/dash+xml': 'mpd'
};

/**
 * Extension to MIME type mapping
 */
const EXT_TO_MIME = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);

/**
 * Media kind classification
 */
const MIME_TO_KIND = {
  video: /^video\//,
  audio: /^audio\//,
  image: /^image\//,
  playlist: /mpegurl|dash\+xml/i
};

/**
 * Streaming formats (not direct files)
 */
const STREAMING_FORMATS = ['m3u8', 'mpd', 'ts'];

/**
 * Playlist formats
 */
const PLAYLIST_FORMATS = ['m3u8', 'mpd'];

/**
 * Container formats
 */
const CONTAINERS = {
  mp4: 'mp4',
  webm: 'webm',
  mkv: 'matroska',
  mov: 'quicktime',
  avi: 'avi',
  flv: 'flv',
  ts: 'mpegts',
  m3u8: 'hls',
  mpd: 'dash'
};

/**
 * Analyze media from various sources
 * @param {object} context - Analysis context
 * @param {string} context.url - Media URL
 * @param {string} context.contentType - Content-Type header
 * @param {object} context.headers - All response headers
 * @returns {object} Media info
 */
export function analyze(context) {
  const { url, contentType, headers = {} } = context;
  
  let mime = null;
  let extension = null;
  let confidence = 'low';

  // 1. Try Content-Type header (highest confidence)
  if (contentType) {
    mime = contentType.split(';')[0].trim().toLowerCase();
    extension = MIME_TO_EXT[mime];
    if (extension) {
      confidence = 'high';
    }
  }

  // 2. Try URL extension
  if (!extension && url) {
    const urlExt = extractExtensionFromUrl(url);
    if (urlExt) {
      extension = urlExt;
      mime = EXT_TO_MIME[urlExt] || mime;
      confidence = mime ? 'medium' : 'low';
    }
  }

  // 3. Classify media kind
  const kind = classifyKind(mime, extension);

  // 4. Determine properties
  const streaming = STREAMING_FORMATS.includes(extension);
  const playlist = PLAYLIST_FORMATS.includes(extension);
  const container = CONTAINERS[extension] || 'unknown';

  return {
    mime,
    extension,
    kind,
    streaming,
    playlist,
    container,
    confidence
  };
}

/**
 * Extract extension from URL
 * @param {string} url - URL to parse
 * @returns {string|null} Extension or null
 */
function extractExtensionFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-z0-9]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : null;
  } catch (error) {
    return null;
  }
}

/**
 * Classify media kind
 * @param {string} mime - MIME type
 * @param {string} extension - File extension
 * @returns {string} Media kind (video|audio|image|playlist|unknown)
 */
function classifyKind(mime, extension) {
  // Check MIME type
  if (mime) {
    for (const [kind, pattern] of Object.entries(MIME_TO_KIND)) {
      if (pattern.test(mime)) return kind;
    }
  }

  // Check extension
  if (extension) {
    if (PLAYLIST_FORMATS.includes(extension)) return 'playlist';
    if (['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'ts'].includes(extension)) return 'video';
    if (['mp3', 'm4a', 'ogg', 'wav', 'aac', 'opus'].includes(extension)) return 'audio';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) return 'image';
  }

  return 'unknown';
}

/**
 * Get MIME type from extension
 * @param {string} extension - File extension
 * @returns {string|null} MIME type or null
 */
export function getMimeFromExtension(extension) {
  return EXT_TO_MIME[extension.toLowerCase()] || null;
}

/**
 * Get extension from MIME type
 * @param {string} mime - MIME type
 * @returns {string|null} Extension or null
 */
export function getExtensionFromMime(mime) {
  return MIME_TO_EXT[mime.toLowerCase()] || null;
}

/**
 * Validate if format is supported
 * @param {string} extension - File extension
 * @returns {boolean} True if supported
 */
export function isSupported(extension) {
  return Object.values(MIME_TO_EXT).includes(extension.toLowerCase());
}

/**
 * Check if format is streamable
 * @param {string} extension - File extension
 * @returns {boolean} True if streamable
 */
export function isStreamable(extension) {
  return STREAMING_FORMATS.includes(extension.toLowerCase());
}

/**
 * Check if format is playlist
 * @param {string} extension - File extension
 * @returns {boolean} True if playlist
 */
export function isPlaylist(extension) {
  return PLAYLIST_FORMATS.includes(extension.toLowerCase());
}
