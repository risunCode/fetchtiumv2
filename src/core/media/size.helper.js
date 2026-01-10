/**
 * Media Size Helper
 * File size determination with honest reporting
 * 
 * PRINCIPLES:
 * - exact: Content-Length valid & trusted
 * - estimated: Calculated from bitrate/duration
 * - unknown: Cannot determine, don't lie
 * 
 * Unknown is better than fake numbers!
 */

import { logger } from '../../utils/logger.js';

/**
 * Size types
 */
export const SizeType = {
  EXACT: 'exact',
  ESTIMATED: 'estimated',
  UNKNOWN: 'unknown'
};

/**
 * Get file size from various sources
 * @param {object} context - Size context
 * @param {object} context.headers - Response headers
 * @param {number} context.duration - Media duration in seconds
 * @param {number} context.bitrate - Media bitrate in bps
 * @param {string} context.format - Media format/extension
 * @returns {object} Size info { bytes, type, display }
 */
export function getSize(context) {
  const { headers = {}, duration, bitrate, format } = context;

  // 1. Try Content-Length (most reliable for progressive files)
  const contentLength = headers['content-length'];
  if (contentLength && isProgressiveFormat(format)) {
    const bytes = parseInt(contentLength, 10);
    if (bytes > 0) {
      return {
        bytes,
        type: SizeType.EXACT,
        display: formatBytes(bytes)
      };
    }
  }

  // 2. Try Content-Range (more accurate than Content-Length)
  const contentRange = headers['content-range'];
  if (contentRange) {
    const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
    if (match) {
      const bytes = parseInt(match[1], 10);
      return {
        bytes,
        type: SizeType.EXACT,
        display: formatBytes(bytes)
      };
    }
  }

  // 3. Estimate from bitrate and duration
  if (bitrate && duration) {
    const bytes = Math.round((bitrate * duration) / 8);
    return {
      bytes,
      type: SizeType.ESTIMATED,
      display: `~${formatBytes(bytes)}`
    };
  }

  // 4. Unknown - be honest
  return {
    bytes: null,
    type: SizeType.UNKNOWN,
    display: 'Unknown'
  };
}

/**
 * Check if format is progressive (has definite file size)
 * @param {string} format - Media format/extension
 * @returns {boolean} True if progressive
 */
function isProgressiveFormat(format) {
  const progressiveFormats = ['mp4', 'm4a', 'mp3', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
  return progressiveFormats.includes(format?.toLowerCase());
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return 'Unknown';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Estimate size from bitrate and duration
 * @param {number} bitrate - Bitrate in bps
 * @param {number} duration - Duration in seconds
 * @returns {number} Estimated bytes
 */
export function estimateSize(bitrate, duration) {
  if (!bitrate || !duration) return null;
  return Math.round((bitrate * duration) / 8);
}

/**
 * Parse size string to bytes
 * @param {string} sizeStr - Size string (e.g., "10 MB", "1.5 GB")
 * @returns {number|null} Bytes or null
 */
export function parseSize(sizeStr) {
  if (!sizeStr) return null;

  const match = sizeStr.match(/^([\d.]+)\s*(bytes|kb|mb|gb|tb)$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    bytes: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024
  };

  return Math.round(value * multipliers[unit]);
}
