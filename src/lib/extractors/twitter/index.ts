/**
 * Twitter/X Extractor - Main entry point
 * 
 * Cookie Strategy (3-tier):
 * 1. Syndication API - No cookie (for public content)
 * 2. GraphQL API - Server cookie (auto-retry on auth error)
 * 3. GraphQL API - Client cookie (last resort)
 */

import { BaseExtractor } from '../base.extractor';
import type { ExtractOptions, InternalExtractResponse } from '../base.extractor';
import { ErrorCode } from '@/lib/utils/error.utils';
import { logger } from '@/lib/utils/logger';

import {
  matchUrl,
  extractTweetInfo,
  resolveShortUrl,
  fetchSyndication,
  fetchGraphQL,
  type SyndicationResponse,
  type GraphQLResponse,
} from './scanner';
import {
  parseSyndication,
  parseGraphQL,
  buildExtractResult,
} from './extract';

/**
 * Server-side Twitter cookie (from environment)
 * Used as fallback when Syndication API fails
 */
const SERVER_COOKIE = process.env.TWITTER_COOKIE || '';

/**
 * Twitter Extractor class
 * 
 * Implements 3-tier cookie strategy:
 * 1. Syndication API (public, no cookie) - fastest, works for most public tweets
 * 2. GraphQL API with server cookie - for protected content or when Syndication fails
 * 3. GraphQL API with client cookie - last resort, user-provided cookie
 */
export class TwitterExtractor extends BaseExtractor {
  static platform = 'twitter';
  
  /**
   * URL patterns for Twitter/X
   * Supports: twitter.com, x.com, t.co (short links)
   * Paths: /username/status/id
   */
  static patterns: RegExp[] = [
    /(?:www\.)?twitter\.com/i,
    /(?:www\.)?x\.com/i,
    /t\.co/i
  ];

  /**
   * Extract media from Twitter URL
   * 
   * @param url - Twitter tweet URL
   * @param options - Extraction options (signal, timeout, cookie)
   * @returns Extraction result with video/image data
   */
  async extract(url: string, options: ExtractOptions = {}): Promise<InternalExtractResponse> {
    const startTime = Date.now();
    const { signal, cookie: clientCookie } = options;

    try {
      // Validate URL
      if (!matchUrl(url)) {
        logger.warn('twitter', 'Invalid Twitter URL', { url });
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_URL,
            message: 'Invalid Twitter URL format',
          },
        };
      }

      logger.info('twitter', 'Starting extraction', { url });

      // Resolve short URLs (t.co)
      let resolvedUrl = url;
      if (url.includes('t.co')) {
        resolvedUrl = await resolveShortUrl(url, signal);
        logger.debug('twitter', 'Resolved short URL', { original: url, resolved: resolvedUrl });
      }

      // Extract tweet info
      const tweetInfo = extractTweetInfo(resolvedUrl);
      if (!tweetInfo) {
        logger.warn('twitter', 'Could not extract tweet ID from URL', { url: resolvedUrl });
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_URL,
            message: 'Could not extract tweet ID from URL',
          },
        };
      }

      const { tweetId, username } = tweetInfo;
      logger.debug('twitter', 'Extracted tweet info', { tweetId, username });

      // ============================================================
      // TIER 1: Syndication API (no cookie)
      // ============================================================
      logger.debug('twitter', 'Trying Syndication API (Tier 1)');
      const syndicationResult = await fetchSyndication(tweetId, signal);

      if (syndicationResult.success && syndicationResult.data) {
        const parsed = parseSyndication(syndicationResult.data as SyndicationResponse);
        
        // Check if we got media
        if (parsed.items.length > 0) {
          const result = buildExtractResult(parsed, false);
          logger.complete('twitter', Date.now() - startTime);
          return result;
        }
        
        // No media found - might be text-only tweet
        logger.debug('twitter', 'Syndication returned no media, checking if text-only');
      }

      // Check if Syndication failed due to auth issues (need cookie)
      const needsCookie = syndicationResult.error?.code === ErrorCode.PRIVATE_CONTENT ||
                          syndicationResult.error?.code === ErrorCode.LOGIN_REQUIRED;

      // ============================================================
      // TIER 2: GraphQL API with server cookie
      // ============================================================
      if (SERVER_COOKIE && (needsCookie || !syndicationResult.success)) {
        logger.debug('twitter', 'Trying GraphQL API with server cookie (Tier 2)');
        const graphqlResult = await fetchGraphQL(tweetId, SERVER_COOKIE, signal);

        if (graphqlResult.success && graphqlResult.data) {
          const parsed = parseGraphQL(graphqlResult.data as GraphQLResponse);
          
          if (parsed && parsed.items.length > 0) {
            const result = buildExtractResult(parsed, true);
            logger.complete('twitter', Date.now() - startTime);
            return result;
          }
        }

        // If server cookie failed due to auth, try client cookie
        if (graphqlResult.error?.code === ErrorCode.LOGIN_REQUIRED) {
          logger.debug('twitter', 'Server cookie expired or invalid');
        }
      }

      // ============================================================
      // TIER 3: GraphQL API with client cookie
      // ============================================================
      if (clientCookie) {
        logger.debug('twitter', 'Trying GraphQL API with client cookie (Tier 3)');
        const graphqlResult = await fetchGraphQL(tweetId, clientCookie, signal);

        if (graphqlResult.success && graphqlResult.data) {
          const parsed = parseGraphQL(graphqlResult.data as GraphQLResponse);
          
          if (parsed && parsed.items.length > 0) {
            const result = buildExtractResult(parsed, true);
            logger.complete('twitter', Date.now() - startTime);
            return result;
          }
        }

        // Return client cookie error if it failed
        if (graphqlResult.error) {
          return {
            success: false,
            error: graphqlResult.error,
          };
        }
      }

      // ============================================================
      // All tiers failed - return appropriate error
      // ============================================================
      
      // If Syndication succeeded but no media, it's a text-only tweet
      if (syndicationResult.success) {
        return {
          success: false,
          error: {
            code: ErrorCode.NO_MEDIA_FOUND,
            message: 'This tweet does not contain any downloadable media',
          },
        };
      }

      // Return the original error from Syndication
      if (syndicationResult.error) {
        return {
          success: false,
          error: syndicationResult.error,
        };
      }

      // Generic fallback error
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: 'Failed to extract media from tweet',
        },
      };

    } catch (error) {
      logger.error('twitter', 'Extraction failed', error as Error);

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
          message: `Twitter extraction failed: ${message}`,
        },
      };
    }
  }
}

export default TwitterExtractor;
