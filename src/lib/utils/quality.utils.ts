/**
 * Quality Utilities
 * Shared helper functions for converting video bitrate to quality labels and resolutions
 * 
 * Supports: 4K, 2K, 1080p, 720p, 540p, 480p, 360p, 240p, 144p
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Bitrate threshold for quality detection
 */
export interface QualityThreshold {
  minBitrate: number;  // Minimum bitrate for this quality
  quality: string;     // Quality label (e.g., '1080p', '4K')
  resolution: string;  // Resolution string (e.g., '1920x1080')
}

/**
 * Quality info result
 */
export interface QualityInfo {
  quality: string;
  resolution: string;
}

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Quality thresholds ordered from highest to lowest
 * Used to determine quality label and resolution from bitrate
 */
export const QUALITY_THRESHOLDS: QualityThreshold[] = [
  { minBitrate: 8000000, quality: '4K', resolution: '3840x2160' },
  { minBitrate: 4000000, quality: '2K', resolution: '2560x1440' },
  { minBitrate: 2000000, quality: '1080p', resolution: '1920x1080' },
  { minBitrate: 1000000, quality: '720p', resolution: '1280x720' },
  { minBitrate: 600000, quality: '540p', resolution: '960x540' },
  { minBitrate: 400000, quality: '480p', resolution: '854x480' },
  { minBitrate: 200000, quality: '360p', resolution: '640x360' },
  { minBitrate: 100000, quality: '240p', resolution: '426x240' },
  { minBitrate: 0, quality: '144p', resolution: '256x144' },
];

// Default fallback for invalid bitrates
const DEFAULT_QUALITY: QualityInfo = {
  quality: '144p',
  resolution: '256x144',
};


// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize bitrate value to handle edge cases
 * @param bitrate - Raw bitrate value
 * @returns Normalized bitrate (0 for invalid values)
 */
function normalizeBitrate(bitrate: number | undefined | null): number {
  // Handle undefined, null, NaN
  if (bitrate === undefined || bitrate === null || Number.isNaN(bitrate)) {
    return 0;
  }
  // Handle negative values
  if (bitrate < 0) {
    return 0;
  }
  return bitrate;
}

/**
 * Get quality info (quality label and resolution) from bitrate
 * @param bitrate - Video bitrate in bits per second
 * @returns Quality info with quality label and resolution
 */
export function getQualityInfo(bitrate: number | undefined | null): QualityInfo {
  const normalizedBitrate = normalizeBitrate(bitrate);
  
  // Find matching threshold
  for (const threshold of QUALITY_THRESHOLDS) {
    if (normalizedBitrate >= threshold.minBitrate) {
      return {
        quality: threshold.quality,
        resolution: threshold.resolution,
      };
    }
  }
  
  // Fallback (should never reach here due to 0 threshold)
  return DEFAULT_QUALITY;
}

/**
 * Get quality label from bitrate
 * @param bitrate - Video bitrate in bits per second
 * @returns Quality label (e.g., '1080p', '4K', '144p')
 */
export function getQualityFromBitrate(bitrate: number | undefined | null): string {
  return getQualityInfo(bitrate).quality;
}

/**
 * Get resolution from bitrate (approximate)
 * @param bitrate - Video bitrate in bits per second
 * @returns Resolution string (e.g., '1920x1080', '3840x2160')
 */
export function getResolutionFromBitrate(bitrate: number | undefined | null): string {
  return getQualityInfo(bitrate).resolution;
}
