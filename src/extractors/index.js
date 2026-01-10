/**
 * Extractor registry - Self-registering extractors
 * 
 * Each extractor defines its own URL patterns via static `patterns` property.
 * Registry loops through all extractors and calls `match(url)` to find the right one.
 */

import { ExtractorError, ErrorCode } from '../utils/error.utils.js';
import { logger } from '../utils/logger.js';

// Import all extractors
import FacebookExtractor from './facebook/index.js';
// import YouTubeExtractor from './youtube/index.js';
// import InstagramExtractor from './instagram/index.js';
// ... add more as implemented

/**
 * All registered extractors
 * Order matters - first match wins
 */
const extractors = [
  FacebookExtractor,
  // YouTubeExtractor,
  // InstagramExtractor,
  // TikTokExtractor,
  // TwitterExtractor,
];

/**
 * Find extractor by URL
 * Loops through all extractors, calls static match()
 */
export function getExtractor(url) {
  for (const Extractor of extractors) {
    if (Extractor.match(url)) {
      logger.info('extractor', 'Matched', { platform: Extractor.platform });
      return new Extractor();
    }
  }
  
  logger.warn('extractor', 'No extractor found', { url });
  throw new ExtractorError(
    ErrorCode.UNSUPPORTED_PLATFORM,
    'Platform not supported or URL invalid'
  );
}

/**
 * Detect platform from URL (for info only)
 */
export function detectPlatform(url) {
  for (const Extractor of extractors) {
    if (Extractor.match(url)) {
      return Extractor.platform;
    }
  }
  return null;
}

/**
 * Check if URL is supported
 */
export function isSupported(url) {
  return extractors.some(E => E.match(url));
}

/**
 * Get all supported platforms with their patterns
 */
export function getSupportedPlatforms() {
  return extractors.map(E => ({
    platform: E.platform,
    patterns: E.patterns.map(p => p.toString())
  }));
}

/**
 * Register a new extractor dynamically
 */
export function registerExtractor(ExtractorClass) {
  if (!ExtractorClass.platform || !ExtractorClass.patterns) {
    throw new Error('Extractor must have static platform and patterns');
  }
  extractors.push(ExtractorClass);
  logger.info('extractor', 'Registered', { platform: ExtractorClass.platform });
}
