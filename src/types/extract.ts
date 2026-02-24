/**
 * Extract Types
 * Type definitions for media extraction results
 */

/**
 * Engagement statistics for extracted content
 */
export interface EngagementStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

/**
 * Response metadata included in all API responses
 */
export interface ResponseMeta {
  responseTime: number;
  accessMode: string;
  publicContent: boolean;
}

/**
 * Individual media source with quality and URL information
 */
export interface MediaSource {
  quality: string;
  url: string;
  resolution?: string;
  mime?: string;
  /** File extension (e.g., 'mp3', 'mp4', 'webm') */
  extension?: string;
  size?: number;
  /** Audio bitrate in kbps (for audio sources) */
  bitrate?: number;
  filename?: string;
  /** Short hash for stream/download URLs (16 chars) */
  hash?: string;
  /** Video codec (H.264, VP9, AV1) - YouTube only */
  codec?: string;
  /** Whether video has audio track - YouTube only */
  hasAudio?: boolean;
  /** Whether video needs merge with separate audio - YouTube DASH */
  needsMerge?: boolean;
  /** Whether URL needs proxy due to CORS - YouTube HLS */
  needsProxy?: boolean;
  /** Format type (hls, dash, progressive) */
  format?: string;
}

/**
 * Media item containing one or more sources
 */
export interface MediaItem {
  index: number;
  type: 'video' | 'image' | 'audio';
  thumbnail?: string;
  /** Short hash for thumbnail proxy URL (16 chars) */
  thumbnailHash?: string;
  /** Format type for the item (hls, dash) - YouTube only */
  format?: string;
  sources: MediaSource[];
}

/**
 * Cookie source tracking
 */
export type CookieSource = 'none' | 'server' | 'client';

/**
 * Successful extraction result
 */
export interface ExtractResult {
  success: true;
  platform: string;
  contentType: string;
  /** Original input URL used for extraction (watch URL, post URL, etc.) */
  sourceUrl?: string;
  title?: string;
  author?: string;
  authorUsername?: string;
  id?: string;
  description?: string;
  uploadDate?: string;
  stats?: EngagementStats;
  items: MediaItem[];
  meta: ResponseMeta;
  usedCookie?: boolean;
  cookieSource?: CookieSource;
}

/**
 * Error response for failed extractions
 */
export interface ExtractError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta: ResponseMeta;
}

/**
 * Union type for extraction responses
 */
export type ExtractResponse = ExtractResult | ExtractError;
