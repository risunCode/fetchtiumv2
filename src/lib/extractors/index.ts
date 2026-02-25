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
import { NATIVE_EXTRACTORS } from './native';
import { WRAPPER_EXTRACTORS } from './wrappers';
import type { ExtractionRequest, ExtractionResult, SupportedPlatform } from './types';
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

const PLATFORM_PATTERNS: Record<SupportedPlatform, RegExp[]> = {
  facebook: [/facebook\.com/i, /fb\.watch/i, /fb\.me/i],
  instagram: [/instagram\.com/i, /instagr\.am/i],
  tiktok: [/tiktok\.com/i, /vm\.tiktok\.com/i],
  twitter: [/twitter\.com/i, /x\.com/i, /t\.co/i],
  pixiv: [/pixiv\.net/i],
  youtube: [/youtube\.com/i, /youtu\.be/i, /youtube-nocookie\.com/i],
  bilibili: [/bilibili\.com/i, /bilibili\.tv/i, /b23\.tv/i],
  soundcloud: [/soundcloud\.com/i],
  twitch: [/twitch\.tv/i, /clips\.twitch\.tv/i],
  bandcamp: [/bandcamp\.com/i],
  reddit: [/reddit\.com/i, /redd\.it/i, /v\.redd\.it/i],
  pinterest: [/pinterest\.com/i, /pin\.it/i],
  weibo: [/weibo\.com/i, /weibo\.cn/i],
  eporner: [/eporner\.com/i],
  rule34video: [/rule34video\.com/i],
};

export function detectPlatformV2(url: string): SupportedPlatform | null {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(url))) {
      return platform as SupportedPlatform;
    }
  }
  return null;
}

export async function extract(request: ExtractionRequest): Promise<ExtractionResult> {
  const platform = detectPlatformV2(request.url);
  const startedAt = Date.now();

  const buildUnsupportedResult = (message: string): ExtractionResult => ({
    success: false,
    error: {
      code: ErrorCode.UNSUPPORTED_PLATFORM,
      message,
    },
    meta: {
      responseTime: Date.now() - startedAt,
      accessMode: 'public',
      publicContent: true,
    },
  });

  if (!platform) {
    return buildUnsupportedResult('Platform not supported');
  }

  const nativeExtractor = NATIVE_EXTRACTORS[platform];
  if (nativeExtractor) {
    return nativeExtractor(request);
  }

  const wrapperExtractor = WRAPPER_EXTRACTORS[platform];
  if (wrapperExtractor) {
    return wrapperExtractor(request);
  }

  return buildUnsupportedResult(`No extractor available for platform: ${platform}`);
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
export type { ExtractionRequest, ExtractionResult, SupportedPlatform } from './types';

