/**
 * Base Extractor class
 * All platform extractors should extend this class
 */

/**
 * Base extractor interface
 */
export class BaseExtractor {
  /**
   * Platform identifier
   * @type {string}
   */
  static platform = 'base';

  /**
   * URL patterns that this extractor handles
   * @type {RegExp[]}
   */
  static patterns = [];

  /**
   * Check if URL matches this extractor's patterns
   * @param {string} url - URL to check
   * @returns {boolean} True if matches
   */
  static match(url) {
    return this.patterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract media from URL
   * @param {string} url - URL to extract from
   * @param {object} options - Extraction options
   * @param {AbortSignal} options.signal - Abort signal
   * @param {number} options.timeout - Request timeout
   * @returns {Promise<ExtractResult>} Extraction result
   */
  async extract(url, options = {}) {
    throw new Error('extract() must be implemented by subclass');
  }

  /**
   * Refresh expired media URL (optional)
   * @param {string} mediaId - Media ID
   * @returns {Promise<ExtractResult>} Refreshed result
   */
  async refresh(mediaId) {
    throw new Error('refresh() not implemented');
  }
}

/**
 * ExtractResult schema
 * @typedef {object} ExtractResult
 * @property {boolean} success - Success status
 * @property {string} platform - Platform name
 * @property {object} data - Media data
 * @property {string} data.id - Media ID
 * @property {string} data.url - Original URL
 * @property {string} data.finalUrl - Final URL after redirects
 * @property {string} data.contentType - Content type (video|reel|story|post)
 * @property {string} data.title - Media title
 * @property {string} data.description - Media description
 * @property {string} data.thumbnail - Thumbnail URL
 * @property {number} data.duration - Duration in seconds (video only)
 * @property {string} data.uploadDate - Upload date (ISO string)
 * @property {object} data.uploader - Uploader info
 * @property {string} data.uploader.name - Uploader name
 * @property {string} data.uploader.url - Uploader URL
 * @property {object} data.engagement - Engagement stats
 * @property {number} data.engagement.views - View count
 * @property {number} data.engagement.likes - Like count
 * @property {number} data.engagement.comments - Comment count
 * @property {number} data.engagement.shares - Share count
 * @property {MediaFormat[]} data.formats - Available formats
 * @property {object} error - Error info (if success=false)
 * @property {string} error.code - Error code
 * @property {string} error.message - Error message
 * @property {object} error.details - Error details
 */

/**
 * MediaFormat schema
 * @typedef {object} MediaFormat
 * @property {string} formatId - Format identifier
 * @property {string} quality - Quality label (HD 1080p, SD 480p, etc)
 * @property {string} type - Media type (video|audio|image)
 * @property {string} url - Direct media URL
 * @property {string} mime - MIME type
 * @property {number} size - File size in bytes (optional)
 * @property {string} sizeType - Size type (exact|estimated|unknown)
 * @property {number} width - Width in pixels (optional)
 * @property {number} height - Height in pixels (optional)
 * @property {number} bitrate - Bitrate in bps (optional)
 * @property {boolean} hasAudio - Has audio track
 * @property {boolean} hasVideo - Has video track
 * @property {number} expiresAt - Expiry timestamp (optional)
 * @property {string} thumbnail - Thumbnail URL (optional)
 */
