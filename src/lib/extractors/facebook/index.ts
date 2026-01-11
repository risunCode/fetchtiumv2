/**
 * Facebook Extractor - Main entry point
 * TypeScript conversion of facebook/index.js
 * 
 * Cookie Strategy (3-tier):
 * 1. Guest Mode - No cookie (for public content)
 * 2. Server Cookie - From file/env (auto-retry on auth error)
 * 3. Client Cookie - From user (last resort)
 * 
 * Exception: Stories always skip guest mode (auth required)
 */

import { BaseExtractor } from '../base.extractor';
import type { ExtractOptions, InternalExtractResponse } from '../base.extractor';
import { 
  fetchStream, 
  resolveUrl,
  getFacebookHeaders, 
  getFacebookCookies, 
  hasValidAuthCookies,
  getFileSizes,
  parseCookies
} from '@/lib/core/network';
import { extractMetaTags, decodeHtmlEntities } from '@/lib/core/parser';
import { normalizeUrl, isKnownPattern } from '@/lib/utils/url.utils';
import { ErrorCode } from '@/lib/utils/error.utils';
import { logger } from '@/lib/utils/logger';

import { 
  KNOWN_PATTERNS, 
  detectContentType, 
  detectContentIssues, 
  findTargetBlock, 
  scanStream,
  type ContentType
} from './scanner';
import { 
  extractVideoUrls, 
  extractImageUrls, 
  extractStories, 
  extractMetadata,
  extractVideoId,
  extractPostId,
  buildExtractResult,
  buildErrorResult,
  type RawFormat,
  type ExtractResultSuccess,
  type ExtractResultError
} from './extract';

/**
 * Cookie source tracking
 */
export type CookieSource = 'none' | 'server' | 'client';

/**
 * Internal extraction options
 */
interface InternalExtractOptions {
  signal?: AbortSignal;
  timeout?: number;
  cookieSource: CookieSource;
  cookieValue?: string;
  inputUrl: string;
}

/**
 * Extended result with cookie source
 */
interface ExtractResultWithCookieSource extends ExtractResultSuccess {
  cookieSource: CookieSource;
}

/**
 * Check if error requires auth retry
 */
function needsAuthRetry(error: { code: string }, contentType: ContentType): boolean {
  if (error.code === ErrorCode.LOGIN_REQUIRED) return true;
  if (error.code === ErrorCode.PRIVATE_CONTENT) return true;
  // For video/reel, NO_MEDIA_FOUND might mean auth needed
  if (error.code === ErrorCode.NO_MEDIA_FOUND && 
      (contentType === 'reel' || contentType === 'video')) {
    return true;
  }
  return false;
}

/**
 * Facebook Extractor class
 */
export class FacebookExtractor extends BaseExtractor {
  static platform = 'facebook';
  
  static patterns: RegExp[] = [
    /(?:www\.|m\.|web\.|mobile\.)?facebook\.com/i,
    /fb\.watch/i,
    /fb\.me/i
  ];

