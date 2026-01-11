/**
 * TikTok Extractor - Main entry point
 * 
 * Strategy: TikWM API only (no cookie needed)
 * TikTok content is publicly accessible via third-party API
 */

import { BaseExtractor } from '../base.extractor';
import type { ExtractOptions, InternalExtractResponse } from '../base.extractor';
import { ErrorCode } from '@/lib/utils/error.utils';
import { logger } from '@/lib/utils/logger';

import { fetchTikWM, matchUrl } from './scanner';
import { parseTikWM, buildExtractResult } from './extract';

/**
 * TikTok Extractor class
 * 
 * Uses TikWM third-party API for extraction.
 * No cookie required - all TikTok content is publicly accessible.
 */
export class TikTokExtractor extends BaseExtractor {
  static platform = 'tiktok';
  
  /**
   * URL patterns for TikTok
   * Supports: tiktok.com, vm.tiktok.com (short), vt.tiktok.com (short)
   * Paths: /@username/video/id, /t/shortcode
   */
  static patterns: RegExp[] = [
    /(?:www\.)?tiktok\.com/i,
    /vm\.tiktok\.com/i,
    /vt\.tiktok\.com/i
  ];

  /**
   * Extract media from TikTok URL
   * 
   * @param url - TikTok video URL
   * @param options - Extraction options (signal, timeout)
   * @returns Extraction result with video/slideshow data
   */
  async extract(url: string, options: ExtractOptions = {}): Promise<InternalExtractResponse> {
    const startTime = Date.now();
    const { signal } = options;

    try {
      // Validate URL
      if (!matchUrl(url)) {
        logger.warn('tiktok', 'Invalid TikTok URL', { url });
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_URL,
            message: 'Invalid TikTok URL format',
          },
        };
      }

      logger.info('tiktok', 'Starting extraction', { url });

      // Fetch from TikWM API
      const scanResult = await fetchTikWM(url, signal);

      if (!scanResult.success || !scanResult.data) {
        logger.warn('tiktok', 'TikWM fetch failed', scanResult.error);
        return {
          success: false,
          error: scanResult.error || {
            code: ErrorCode.EXTRACTION_FAILED,
            message: 'Failed to fetch TikTok data',
          },
        };
      }

      // Parse TikWM response
      const parsed = parseTikWM(scanResult.data);

      // Validate we have media
      if (parsed.items.length === 0) {
        logger.warn('tiktok', 'No media found in response');
        return {
          success: false,
          error: {
            code: ErrorCode.NO_MEDIA_FOUND,
            message: 'No video or images found in TikTok response',
          },
        };
      }

      // Build final result
      const result = buildExtractResult(parsed);

      logger.complete('tiktok', Date.now() - startTime);
      return result;

    } catch (error) {
      logger.error('tiktok', 'Extraction failed', error as Error);

      const message = error instanceof Error ? error.message : String(error);

      // Handle specific error types
      if (message.includes('abort') || message.includes('AbortError')) {
        return {
          success: false,
          error: {
            code: ErrorCode.TIMEOUT,
            message: 'Request was aborted',
          },
        };
      }

      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: `TikTok extraction failed: ${message}`,
        },
      };
    }
  }
}

export default TikTokExtractor;
