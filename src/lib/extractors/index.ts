/**
 * Extractor registry - Self-registering extractors
 * 
 * Each extractor defines its own URL patterns via static `patterns` property.
 * Registry loops through all extractors and calls `match(url)` to find the right one.
 * 
 * TypeScript conversion of extractors/index.js
 */

import { ExtractorError, ErrorCode } from '@/lib/utils/error.utils';
import { logger } from '@/lib/utils/logger';
import { isPythonPlatform, PYTHON_PLATFORMS } from './python-platforms';
import { getExtractorProfile, isPythonEnabled } from '@/lib/config';
import type { BaseExtractor, ExtractorClass } from './base.extractor';

// Import all extractors
import { FacebookExtractor } from './facebook';
import { InstagramExtractor } from './instagram';
import { TwitterExtractor } from './twitter';
import { TikTokExtractor } from './tiktok';
import { PixivExtractor } from './pixiv';
// import { YouTubeExtractor } from './youtube';

/**
 * All registered extractors
 * Order matters - first match wins
 */
const extractors: ExtractorClass[] = [
  FacebookExtractor,
  InstagramExtractor,
  TwitterExtractor,
  TikTokExtractor,
  PixivExtractor,
  // YouTubeExtractor,
];

/**
 * Platform info for getSupportedPlatforms
 */
export interface PlatformInfo {
  platform: string;
  patterns: string[];
}

/**
 * Find extractor by URL
 * Loops through all extractors, calls static match()
 */
export function getExtractor(url: string): BaseExtractor {
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
export function detectPlatform(url: string): string | null {
  for (const Extractor of extractors) {
    if (Extractor.match(url)) {
      return Extractor.platform;
    }
  }
  return null;
}

/**
 * Check if URL is supported (TypeScript or Python extractors)
 */
export function isSupported(url: string): boolean {
  const supportedByNative = extractors.some(E => E.match(url));
  if (supportedByNative) return true;

  if (!isPythonEnabled()) return false;
  return isPythonPlatform(url);
}

/**
 * Get all supported platforms with their patterns (profile-aware)
 */
export function getSupportedPlatforms(): PlatformInfo[] {
  const nativePlatforms = extractors.map(E => ({
    platform: E.platform,
    patterns: E.patterns.map(p => p.toString())
  }));

  if (!isPythonEnabled()) {
    return nativePlatforms;
  }

  const pythonPlatforms = PYTHON_PLATFORMS.map(p => ({
    platform: p.platform,
    patterns: p.patterns.map(r => r.toString())
  }));

  logger.debug('extractor', 'Resolved supported platforms by profile', {
    profile: getExtractorProfile(),
    nativeCount: nativePlatforms.length,
    pythonCount: pythonPlatforms.length,
  });

  return [...nativePlatforms, ...pythonPlatforms];
}

/**
 * Register a new extractor dynamically
 */
export function registerExtractor(ExtractorClass: ExtractorClass): void {
  if (!ExtractorClass.platform || !ExtractorClass.patterns) {
    throw new Error('Extractor must have static platform and patterns');
  }
  extractors.push(ExtractorClass);
  logger.info('extractor', 'Registered', { platform: ExtractorClass.platform });
}

// Re-export base extractor
export { BaseExtractor } from './base.extractor';
export type { ExtractOptions, ExtractorClass, InternalExtractResult, InternalExtractError, InternalExtractResponse } from './base.extractor';

