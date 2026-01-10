/**
 * Facebook Extractor - Main entry point
 * 
 * Cookie Strategy:
 * - Stories: always use cookies (required for auth)
 * - Other content: guest first, retry with cookies on PRIVATE_CONTENT error
 */

import { BaseExtractor } from '../base.extractor.js';
import { fetchStream, getFacebookHeaders, getFacebookCookies, hasValidAuthCookies } from '../../core/network/index.js';
import { extractMetaTags, decodeHtmlEntities } from '../../core/parser/index.js';
import { normalizeUrl, isKnownPattern } from '../../utils/url.utils.js';
import { ErrorCode } from '../../utils/error.utils.js';
import { logger } from '../../utils/logger.js';

import { KNOWN_PATTERNS, detectContentType, detectContentIssues, findTargetBlock, scanStream } from './scanner.js';
import { 
  extractVideoUrls, 
  extractImageUrls, 
  extractStories, 
  extractMetadata,
  extractVideoId,
  extractPostId,
  buildExtractResult,
  buildErrorResult
} from './extract.js';

export class FacebookExtractor extends BaseExtractor {
  static platform = 'facebook';
  
  static patterns = [
    /(?:www\.|m\.|web\.|mobile\.)?facebook\.com/i,
    /fb\.watch/i,
    /fb\.me/i
  ];

  async extract(inputUrl, options = {}) {
    const startTime = Date.now();
    const { signal, timeout } = options;

    try {
      const normalizedUrl = normalizeUrl(inputUrl);

      // Resolve URL if needed
      let finalUrl = normalizedUrl;
      const needsResolve = !isKnownPattern(normalizedUrl, KNOWN_PATTERNS);
      
      if (needsResolve) {
        const { resolveUrl } = await import('../../core/network/client.js');
        const headers = getFacebookHeaders('ipad');
        
        try {
          const resolved = await resolveUrl(normalizedUrl, { headers, timeout, maxRedirects: 10 });
          if (resolved) {
            logger.resolve('facebook', normalizedUrl, resolved);
            finalUrl = resolved;
          }
        } catch (error) {
          logger.warn('facebook', 'URL resolution failed', { error: error.message });
        }
      }

      const contentType = detectContentType(finalUrl);
      logger.type('facebook', contentType);

      // Determine if we need cookies from the start
      // Only Stories require cookies first (auth required)
      const isStory = contentType === 'story' || /\/stories\//.test(finalUrl);
      const useCookiesFirst = isStory;

      // First attempt
      let result = await this._extractWithAuth(finalUrl, contentType, {
        signal,
        timeout,
        useCookies: useCookiesFirst,
        inputUrl
      });

      // Retry with cookies if:
      // 1. Private content error and we didn't use cookies first
      // 2. No media found for video/reel content (might need auth)
      const shouldRetryWithCookies = !result.success && 
        !useCookiesFirst && 
        (result.error?.code === ErrorCode.PRIVATE_CONTENT ||
         (result.error?.code === ErrorCode.NO_MEDIA_FOUND && 
          (contentType === 'reel' || contentType === 'video')));

      if (shouldRetryWithCookies) {
        logger.info('facebook', 'Retrying with cookies...');
        result = await this._extractWithAuth(finalUrl, contentType, {
          signal,
          timeout,
          useCookies: true,
          inputUrl
        });
      }

      logger.complete('facebook', Date.now() - startTime);
      return result;

    } catch (error) {
      logger.error('facebook', 'Extraction failed', error);
      
      if (error.code === ErrorCode.TIMEOUT) {
        return buildErrorResult(ErrorCode.TIMEOUT, 'Request timeout');
      }
      if (error.code === ErrorCode.RATE_LIMITED) {
        return buildErrorResult(ErrorCode.RATE_LIMITED, 'Rate limited');
      }
      
      return buildErrorResult(ErrorCode.EXTRACTION_FAILED, error.message || 'Extraction failed');
    }
  }

  /**
   * Internal extraction with optional cookie auth
   */
  async _extractWithAuth(finalUrl, contentType, options = {}) {
    const { signal, timeout, useCookies, inputUrl } = options;

    // Build headers
    const headers = getFacebookHeaders('ipad');
    
    if (useCookies) {
      const cookies = await getFacebookCookies();
      if (hasValidAuthCookies(cookies)) {
        headers['Cookie'] = cookies;
      } else {
        logger.warn('facebook', 'No valid cookies found');
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

    const finalIssue = detectContentIssues(html, contentType);
    if (finalIssue) {
      return buildErrorResult(finalIssue, `Content issue: ${finalIssue}`);
    }

    // Extract content
    const decoded = decodeHtmlEntities(html);
    const meta = extractMetaTags(html);
    const metadata = extractMetadata(decoded, finalUrl);
    metadata.title = meta.title || metadata.author;

    const seenUrls = new Set();
    let formats = [];

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
      // Check for story expired (has owner but no media)
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
    const { getFileSizes } = await import('../../core/network/client.js');
    const urls = formats.map(f => f.url);
    const sizes = await getFileSizes(urls, 3000);
    
    for (const format of formats) {
      const size = sizes.get(format.url);
      if (size) format.size = size;
    }

    return buildExtractResult({
      url: inputUrl,
      id: extractPostId(redirectedUrl || finalUrl) || extractVideoId(redirectedUrl || finalUrl),
      contentType: actualType,
      formats,
      metadata
    });
  }
}

export default FacebookExtractor;
