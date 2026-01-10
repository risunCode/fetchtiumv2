/**
 * Extractor registry
 */

import { detectPlatform } from '../utils/url.utils.js';
import { ExtractorError, ErrorCode } from '../utils/error.utils.js';
import { logger } from '../utils/logger.js';
import FacebookExtractor from './facebook/index.js';

const extractors = {
  facebook: FacebookExtractor
};

export function getExtractor(url) {
  const platform = detectPlatform(url);
  
  if (!platform) {
    logger.warn('extractor', 'Platform not detected', { url });
    throw new ExtractorError(
      ErrorCode.UNSUPPORTED_PLATFORM,
      'Platform not supported or URL invalid'
    );
  }

  const ExtractorClass = extractors[platform];
  
  if (!ExtractorClass) {
    logger.warn('extractor', 'Extractor not implemented', { platform });
    throw new ExtractorError(
      ErrorCode.UNSUPPORTED_PLATFORM,
      `Platform "${platform}" not yet implemented`
    );
  }

  logger.info('extractor', 'Extractor found', { platform });
  return new ExtractorClass();
}

export function isSupported(url) {
  try {
    const platform = detectPlatform(url);
    return platform && extractors[platform] !== undefined;
  } catch (error) {
    return false;
  }
}

export function getSupportedPlatforms() {
  return Object.keys(extractors);
}

export function registerExtractor(platform, ExtractorClass) {
  extractors[platform] = ExtractorClass;
  logger.info('extractor', 'Extractor registered', { platform });
}
