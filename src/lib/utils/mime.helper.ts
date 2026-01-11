/**
 * Media MIME Helper
 * MIME type detection, extension mapping, format validation
 * 
 * UNIFIED approach - no separate handlers per format
 * Media format = attributes, not behavior
 * 
 * TypeScript conversion of mime.helper.js
 */

/**
 * Media analysis context
 */
export interface MediaAnalysisContext {
  url?: string;
  contentType?: string;
  headers?: Record<string, string>;
}

/**
 * Media analysis result
 */
export interface MediaAnalysisResult {
  mime: string | null;
  extension: string | null;
  kind: MediaKind;
  streaming: boolean;
  playlist: boolean;
  container: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Media kind type
 */
export type MediaKind = 'video' | 'audio' | 'image' | 'playlist' | 'unknown';

/**
 * MIME type to extension mapping
 */
const MIME_TO_EXT: Record<string, string> = {
  // Video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/x-flv': 'flv',
  'video/MP2T': 'ts',
  'video/3gpp': '3gp',
  
  // Audio - comprehensive mappings for all common formats
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',           // Alternative MIME type for MP3
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',         // Alternative MIME type for M4A
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/vorbis': 'ogg',        // Vorbis codec in OGG container
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',         // Alternative MIME type for WAV
  'audio/wave': 'wav',          // Alternative MIME type for WAV
  'audio/aac': 'aac',
  'audio/x-aac': 'aac',         // Alternative MIME type for AAC
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',       // Alternative MIME type for FLAC
  
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
const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);

/**
 * Media kind classification patterns
 */
const MIME_TO_KIND: Record<string, RegExp> = {
  video: /^video\//,
  audio: /^audio\//,
  image: /^image\//,
  playlist: /mpegurl|dash\+xml/i
};

/**
 * Streaming formats (not direct files)
 */
const STREAMING_FORMATS: string[] = ['m3u8', 'mpd', 'ts'];

/**
 * Playlist formats
 */
const PLAYLIST_FORMATS: string[] = ['m3u8', 'mpd'];

/**
 * Container formats
 */
const CONTAINERS: Record<string, string> = {
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
 * Extract extension from URL
 * @param url - URL to parse
 * @returns Extension or null
 */
function extractExtensionFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-z0-9]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Classify media kind
 * @param mime - MIME type
 * @param extension - File extension
 * @returns Media kind (video|audio|image|playlist|unknown)
 */
function classifyKind(mime: string | null, extension: string | null): MediaKind {
  // Check MIME type
  if (mime) {
    for (const [kind, pattern] of Object.entries(MIME_TO_KIND)) {
      if (pattern.test(mime)) return kind as MediaKind;
    }
  }

  // Check extension
  if (extension) {
    if (PLAYLIST_FORMATS.includes(extension)) return 'playlist';
    if (['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'ts'].includes(extension)) return 'video';
    if (['mp3', 'm4a', 'ogg', 'wav', 'aac', 'opus', 'webm', 'flac'].includes(extension)) return 'audio';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) return 'image';
  }

  return 'unknown';
}

/**
 * Analyze media from various sources
 * @param context - Analysis context
 * @returns Media info
 */
export function analyze(context: MediaAnalysisContext): MediaAnalysisResult {
  const { url, contentType } = context;
  
  let mime: string | null = null;
  let extension: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // 1. Try Content-Type header (highest confidence)
  if (contentType) {
    mime = contentType.split(';')[0].trim().toLowerCase();
    extension = MIME_TO_EXT[mime] || null;
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
  const streaming = extension ? STREAMING_FORMATS.includes(extension) : false;
  const playlist = extension ? PLAYLIST_FORMATS.includes(extension) : false;
  const container = extension ? (CONTAINERS[extension] || 'unknown') : 'unknown';

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
 * Get MIME type from extension
 * @param extension - File extension
 * @returns MIME type or null
 */
export function getMimeFromExtension(extension: string): string | null {
  return EXT_TO_MIME[extension.toLowerCase()] || null;
}

/**
 * Get extension from MIME type
 * @param mime - MIME type
 * @returns Extension or null
 */
export function getExtensionFromMime(mime: string): string | null {
  return MIME_TO_EXT[mime.toLowerCase()] || null;
}

/**
 * Validate if format is supported
 * @param extension - File extension
 * @returns True if supported
 */
export function isSupported(extension: string): boolean {
  return Object.values(MIME_TO_EXT).includes(extension.toLowerCase());
}

/**
 * Check if format is streamable
 * @param extension - File extension
 * @returns True if streamable
 */
export function isStreamable(extension: string): boolean {
  return STREAMING_FORMATS.includes(extension.toLowerCase());
}

/**
 * Check if format is playlist
 * @param extension - File extension
 * @returns True if playlist
 */
export function isPlaylist(extension: string): boolean {
  return PLAYLIST_FORMATS.includes(extension.toLowerCase());
}
