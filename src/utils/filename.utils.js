/**
 * Filename generation utilities
 * Universal for all platforms
 */

import { getExtensionFromMime } from '../core/media/mime.helper.js';

/**
 * Sanitize string for filename - keep unicode letters
 * @param {string} str - String to sanitize
 * @param {number} maxLen - Max length
 * @returns {string} Sanitized string
 */
export function sanitize(str, maxLen = 30) {
  if (!str) return 'unknown';
  return str
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove illegal filename chars
    .replace(/\s+/g, '_')                   // Spaces to underscore
    .replace(/_+/g, '_')                    // Multiple underscores to single
    .replace(/^_|_$/g, '')                  // Trim underscores
    .substring(0, maxLen) || 'unknown';
}

/**
 * Get file extension from mime or type
 */
function getExtension(mimeOrType) {
  if (!mimeOrType) return 'mp4';
  
  // Try mime helper first
  const ext = getExtensionFromMime(mimeOrType);
  if (ext) return ext;
  
  // Fallback for simple types
  const m = mimeOrType.toLowerCase();
  if (m === 'video') return 'mp4';
  if (m === 'audio') return 'mp3';
  if (m === 'image') return 'jpg';
  
  return 'mp4';
}

/**
 * Generate filename for media source
 * Format: author_contentType_title_[index_]quality.ext
 * 
 * @param {object} options
 * @param {string} options.author - Author/uploader name
 * @param {string} options.contentType - Content type (reel, video, story, post)
 * @param {string} options.title - Media title
 * @param {string} options.quality - Quality label (hd, sd)
 * @param {string} options.mime - MIME type
 * @param {string} options.type - Media type (video, audio, image)
 * @param {number} options.index - Item index (for multi-item)
 * @param {number} options.totalItems - Total items count
 * @returns {string} Generated filename
 */
export function generateFilename(options) {
  const {
    author = 'unknown',
    contentType = 'media',
    title = 'untitled',
    quality = 'sd',
    mime,
    type = 'video',
    index = 0,
    totalItems = 1
  } = options;

  const authorClean = sanitize(author, 20);
  const titleClean = sanitize(title, 40);
  const ext = getExtension(mime || type);
  
  // Add index only if multiple items
  const indexPart = totalItems > 1 ? `_${index + 1}` : '';
  
  return `${authorClean}_${contentType}_${titleClean}${indexPart}_${quality}.${ext}`;
}

/**
 * Add filenames to extraction result
 * Call this after extraction to add filename to each source
 * 
 * @param {object} result - Extraction result
 * @returns {object} Result with filenames added
 */
export function addFilenames(result) {
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
        totalItems
      });
    }
  }

  return result;
}
