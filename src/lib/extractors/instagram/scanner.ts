/**
 * Instagram Scanner - URL pattern detection and API fetching
 * 
 * Strategy:
 * 1. GraphQL API (public, no cookie) - for public posts
 * 2. Internal API /api/v1/media/{id}/info/ (with cookie) - for private/protected content
 * 
 * Supports: instagram.com, instagr.am
 * Paths: /p/, /reel/, /tv/, /stories/
 */

import { request } from 'undici';
import { logger } from '@/lib/utils/logger';
import { ErrorCode } from '@/lib/utils/error.utils';

// ============================================================
// URL PATTERNS
// ============================================================

/**
 * Instagram URL patterns for detection
 */
export const URL_PATTERNS: RegExp[] = [
  /(?:www\.)?instagram\.com\/p\/([\w-]+)/i,
  /(?:www\.)?instagram\.com\/reel\/([\w-]+)/i,
  /(?:www\.)?instagram\.com\/tv\/([\w-]+)/i,
  /(?:www\.)?instagram\.com\/stories\/[\w.-]+\/([\d]+)/i,
  /instagr\.am\/p\/([\w-]+)/i,
];

/**
 * Pattern to extract shortcode from Instagram URL
 */
export const SHORTCODE_PATTERN = /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([\w-]+)/i;

/**
 * Pattern to extract story ID
 */
export const STORY_PATTERN = /instagram\.com\/stories\/[\w.-]+\/(\d+)/i;

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * GraphQL API response structure
 */
export interface GraphQLResponse {
  data?: {
    xdt_shortcode_media?: ShortcodeMedia;
  };
  status?: string;
  message?: string;
}

/**
 * Shortcode media from GraphQL
 */
