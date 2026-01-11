/**
 * Twitter/X Scanner - URL pattern detection and API fetching
 * 
 * Strategy:
 * 1. Syndication API (public, no cookie) - for public tweets
 * 2. GraphQL API (with cookie) - for protected/private content
 * 
 * Supports: twitter.com, x.com, t.co (short links)
 */

import { request } from 'undici';
import { logger } from '@/lib/utils/logger';
import { ErrorCode } from '@/lib/utils/error.utils';
import { resolveUrl } from '@/lib/core/network/client';

// ============================================================
// URL PATTERNS
// ============================================================

/**
 * Twitter URL patterns for detection
 */
export const URL_PATTERNS: RegExp[] = [
  /(?:www\.)?twitter\.com\/\w+\/status\/(\d+)/i,
  /(?:www\.)?x\.com\/\w+\/status\/(\d+)/i,
  /t\.co\/[\w-]+/i,
];

/**
 * Pattern to extract tweet ID and username from URL
 */
export const TWEET_ID_PATTERN = /(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i;

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Extracted tweet info from URL
 */
export interface TweetInfo {
  tweetId: string;
  username: string;
}

/**
 * Quoted tweet data from Syndication API (simplified version)
 */
export interface QuotedTweet {
  id_str: string;
  text?: string;
  full_text?: string;
  user: {
    id_str: string;
    name: string;
    screen_name: string;
    profile_image_url_https: string;
  };
  created_at: string;
  favorite_count: number;
  retweet_count: number;
  reply_count?: number;
  mediaDetails?: MediaDetail[];
  photos?: Photo[];
  video?: VideoInfo;
}

/**
 * Twitter Syndication API response
 */
export interface SyndicationResponse {
  __typename?: string;
  id_str: string;
  text: string;
  full_text?: string;
  user: {
    id_str: string;
    name: string;
    screen_name: string;
    profile_image_url_https: string;
  };
  created_at: string;
  favorite_count: number;
  retweet_count: number;
  reply_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  views_count?: string;
  mediaDetails?: MediaDetail[];
  photos?: Photo[];
  video?: VideoInfo;
  possibly_sensitive?: boolean;
  lang?: string;
  /** Retweet data - present if this tweet is a retweet */
  retweeted_status?: SyndicationResponse;
  /** Quote tweet data - present if this tweet quotes another tweet */
  quoted_tweet?: QuotedTweet;
}

/**
 * Media detail from Syndication API
 */
export interface MediaDetail {
  display_url: string;
  expanded_url: string;
  media_url_https: string;
  type: 'photo' | 'video' | 'animated_gif';
  video_info?: {
    aspect_ratio: number[];
    duration_millis?: number;
    variants: VideoVariant[];
  };
  original_info?: {
    width: number;
    height: number;
  };
}

/**
 * Photo from Syndication API
 */
export interface Photo {
  url: string;
  width: number;
  height: number;
  accessibilityLabel?: string;
}

/**
 * Video info from Syndication API
 */
export interface VideoInfo {
  aspectRatio: number[];
  contentType: string;
  durationMs?: number;
  mediaAvailability?: {
    status: string;
  };
  poster: string;
  variants: VideoVariant[];
  viewCount?: number;
}

/**
 * Video variant with quality info
 */
export interface VideoVariant {
  url: string;
  content_type: string;
  bitrate?: number;
}

/**
 * GraphQL API response structure
 */
export interface GraphQLResponse {
  data?: {
    tweetResult?: {
      result?: TweetResult;
    };
  };
  errors?: Array<{
    message: string;
    code?: number;
  }>;
}

/**
 * Tweet result from GraphQL
 */
export interface TweetResult {
  __typename: string;
  rest_id?: string;
  core?: {
    user_results?: {
      result?: {
        legacy?: {
          name: string;
          screen_name: string;
          profile_image_url_https: string;
        };
      };
    };
  };
  legacy?: TweetLegacy;
  views?: {
    count?: string;
  };
  tombstone?: {
    text?: {
      text: string;
    };
  };
}

/**
 * Tweet legacy data from GraphQL
 */
export interface TweetLegacy {
  id_str: string;
  full_text: string;
  created_at: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  bookmark_count: number;
  extended_entities?: {
    media: ExtendedMedia[];
  };
  entities?: {
    media?: ExtendedMedia[];
  };
  /** Retweet data - present if this tweet is a retweet */
  retweeted_status_result?: {
    result: TweetResult;
  };
  /** Quote tweet data - present if this tweet quotes another tweet */
  quoted_status_result?: {
    result: TweetResult;
  };
}

/**
 * Extended media from GraphQL
 */
export interface ExtendedMedia {
  id_str: string;
  media_url_https: string;
  type: 'photo' | 'video' | 'animated_gif';
  original_info?: {
    width: number;
    height: number;
  };
  video_info?: {
    aspect_ratio: number[];
    duration_millis?: number;
    variants: VideoVariant[];
  };
}

/**
 * Scanner result
 */
export interface ScanResult {
  success: boolean;
  data?: SyndicationResponse | GraphQLResponse;
  source?: 'syndication' | 'graphql';
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Twitter Syndication API endpoint
 */
const SYNDICATION_API = 'https://cdn.syndication.twimg.com/tweet-result';

/**
 * Twitter GraphQL API endpoint
 */
const GRAPHQL_API = 'https://twitter.com/i/api/graphql';

/**
 * GraphQL query ID for TweetResultByRestId
 */
const TWEET_RESULT_QUERY_ID = '0hWvDhmW8YQ-S_ib3azIrw';

/**
 * Default headers for Twitter requests
 */
const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * GraphQL features for tweet query
 */
const GRAPHQL_FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_home_pinned_timelines_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_media_download_video_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

// ============================================================
// SCANNER FUNCTIONS
// ============================================================

/**
 * Check if URL matches Twitter patterns
 */
export function matchUrl(url: string): boolean {
  return URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extract tweet ID and username from Twitter URL
 */
export function extractTweetInfo(url: string): TweetInfo | null {
  const match = url.match(TWEET_ID_PATTERN);
  if (match) {
    return {
      username: match[1],
      tweetId: match[2],
    };
  }
  return null;
}

/**
 * Resolve t.co short URL to full Twitter URL
 */
export async function resolveShortUrl(url: string, signal?: AbortSignal): Promise<string> {
  if (!url.includes('t.co')) {
    return url;
  }
  
  try {
    logger.debug('twitter-scanner', 'Resolving short URL', { url });
    const resolved = await resolveUrl(url, {
      headers: DEFAULT_HEADERS,
      timeout: 10000,
    });
    logger.debug('twitter-scanner', 'Resolved URL', { resolved });
    return resolved;
  } catch (error) {
    logger.warn('twitter-scanner', 'Failed to resolve short URL', { url, error });
    return url;
  }
}

/**
 * Detect Twitter API error codes
 */
export function detectSyndicationError(
  statusCode: number,
  body: string
): { code: string; message: string } | null {
  if (statusCode === 200) return null;
  
  if (statusCode === 404) {
    return { code: ErrorCode.DELETED_CONTENT, message: 'Tweet not found or has been deleted' };
  }
  
  if (statusCode === 403) {
    return { code: ErrorCode.PRIVATE_CONTENT, message: 'Tweet is from a protected account' };
  }
  
  if (statusCode === 429) {
    return { code: ErrorCode.RATE_LIMITED, message: 'Rate limit exceeded' };
  }
  
  // Check for tombstone (deleted/suspended)
  if (body.includes('TweetTombstone') || body.includes('tombstone')) {
    return { code: ErrorCode.DELETED_CONTENT, message: 'Tweet has been deleted or account suspended' };
  }
  
  return { code: ErrorCode.EXTRACTION_FAILED, message: `Twitter API returned status ${statusCode}` };
}

/**
 * Detect GraphQL API errors
 */
export function detectGraphQLError(response: GraphQLResponse): { code: string; message: string } | null {
  // Check for explicit errors
  if (response.errors && response.errors.length > 0) {
    const error = response.errors[0];
    if (error.message.includes('not found') || error.code === 34) {
      return { code: ErrorCode.DELETED_CONTENT, message: 'Tweet not found' };
    }
    return { code: ErrorCode.EXTRACTION_FAILED, message: error.message };
  }
  
  // Check for tombstone
  const result = response.data?.tweetResult?.result;
  if (result?.__typename === 'TweetTombstone') {
    const tombstoneText = result.tombstone?.text?.text || 'Tweet unavailable';
    if (tombstoneText.includes('suspended') || tombstoneText.includes('violated')) {
      return { code: ErrorCode.DELETED_CONTENT, message: 'Account suspended or tweet removed' };
    }
    if (tombstoneText.includes('protected')) {
      return { code: ErrorCode.PRIVATE_CONTENT, message: 'Tweet is from a protected account' };
    }
    return { code: ErrorCode.DELETED_CONTENT, message: tombstoneText };
  }
  
  // Check for unavailable tweet
  if (result?.__typename === 'TweetUnavailable') {
    return { code: ErrorCode.DELETED_CONTENT, message: 'Tweet is unavailable' };
  }
  
  return null;
}

/**
 * Extract ct0 CSRF token from cookie string
 */
export function extractCt0(cookie: string): string | null {
  const match = cookie.match(/ct0=([^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Fetch tweet using Syndication API (public, no cookie required)
 * 
 * @param tweetId - Tweet ID to fetch
 * @param signal - Optional abort signal
 * @returns Scan result with tweet data or error
 */
export async function fetchSyndication(
  tweetId: string,
  signal?: AbortSignal
): Promise<ScanResult> {
  const url = `${SYNDICATION_API}?id=${tweetId}&token=0`;
  
  try {
    logger.debug('twitter-scanner', 'Fetching from Syndication API', { tweetId });
    
    const response = await request(url, {
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        'Accept': '*/*',
      },
      headersTimeout: 15000,
      bodyTimeout: 15000,
      signal,
    });
    
    const { statusCode, body } = response;
    const text = await body.text();
    
    // Check for errors
    const error = detectSyndicationError(statusCode, text);
    if (error) {
      logger.warn('twitter-scanner', 'Syndication API error', error);
      return { success: false, error };
    }
    
    // Parse response
    let json: SyndicationResponse;
    try {
      json = JSON.parse(text);
    } catch {
      logger.error('twitter-scanner', 'Failed to parse Syndication response');
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: 'Invalid response from Twitter Syndication API',
        },
      };
    }
    
    // Check for tombstone in response
    if (json.__typename === 'TweetTombstone') {
      return {
        success: false,
        error: {
          code: ErrorCode.DELETED_CONTENT,
          message: 'Tweet has been deleted or is unavailable',
        },
      };
    }
    
    logger.debug('twitter-scanner', 'Syndication fetch successful', {
      tweetId: json.id_str,
      hasMedia: !!(json.mediaDetails?.length || json.photos?.length || json.video),
    });
    
    return { success: true, data: json, source: 'syndication' };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('abort') || message.includes('AbortError')) {
      return {
        success: false,
        error: { code: ErrorCode.TIMEOUT, message: 'Request was aborted' },
      };
    }
    
    logger.error('twitter-scanner', 'Syndication fetch failed', error as Error);
    return {
      success: false,
      error: {
        code: ErrorCode.EXTRACTION_FAILED,
        message: `Failed to fetch from Syndication API: ${message}`,
      },
    };
  }
}

/**
 * Fetch tweet using GraphQL API (requires cookie)
 * 
 * @param tweetId - Tweet ID to fetch
 * @param cookie - Twitter cookie string
 * @param signal - Optional abort signal
 * @returns Scan result with tweet data or error
 */
export async function fetchGraphQL(
  tweetId: string,
  cookie: string,
  signal?: AbortSignal
): Promise<ScanResult> {
  // Extract ct0 token for CSRF
  const ct0 = extractCt0(cookie);
  if (!ct0) {
    return {
      success: false,
      error: {
        code: ErrorCode.LOGIN_REQUIRED,
        message: 'Invalid cookie: missing ct0 token',
      },
    };
  }
  
  // Build GraphQL query
  const variables = JSON.stringify({
    tweetId,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
  });
  
  const features = JSON.stringify(GRAPHQL_FEATURES);
  
  const url = `${GRAPHQL_API}/${TWEET_RESULT_QUERY_ID}/TweetResultByRestId?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;
  
  try {
    logger.debug('twitter-scanner', 'Fetching from GraphQL API', { tweetId });
    
    const response = await request(url, {
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        'Cookie': cookie,
        'X-Csrf-Token': ct0,
        'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'X-Twitter-Auth-Type': 'OAuth2Session',
        'X-Twitter-Active-User': 'yes',
        'X-Twitter-Client-Language': 'en',
      },
      headersTimeout: 15000,
      bodyTimeout: 15000,
      signal,
    });
    
    const { statusCode, body } = response;
    const text = await body.text();
    
    if (statusCode === 401 || statusCode === 403) {
      return {
        success: false,
        error: {
          code: ErrorCode.LOGIN_REQUIRED,
          message: 'Cookie expired or invalid',
        },
      };
    }
    
    if (statusCode === 429) {
      return {
        success: false,
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: 'Rate limit exceeded',
        },
      };
    }
    
    if (statusCode !== 200) {
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: `GraphQL API returned status ${statusCode}`,
        },
      };
    }
    
    // Parse response
    let json: GraphQLResponse;
    try {
      json = JSON.parse(text);
    } catch {
      logger.error('twitter-scanner', 'Failed to parse GraphQL response');
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: 'Invalid response from Twitter GraphQL API',
        },
      };
    }
    
    // Check for GraphQL errors
    const error = detectGraphQLError(json);
    if (error) {
      logger.warn('twitter-scanner', 'GraphQL API error', error);
      return { success: false, error };
    }
    
    // Verify we have tweet data
    if (!json.data?.tweetResult?.result) {
      return {
        success: false,
        error: {
          code: ErrorCode.NO_MEDIA_FOUND,
          message: 'No tweet data in GraphQL response',
        },
      };
    }
    
    logger.debug('twitter-scanner', 'GraphQL fetch successful', {
      tweetId,
      typename: json.data.tweetResult.result.__typename,
    });
    
    return { success: true, data: json, source: 'graphql' };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('abort') || message.includes('AbortError')) {
      return {
        success: false,
        error: { code: ErrorCode.TIMEOUT, message: 'Request was aborted' },
      };
    }
    
    logger.error('twitter-scanner', 'GraphQL fetch failed', error as Error);
    return {
      success: false,
      error: {
        code: ErrorCode.EXTRACTION_FAILED,
        message: `Failed to fetch from GraphQL API: ${message}`,
      },
    };
  }
}