  async extract(inputUrl: string, options: ExtractOptions = {}): Promise<InternalExtractResponse> {
    const startTime = Date.now();
    const { signal, timeout, cookie: clientCookie } = options;

    try {
      const normalizedUrl = normalizeUrl(inputUrl);

      // Resolve URL if needed
      let finalUrl = normalizedUrl;
      const needsResolve = !isKnownPattern(normalizedUrl, KNOWN_PATTERNS);
      
      if (needsResolve) {
        const headers = getFacebookHeaders('ipad');
        try {
          const resolved = await resolveUrl(normalizedUrl, { headers, timeout, maxRedirects: 10 });
          if (resolved) {
            logger.resolve('facebook', normalizedUrl, resolved);
            finalUrl = resolved;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('facebook', 'URL resolution failed', { error: errorMessage });
        }
      }

      const contentType = detectContentType(finalUrl);
      logger.type('facebook', contentType);

      // Stories always need auth - skip guest mode
      const isStory = contentType === 'story' || /\/stories\//.test(finalUrl);

      let result: ExtractResultSuccess | ExtractResultError;

      if (isStory) {
        // Stories: Server Cookie first → Client Cookie
        logger.info('facebook', 'Story detected, using server cookie');
        result = await this._tryWithServerCookie(finalUrl, contentType, inputUrl, signal, timeout);
        
        if (!result.success && clientCookie) {
          logger.info('facebook', 'Server cookie failed, trying client cookie');
          result = await this._extractWithCookie(finalUrl, contentType, {
            signal, timeout, inputUrl,
            cookieSource: 'client',
            cookieValue: clientCookie
          });
        }
      } else {
        // Normal flow: Guest → Server Cookie → Client Cookie
        
        // 1. Guest Mode (no cookie)
        logger.info('facebook', 'Trying guest mode');
        result = await this._extractWithCookie(finalUrl, contentType, {
          signal, timeout, inputUrl,
          cookieSource: 'none'
        });

        // 2. Server Cookie (if guest failed with auth error)
        if (!result.success && needsAuthRetry(result.error, contentType)) {
          logger.info('facebook', 'Guest failed, trying server cookie');
          result = await this._tryWithServerCookie(finalUrl, contentType, inputUrl, signal, timeout);
        }

        // 3. Client Cookie (if server cookie also failed)
        if (!result.success && needsAuthRetry(result.error, contentType) && clientCookie) {
          logger.info('facebook', 'Server cookie failed, trying client cookie');
          result = await this._extractWithCookie(finalUrl, contentType, {
            signal, timeout, inputUrl,
            cookieSource: 'client',
            cookieValue: clientCookie
          });
        }
      }

      logger.complete('facebook', Date.now() - startTime);
      return result;

    } catch (error) {
      logger.error('facebook', 'Extraction failed', error as Error);
      
      if (error instanceof Error) {
        if ((error as any).code === ErrorCode.TIMEOUT) {
          return buildErrorResult(ErrorCode.TIMEOUT, 'Request timeout');
        }
        if ((error as any).code === ErrorCode.RATE_LIMITED) {
          return buildErrorResult(ErrorCode.RATE_LIMITED, 'Rate limited');
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
      return buildErrorResult(ErrorCode.EXTRACTION_FAILED, errorMessage);
    }
  }

  /**
   * Try extraction with server cookie
   */
  private async _tryWithServerCookie(
    finalUrl: string,
    contentType: ContentType,
    inputUrl: string,
    signal?: AbortSignal,
    timeout?: number
  ): Promise<ExtractResultSuccess | ExtractResultError> {
    // Get server cookie (from file/env, no client cookie)
    const serverCookie = await getFacebookCookies({});
    
    if (!hasValidAuthCookies(serverCookie)) {
      logger.warn('facebook', 'No valid server cookies available');
      return buildErrorResult(ErrorCode.LOGIN_REQUIRED, 'No server cookies available');
    }

    return this._extractWithCookie(finalUrl, contentType, {
      signal, timeout, inputUrl,
      cookieSource: 'server',
      cookieValue: serverCookie
    });
  }

  /**
   * Internal extraction with specific cookie source
   */
  private async _extractWithCookie(
    finalUrl: string, 
    contentType: ContentType, 
    options: InternalExtractOptions
  ): Promise<ExtractResultSuccess | ExtractResultError> {
    const { signal, timeout, inputUrl, cookieSource, cookieValue } = options;

    // Build headers
    const headers = getFacebookHeaders('ipad');
    
    // Add cookie if provided - MUST parse to cookie header format first
    if (cookieSource !== 'none' && cookieValue) {
      const parsedCookie = parseCookies(cookieValue);
      if (parsedCookie) {
        headers['Cookie'] = parsedCookie;
        logger.debug('facebook', `Using ${cookieSource} cookie`);
      }
    }

    // Fetch HTML
    const { stream, finalUrl: redirectedUrl } = await fetchStream(finalUrl, {
      headers,
      signal,
      timeout
    });

    const { html, hasIssue, issueCode } = await scanStream(stream, {
      contentType,
      signal
    });

    // Early exit on issues
    if (hasIssue && issueCode) {
      return buildErrorResult(issueCode, `Content issue: ${issueCode}`);
    }

    if (html.length < 10000 && html.includes('Sorry, something went wrong')) {
      return buildErrorResult(ErrorCode.FETCH_FAILED, 'Facebook returned error page');
    }

    const hasMediaPatterns = html.includes('browser_native') || 
                            html.includes('all_subattachments') || 
                            html.includes('viewer_image') || 
                            html.includes('photo_image');
    
    if (!hasMediaPatterns && html.length < 500000 && 
        (html.includes('login_form') || html.includes('Log in to Facebook'))) {
      return buildErrorResult(ErrorCode.LOGIN_REQUIRED, 'This content requires login');
    }

    const finalIssue = detectContentIssues(html);
    if (finalIssue) {
      return buildErrorResult(finalIssue, `Content issue: ${finalIssue}`);
    }

    // Extract content
    const decoded = decodeHtmlEntities(html);
    const meta = extractMetaTags(html);
    const metadata = extractMetadata(decoded, finalUrl);
    metadata.title = meta.title || metadata.author;

    const seenUrls = new Set<string>();
    let formats: RawFormat[] = [];

    const actualType = detectContentType(redirectedUrl || finalUrl);
    const isVideo = actualType === 'video' || actualType === 'reel';
    const isPost = actualType === 'post' || actualType === 'group' || actualType === 'unknown';

    // Check for unavailable attachment
    const hasUnavailableAttachment = html.includes('"UnavailableAttachment"') || 
                                    html.includes('"unavailable_attachment_style"') ||
                                    (html.includes("This content isn't available") && html.includes('attachment'));

    if (hasUnavailableAttachment && actualType === 'group') {
      return buildErrorResult(ErrorCode.PRIVATE_CONTENT, 'The shared content is no longer available');
    }

    // Extract based on content type
    if (actualType === 'story') {
      formats = extractStories(decoded, seenUrls);
    } else if (isVideo) {
      const videoId = extractVideoId(redirectedUrl || finalUrl);
      const targetBlock = findTargetBlock(decoded, videoId, 'video');
      
      const thumbMatch = targetBlock.match(/"(?:previewImage|thumbnailImage|poster_image|preferred_thumbnail)"[^}]*?"uri":"(https:[^"]+)"/);
      const thumbnail = thumbMatch && /scontent|fbcdn/.test(thumbMatch[1]) 
        ? thumbMatch[1].replace(/\\\//g, '/') 
        : null;
      
      formats = extractVideoUrls(targetBlock, seenUrls, thumbnail);
      
      if (formats.length === 0) {
        const postId = extractPostId(redirectedUrl || finalUrl);
        formats = extractImageUrls(html, decoded, seenUrls, postId);
      }
    } else if (isPost) {
      const isPostShare = /\/share\/p\//.test(inputUrl);
      const hasSubattachments = html.includes('all_subattachments') || decoded.includes('all_subattachments');
      
      const postId = extractPostId(redirectedUrl || finalUrl);
      
      if (isPostShare || hasSubattachments) {
        formats = extractImageUrls(html, decoded, seenUrls, postId);
        
        if (formats.length === 0) {
          const targetBlock = findTargetBlock(decoded, postId, 'video');
          formats = extractVideoUrls(targetBlock, seenUrls);
        }
      } else {
        const targetBlock = findTargetBlock(decoded, postId, 'video');
        const videoFormats = extractVideoUrls(targetBlock, seenUrls);
        
        if (videoFormats.length > 0) {
          formats = videoFormats;
        } else {
          formats = extractImageUrls(html, decoded, seenUrls, postId);
        }
      }
    }

    // No media found
    if (formats.length === 0) {
      if (actualType === 'story' || contentType === 'story') {
        const hasStoryOwner = decoded.includes('story_bucket_owner') || 
                             decoded.includes('bucket_owner');
        const hasEmptyNodes = decoded.includes('"nodes":[]');
        const noProgressiveUrl = !decoded.includes('progressive_url');
        
        if (hasStoryOwner && (hasEmptyNodes || noProgressiveUrl)) {
          return buildErrorResult(ErrorCode.STORY_EXPIRED, 'Story sudah expired atau dihapus');
        }
      }
      
      if (finalIssue === ErrorCode.AGE_RESTRICTED) {
        return buildErrorResult(ErrorCode.AGE_RESTRICTED, 'Age-restricted content');
      }
      if (finalIssue === ErrorCode.PRIVATE_CONTENT) {
        return buildErrorResult(ErrorCode.PRIVATE_CONTENT, 'This content is private or has been removed');
      }
      if (finalIssue === ErrorCode.STORY_EXPIRED) {
        return buildErrorResult(ErrorCode.STORY_EXPIRED, 'Story sudah expired atau dihapus');
      }
      return buildErrorResult(ErrorCode.NO_MEDIA_FOUND, 'No media found');
    }

    // Fetch file sizes
    const urls = formats.map(f => f.url);
    const sizes = await getFileSizes(urls, 3000);
    
    for (const format of formats) {
      const size = sizes.get(format.url);
      if (size) format.size = size;
    }

    const result = buildExtractResult({
      url: inputUrl,
      id: extractPostId(redirectedUrl || finalUrl) || extractVideoId(redirectedUrl || finalUrl),
      contentType: actualType,
      formats,
      metadata
    }) as ExtractResultWithCookieSource;
    
    // Track cookie usage
    result.usedCookie = cookieSource !== 'none';
    result.cookieSource = cookieSource;
    
    return result;
  }
}

export default FacebookExtractor;
