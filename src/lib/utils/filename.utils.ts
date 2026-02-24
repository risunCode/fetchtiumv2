/**
 * Filename generation utilities
 * Universal for all platforms
 * TypeScript conversion of filename.utils.js
 * 
 * MIME-first approach: Use MIME type from Content-Type header first,
 * then fall back to URL extension, then to media type defaults.
 */

import { analyze, getExtensionFromMime } from './mime.helper';
import type { MediaItem } from '@/types';

/**
 * Options for generating a filename
 */
export interface FilenameOptions {
  author?: string;
  contentType?: string;
  title?: string;
  quality?: string;
  mime?: string;
  type?: 'video' | 'audio' | 'image';
  index?: number;
  totalItems?: number;
  url?: string;
}

/**
 * Minimal result interface for addFilenames
 * Works with both ExtractResult and InternalExtractResult
 */
interface FilenameableResult {
  success: boolean;
  items?: MediaItem[];
  author?: string;
  contentType?: string;
  title?: string;
}

/**
 * Sanitize string for filename - remove emoji and illegal chars
 * Keeps alphanumeric, CJK characters (Japanese/Chinese/Korean), spaces, hyphens, underscores
 * @param str - String to sanitize
 * @param maxLen - Max length
 * @returns Sanitized string
 */
export function sanitize(str: string | undefined | null, maxLen: number = 30): string {
  if (!str) return 'unknown';
  
  const result = str
    // Remove emoji ranges
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // Misc symbols, emoticons
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // Emoticons
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // Transport/map symbols
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')    // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // Variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')  // Supplemental symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')  // Chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')  // Symbols extended
    .replace(/[\u{2300}-\u{23FF}]/gu, '')    // Misc technical
    .replace(/[\u{2B50}]/gu, '')             // Star
    .replace(/[\u{200D}]/gu, '')             // Zero width joiner
    // Remove illegal filename chars (Windows/Mac/Linux)
    .replace(/[<>:"/\\|?*]/g, '')
    // Remove other problematic chars
    .replace(/[@#\[\]{}()]/g, '')
    // Spaces to underscore
    .replace(/\s+/g, '_')
    // Multiple underscores/hyphens to single
    .replace(/[_-]+/g, '_')
    // Trim underscores from start/end
    .replace(/^_|_$/g, '')
    .substring(0, maxLen);
  
  // If result is empty, return 'unknown'
  return result.trim() || 'unknown';
}

/**
 * Get file extension using MIME-first approach
 * Priority: 1. MIME type, 2. URL extension, 3. Media type default
 * 
 * Supports: mp4, webm, mkv, mov, avi, flv, ts (video)
 *           mp3, m4a, webm, ogg, wav, aac, opus (audio)
 *           jpg, png, gif, webp (image)
 *           m3u8, mpd (playlist/HLS/DASH)
 * 
 * @param options - Options containing mime, url, and type
 * @returns File extension
 */
function getExtension(options: { mime?: string | null; url?: string; type?: string }): string {
  const { mime, url, type } = options;
  
  // 1. Try MIME type first (highest confidence)
  if (mime) {
    const ext = getExtensionFromMime(mime);
    if (ext) return ext;
  }
  
  // 2. Try URL extension via analyze()
  if (url) {
    const analysis = analyze({ url });
    if (analysis.extension) return analysis.extension;
  }
  
  // 3. Fallback to media type defaults
  const t = (type || '').toLowerCase();
  
  // Video formats (default: mp4)
  if (t === 'video') return 'mp4';
  
  // Audio formats (default: mp3)
  // Supported: mp3, m4a, webm, ogg, wav, aac, opus
  if (t === 'audio') return 'mp3';
  
  // Image formats (default: jpg)
  if (t === 'image') return 'jpg';
  
  // Playlist/streaming formats (HLS/DASH)
  if (t === 'playlist' || t === 'hls') return 'm3u8';
  if (t === 'dash') return 'mpd';
  
  // Default fallback
  return 'mp4';
}

/**
 * Generate filename for media source
 * Format: AuthorName_Description(40)_Quality_[Fetchtium].ext
 * 
 * Uses MIME-first approach for extension detection.
 * 
 * @param options - Filename generation options
 * @returns Generated filename
 */
export function generateFilename(options: FilenameOptions): string {
  const {
    author = 'unknown',
    title = 'untitled',
    quality = 'sd',
    mime,
    type = 'video',
    index = 0,
    totalItems = 1,
    url
  } = options;

  const authorClean = sanitize(author, 30);
  const descClean = sanitize(title, 40);
  const qualityClean = quality.toUpperCase();
  const ext = getExtension({ mime, url, type });
  
  // Add index only if multiple items
  const indexPart = totalItems > 1 ? `${index + 1}_` : '';
  
  // Format: AuthorName_Description_Quality_[DownAria].ext
  return `${authorClean}_${descClean}_${indexPart}${qualityClean}_[DownAria].${ext}`;
}

/**
 * Add filenames to extraction result
 * Call this after extraction to add filename to each source
 * 
 * Uses MIME-first approach for extension detection.
 * Works with both ExtractResult and InternalExtractResult.
 * 
 * @param result - Extraction result (must have success, items, author, contentType, title)
 * @returns Result with filenames added
 */
export function addFilenames<T extends FilenameableResult>(result: T): T {
  if (!result.success || !result.items) return result;

  const totalItems = result.items.length;

  for (const item of result.items) {
    for (const source of item.sources) {
      source.filename = generateFilename({
        author: result.author,
        contentType: result.contentType,
        title: result.title,
        quality: source.quality,
        mime: source.mime,
        type: item.type,
        index: item.index,
        totalItems,
        url: source.url
      });
    }
  }

  return result;
}
