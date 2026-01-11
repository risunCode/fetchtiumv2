/**
 * Instagram Extractor - Main entry point
 * 
 * Cookie Strategy (3-tier):
 * 1. GraphQL API - No cookie (for public content)
 * 2. Internal API - Server cookie (auto-retry on auth error)
 * 3. Internal API - Client cookie (last resort)
 */

import { BaseExtractor } from '../base.extractor';
import type { ExtractOptions, InternalExtractResponse } from '../base.extractor';
import { ErrorCode } from '@/lib/utils/error.utils';
import { logger } from '@/lib/utils/logger';

import {
  matchUrl,
  extractShortcode,
  shortcodeToMediaId,
  fetchGraphQL,
  fetchInternalAPI,
  type GraphQLResponse,
  type InternalAPIResponse,
} from './scanner';
import {
  parseGraphQLResponse,
  parseAPIResponse,
  buildExtractResult,
} from './extract';

/**
 * Server-side Instagram cookie (from environment)
 * Used as fallback when GraphQL API fails
 */
const SERVER_COOKIE = process.env.INSTAGRAM_COOKIE || '';

/**
 * Instagram Extractor class
 * 
 * Implements 3-tier cookie strategy:
 * 1. GraphQL API (public, no cookie) - fastest, works for public posts
 * 2. Internal API with server cookie - for private content or when GraphQL fails
 * 3. Internal API with client cookie - last resort, user-provided cookie
 */
export class InstagramExtractor extends BaseExtractor {
  static platform = 'instagram';
  
  /**
   * URL patterns for Instagram
   * Supports: instagram.com, instagr.am
   * Paths: /p/, /reel/, /tv/, /stories/
   */
  static patterns: RegExp[] = [
    /(?:www\.)?instagram\.com/i,
    /instagr\.am/i
  ];

  /**
   * Extract media from Instagram URL
   * 
   * @param url - Instagram post URL
   * @param options - Extraction options (signal, timeout, cookie)
   * @returns Extraction result with video/image data
   */
  async extract(url: string, options: ExtractOptions = {}): Promise<InternalExtractResponse> {
    const startTime = Date.now();
    const { signal, cookie: clientCookie } = options;

    try {
      // Validate URL
      if (!matchUrl(url)) {
        logger.warn('instagram', 'Invalid Instagram URL', { url });
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_URL,
            message: 'Invalid Instagram URL format',
          },
        };
      }

      logger.info('instagram', 'Starting extraction', { url });

      // Extract shortcode from URL
      const shortcode = extractShortcode(url);
      if (!shortcode) {
        logger.warn('instagram', 'Could not extract shortcode from URL', { url });
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_URL,
            message: 'Could not extract post ID from URL',
          },
        };
      }

      logger.debug('instagram', 'Extracted shortcode', { shortcode });

      // ============================================================
      // TIER 1: GraphQL API (no cookie)
      // ============================================================
      logger.debug('instagram', 'Trying GraphQL API (Tier 1)');
      const graphqlResult = await fetchGraphQL(shortcode, signal);

      if (graphqlResult.success && graphqlResult.data) {
        const parsed = parseGraphQLResponse(graphqlResult.data as GraphQLResponse);
        
        // Check if we got media
        if (parsed && parsed.items.length > 0) {
          const result = buildExtractResult(parsed, false);
          logger.complete('instagram', Date.now() - startTime);
          return result;
        }
        
        logger.debug('instagram', 'GraphQL returned no media');
      }

      // Check if GraphQL failed due to auth issues (need cookie)
      const needsCookie = graphqlResult.error?.code === ErrorCode.PRIVATE_CONTENT ||
                          graphqlResult.error?.code === ErrorCode.LOGIN_REQUIRED;

      // Convert shortcode to media ID for Internal API
      let mediaId: string;
      try {
        mediaId = shortcodeToMediaId(shortcode);
        logger.debug('instagram', 'Converted shortcode to media ID', { shortcode, mediaId });
      } catch (error) {
        logger.error('instagram', 'Failed to convert shortcode', error as Error);
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_URL,
            message: 'Invalid Instagram shortcode format',
          },
        };
      }

      // ============================================================
      // TIER 2: Internal API with server cookie
      // ============================================================
      if (SERVER_COOKIE && (needsCookie || !graphqlResult.success)) {
        logger.debug('instagram', 'Trying Internal API with server cookie (Tier 2)');
        const apiResult = await fetchInternalAPI(mediaId, SERVER_COOKIE, signal);

        if (apiResult.success && apiResult.data) {
          const parsed = parseAPIResponse(apiResult.data as InternalAPIResponse);
          
          if (parsed && parsed.items.length > 0) {
            const result = buildExtractResult(parsed, true);
            logger.complete('instagram', Date.now() - startTime);
            return result;
          }
        }

        // If server cookie failed due to auth, try client cookie
        if (apiResult.error?.code === ErrorCode.LOGIN_REQUIRED) {
          logger.debug('instagram', 'Server cookie expired or invalid');
        }
      }

      // ============================================================
      // TIER 3: Internal API with client cookie
      // ============================================================
      if (clientCookie) {
        logger.debug('instagram', 'Trying Internal API with client cookie (Tier 3)');
        const apiResult = await fetchInternalAPI(mediaId, clientCookie, signal);

        if (apiResult.success && apiResult.data) {
          const parsed = parseAPIResponse(apiResult.data as InternalAPIResponse);
          
          if (parsed && parsed.items.length > 0) {
            const result = buildExtractResult(parsed, true);
            logger.complete('instagram', Date.now() - startTime);
            return result;
          }
        }

        // Return client cookie error if it failed
        if (apiResult.error) {
          return {
            success: false,
            error: apiResult.error,
          };
        }
      }

      // ============================================================
      // All tiers failed - return appropriate error
      // ============================================================
      
      // If GraphQL succeeded but no media, it might be a text-only post
      if (graphqlResult.success) {
        return {
          success: false,
          error: {
            code: ErrorCode.NO_MEDIA_FOUND,
            message: 'This post does not contain any downloadable media',
          },
        };
      }

      // Return the original error from GraphQL
      if (graphqlResult.error) {
        return {
          success: false,
          error: graphqlResult.error,
        };
      }

      // Generic fallback error
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: 'Failed to extract media from Instagram post',
        },
      };

    } catch (error) {
      logger.error('instagram', 'Extraction failed', error as Error);

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
          message: `Instagram extraction failed: ${message}`,
        },
      };
    }
  }
}

export default InstagramExtractor;