export interface ShortcodeMedia {
  id: string;
  shortcode: string;
  __typename: 'GraphImage' | 'GraphVideo' | 'GraphSidecar';
  display_url: string;
  display_resources?: DisplayResource[];
  video_url?: string;
  is_video: boolean;
  video_view_count?: number;
  video_duration?: number;
  edge_sidecar_to_children?: {
    edges: SidecarEdge[];
  };
  edge_media_to_caption?: {
    edges: CaptionEdge[];
  };
  owner: {
    id: string;
    username: string;
    full_name?: string;
    profile_pic_url?: string;
  };
  taken_at_timestamp?: number;
  edge_media_preview_like?: {
    count: number;
  };
  edge_media_to_comment?: {
    count: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Display resource with different sizes
 */
export interface DisplayResource {
  src: string;
  config_width: number;
  config_height: number;
}

/**
 * Sidecar (carousel) edge
 */
export interface SidecarEdge {
  node: {
    id: string;
    __typename: 'GraphImage' | 'GraphVideo';
    display_url: string;
    display_resources?: DisplayResource[];
    video_url?: string;
    is_video: boolean;
    dimensions?: {
      width: number;
      height: number;
    };
  };
}

/**
 * Caption edge
 */
export interface CaptionEdge {
  node: {
    text: string;
  };
}

/**
 * Internal API response structure
 */
export interface InternalAPIResponse {
  items?: APIMediaItem[];
  num_results?: number;
  status: string;
  message?: string;
}

/**
 * API media item
 */
export interface APIMediaItem {
  id: string;
  pk: string;
  code: string;
  media_type: 1 | 2 | 8; // 1=image, 2=video, 8=carousel
  taken_at: number;
  video_versions?: VideoVersion[];
  image_versions2?: {
    candidates: ImageCandidate[];
  };
  carousel_media?: CarouselItem[];
  carousel_media_count?: number;
  user: {
    pk: string;
    username: string;
    full_name: string;
    profile_pic_url?: string;
  };
  caption?: {
    text: string;
  };
  like_count?: number;
  comment_count?: number;
  play_count?: number;
  view_count?: number;
  video_duration?: number;
  original_width?: number;
  original_height?: number;
}

/**
 * Video version from API
 */
export interface VideoVersion {
  type: number;
  width: number;
  height: number;
  url: string;
  id: string;
}

/**
 * Image candidate from API
 */
export interface ImageCandidate {
  width: number;
  height: number;
  url: string;
}

/**
 * Carousel item from API
 */
export interface CarouselItem {
  id: string;
  pk: string;
  media_type: 1 | 2;
  video_versions?: VideoVersion[];
  image_versions2?: {
    candidates: ImageCandidate[];
  };
  original_width?: number;
  original_height?: number;
  video_duration?: number;
}

/**
 * Scanner result
 */
export interface ScanResult {
  success: boolean;
  data?: GraphQLResponse | InternalAPIResponse;
  source?: 'graphql' | 'api';
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Instagram GraphQL API endpoint
 */
const GRAPHQL_API = 'https://www.instagram.com/graphql/query';

/**
 * Instagram Internal API base
 */
const INTERNAL_API = 'https://i.instagram.com/api/v1';

/**
 * GraphQL document ID for media query
 */
const GRAPHQL_DOC_ID = '8845758582119845';

/**
 * Default headers for Instagram requests
 */
const DEFAULT_HEADERS = {
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'X-IG-App-ID': '936619743392459',
  'X-ASBD-ID': '129477',
  'X-IG-WWW-Claim': '0',
};

/**
 * Mobile User-Agent for Internal API
 */
const MOBILE_USER_AGENT = 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229237)';

// ============================================================
// SHORTCODE CONVERSION
// ============================================================

/**
 * Base64 alphabet used by Instagram for shortcodes
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Convert Instagram shortcode to media ID
 * Instagram uses a modified base64 encoding for shortcodes
 * 
 * @param shortcode - Instagram shortcode (e.g., 'CxYz123')
 * @returns Media ID as string (numeric)
 */
export function shortcodeToMediaId(shortcode: string): string {
  let mediaId = BigInt(0);
  
  for (const char of shortcode) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid character in shortcode: ${char}`);
    }
    mediaId = mediaId * BigInt(64) + BigInt(index);
  }
  
  return mediaId.toString();
}

/**
 * Convert media ID back to shortcode
 * Used for verification/testing
 * 
 * @param mediaId - Media ID as string (numeric)
 * @returns Instagram shortcode
 */
export function mediaIdToShortcode(mediaId: string): string {
  let id = BigInt(mediaId);
  let shortcode = '';
  
  while (id > 0) {
    const remainder = Number(id % BigInt(64));
    shortcode = ALPHABET[remainder] + shortcode;
    id = id / BigInt(64);
  }
  
  return shortcode || ALPHABET[0];
}

// ============================================================
// SCANNER FUNCTIONS
// ============================================================

/**
 * Check if URL matches Instagram patterns
 */
export function matchUrl(url: string): boolean {
  return URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extract shortcode from Instagram URL
 */
export function extractShortcode(url: string): string | null {
  const match = url.match(SHORTCODE_PATTERN);
  return match ? match[1] : null;
}

/**
 * Extract story ID from Instagram URL
 */
export function extractStoryId(url: string): string | null {
  const match = url.match(STORY_PATTERN);
  return match ? match[1] : null;
}

/**
 * Extract CSRF token from cookie string
 */
export function extractCsrfToken(cookie: string): string | null {
  const match = cookie.match(/csrftoken=([^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Extract session ID from cookie string
 */
export function extractSessionId(cookie: string): string | null {
  const match = cookie.match(/sessionid=([^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Detect Instagram API error codes
 */
export function detectGraphQLError(
  response: GraphQLResponse
): { code: string; message: string } | null {
  if (response.status === 'fail') {
    const msg = response.message || 'Unknown error';
    
    if (msg.includes('login') || msg.includes('logged in')) {
      return { code: ErrorCode.LOGIN_REQUIRED, message: 'Login required to view this content' };
    }
    
    if (msg.includes('not found') || msg.includes('does not exist')) {
      return { code: ErrorCode.DELETED_CONTENT, message: 'Post not found or has been deleted' };
    }
    
    if (msg.includes('private')) {
      return { code: ErrorCode.PRIVATE_CONTENT, message: 'This account is private' };
    }
    
    return { code: ErrorCode.EXTRACTION_FAILED, message: msg };
  }
  
  return null;
}

/**
 * Detect Internal API error codes
 */
export function detectAPIError(
  statusCode: number,
  response: InternalAPIResponse
): { code: string; message: string } | null {
  if (statusCode === 200 && response.status === 'ok') {
    return null;
  }
  
  if (statusCode === 401 || statusCode === 403) {
    return { code: ErrorCode.LOGIN_REQUIRED, message: 'Cookie expired or invalid' };
  }
  
  if (statusCode === 404) {
    return { code: ErrorCode.DELETED_CONTENT, message: 'Post not found' };
  }
  
  if (statusCode === 429) {
    return { code: ErrorCode.RATE_LIMITED, message: 'Rate limit exceeded' };
  }
  
  const msg = response.message || 'Unknown error';
  
  if (msg.includes('login') || msg.includes('logged')) {
    return { code: ErrorCode.LOGIN_REQUIRED, message: 'Login required' };
  }
  
  if (msg.includes('not found')) {
    return { code: ErrorCode.DELETED_CONTENT, message: 'Post not found' };
  }
  
  return { code: ErrorCode.EXTRACTION_FAILED, message: msg };
}


/**
 * Fetch post using GraphQL API (public, no cookie required for public posts)
 * 
 * @param shortcode - Instagram shortcode
 * @param signal - Optional abort signal
 * @returns Scan result with post data or error
 */
export async function fetchGraphQL(
  shortcode: string,
  signal?: AbortSignal
): Promise<ScanResult> {
  const variables = JSON.stringify({
    shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null,
  });
  
  const url = `${GRAPHQL_API}/?doc_id=${GRAPHQL_DOC_ID}&variables=${encodeURIComponent(variables)}`;
  
  try {
    logger.debug('instagram-scanner', 'Fetching from GraphQL API', { shortcode });
    
    const response = await request(url, {
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
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
          message: 'Login required to view this content',
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
      logger.error('instagram-scanner', 'Failed to parse GraphQL response');
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: 'Invalid response from Instagram GraphQL API',
        },
      };
    }
    
    // Check for GraphQL errors
    const error = detectGraphQLError(json);
    if (error) {
      logger.warn('instagram-scanner', 'GraphQL API error', error);
      return { success: false, error };
    }
    
    // Verify we have media data
    if (!json.data?.xdt_shortcode_media) {
      return {
        success: false,
        error: {
          code: ErrorCode.NO_MEDIA_FOUND,
          message: 'No media data in GraphQL response',
        },
      };
    }
    
    logger.debug('instagram-scanner', 'GraphQL fetch successful', {
      shortcode,
      typename: json.data.xdt_shortcode_media.__typename,
      isVideo: json.data.xdt_shortcode_media.is_video,
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
    
    logger.error('instagram-scanner', 'GraphQL fetch failed', error as Error);
    return {
      success: false,
      error: {
        code: ErrorCode.EXTRACTION_FAILED,
        message: `Failed to fetch from GraphQL API: ${message}`,
      },
    };
  }
}

/**
 * Fetch post using Internal API (requires cookie)
 * 
 * @param mediaId - Instagram media ID (numeric)
 * @param cookie - Instagram cookie string
 * @param signal - Optional abort signal
 * @returns Scan result with post data or error
 */
export async function fetchInternalAPI(
  mediaId: string,
  cookie: string,
  signal?: AbortSignal
): Promise<ScanResult> {
  // Extract CSRF token
  const csrfToken = extractCsrfToken(cookie);
  if (!csrfToken) {
    return {
      success: false,
      error: {
        code: ErrorCode.LOGIN_REQUIRED,
        message: 'Invalid cookie: missing csrftoken',
      },
    };
  }
  
  const url = `${INTERNAL_API}/media/${mediaId}/info/`;
  
  try {
    logger.debug('instagram-scanner', 'Fetching from Internal API', { mediaId });
    
    const response = await request(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': MOBILE_USER_AGENT,
        'X-IG-App-ID': '936619743392459',
        'X-ASBD-ID': '129477',
        'X-CSRFToken': csrfToken,
        'X-IG-WWW-Claim': 'hmac.AR3W0DThY2Mu5Fag4sW5u3RhaR3qhFD_5wvYbOJOD9qaPjIf',
        'Cookie': cookie,
      },
      headersTimeout: 15000,
      bodyTimeout: 15000,
      signal,
    });
    
    const { statusCode, body } = response;
    const text = await body.text();
    
    // Parse response
    let json: InternalAPIResponse;
    try {
      json = JSON.parse(text);
    } catch {
      logger.error('instagram-scanner', 'Failed to parse Internal API response');
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: 'Invalid response from Instagram Internal API',
        },
      };
    }
    
    // Check for API errors
    const error = detectAPIError(statusCode, json);
    if (error) {
      logger.warn('instagram-scanner', 'Internal API error', error);
      return { success: false, error };
    }
    
    // Verify we have items
    if (!json.items || json.items.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCode.NO_MEDIA_FOUND,
          message: 'No media items in API response',
        },
      };
    }
    
    logger.debug('instagram-scanner', 'Internal API fetch successful', {
      mediaId,
      itemCount: json.items.length,
      mediaType: json.items[0].media_type,
    });
    
    return { success: true, data: json, source: 'api' };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('abort') || message.includes('AbortError')) {
      return {
        success: false,
        error: { code: ErrorCode.TIMEOUT, message: 'Request was aborted' },
      };
    }
    
    logger.error('instagram-scanner', 'Internal API fetch failed', error as Error);
    return {
      success: false,
      error: {
        code: ErrorCode.EXTRACTION_FAILED,
        message: `Failed to fetch from Internal API: ${message}`,
      },
    };
  }
}
