/**
 * TikTok Scanner - URL pattern detection and TikWM API fetching
 * 
 * Strategy: Uses TikWM third-party API (no cookie required)
 * Supports: tiktok.com, vm.tiktok.com, vt.tiktok.com
 */

import { request } from 'undici';
import { logger } from '@/lib/utils/logger';
import { ErrorCode } from '@/lib/utils/error.utils';

// ============================================================
// URL PATTERNS
// ============================================================

/**
 * TikTok URL patterns for detection
 */
export const URL_PATTERNS: RegExp[] = [
  /(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
  /(?:www\.)?tiktok\.com\/t\/([\w-]+)/i,
  /vm\.tiktok\.com\/([\w-]+)/i,
  /vt\.tiktok\.com\/([\w-]+)/i,
];

/**
 * Pattern to extract video ID from full TikTok URL
 */
export const VIDEO_ID_PATTERN = /\/video\/(\d+)/i;

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * TikWM API response structure
 */
export interface TikWMResponse {
  code: number;
  msg: string;
  processed_time: number;
  data: TikWMData | null;
}

/**
 * TikWM data payload
 */
export interface TikWMData {
  id: string;
  region: string;
  title: string;
  cover: string;
  ai_dynamic_cover: string;
  origin_cover: string;
  duration: number;
  play: string;      // SD video URL (watermarked)
  wmplay: string;    // Watermarked video URL
  hdplay: string;    // HD video URL (no watermark)
  size: number;      // SD file size
  wm_size: number;   // Watermarked file size
  hd_size: number;   // HD file size
  music: string;     // Music URL
  music_info: TikWMMusicInfo;
  play_count: number;
  digg_count: number;
  comment_count: number;
  share_count: number;
  download_count: number;
  collect_count: number;
  create_time: number;
  anchors: unknown;
  anchors_extras: string;
  is_ad: boolean;
  commerce_info: unknown;
  commercial_video_info: string;
  item_comment_settings: number;
  author: TikWMAuthor;
  images?: string[];  // Slideshow images (if present)
}

/**
 * TikWM author information
 */
export interface TikWMAuthor {
  id: string;
  unique_id: string;
  nickname: string;
  avatar: string;
}

/**
 * TikWM music information
 */
export interface TikWMMusicInfo {
  id: string;
  title: string;
  play: string;
  cover: string;
  author: string;
  original: boolean;
  duration: number;
  album: string;
}

/**
 * Scanner result
 */
export interface ScanResult {
  success: boolean;
  data?: TikWMData;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// SCANNER FUNCTIONS
// ============================================================

/**
 * Check if URL matches TikTok patterns
 */
export function matchUrl(url: string): boolean {
  return URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extract video ID from TikTok URL (if present)
 */
export function extractVideoId(url: string): string | null {
  const match = url.match(VIDEO_ID_PATTERN);
  return match ? match[1] : null;
}

/**
 * Detect TikWM API error codes
 */
export function detectError(code: number, msg: string): { code: string; message: string } | null {
  if (code === 0) return null; // Success
  
  if (code === -1 || msg.toLowerCase().includes('not found')) {
    return { code: ErrorCode.DELETED_CONTENT, message: 'Video not found or has been deleted' };
  }
  
  if (code === 10000 || msg.toLowerCase().includes('rate limit')) {
    return { code: ErrorCode.RATE_LIMITED, message: 'API rate limit exceeded' };
  }
  
  if (msg.toLowerCase().includes('private')) {
    return { code: ErrorCode.PRIVATE_CONTENT, message: 'This video is private' };
  }
  
  return { code: ErrorCode.EXTRACTION_FAILED, message: msg || 'Unknown TikWM error' };
}

/**
 * Fetch TikTok data using TikWM API
 * 
 * @param url - TikTok video URL
 * @param signal - Optional abort signal
 * @returns Scan result with video data or error
 */
export async function fetchTikWM(
  url: string,
  signal?: AbortSignal
): Promise<ScanResult> {
  const TIKWM_API = 'https://www.tikwm.com/api/';
  
  try {
    logger.debug('tiktok-scanner', 'Fetching from TikWM', { url });
    
    const response = await request(TIKWM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: `url=${encodeURIComponent(url)}&hd=1`,
      headersTimeout: 15000,
      bodyTimeout: 15000,
      signal,
    });
    
    const { statusCode, body } = response;
    
    if (statusCode !== 200) {
      logger.warn('tiktok-scanner', `TikWM returned status ${statusCode}`);
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: `TikWM API returned status ${statusCode}`,
        },
      };
    }
    
    const text = await body.text();
    let json: TikWMResponse;
    
    try {
      json = JSON.parse(text);
    } catch {
      logger.error('tiktok-scanner', 'Failed to parse TikWM response');
      return {
        success: false,
        error: {
          code: ErrorCode.EXTRACTION_FAILED,
          message: 'Invalid response from TikWM API',
        },
      };
    }
    
    // Check for API errors
    const apiError = detectError(json.code, json.msg);
    if (apiError) {
      logger.warn('tiktok-scanner', 'TikWM API error', apiError);
      return { success: false, error: apiError };
    }
    
    if (!json.data) {
      return {
        success: false,
        error: {
          code: ErrorCode.NO_MEDIA_FOUND,
          message: 'No video data in response',
        },
      };
    }
    
    logger.debug('tiktok-scanner', 'TikWM fetch successful', { 
      id: json.data.id,
      hasHD: !!json.data.hdplay,
      hasImages: !!json.data.images?.length,
    });
    
    return { success: true, data: json.data };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('abort') || message.includes('AbortError')) {
      return {
        success: false,
        error: { code: ErrorCode.TIMEOUT, message: 'Request was aborted' },
      };
    }
    
    logger.error('tiktok-scanner', 'TikWM fetch failed', error as Error);
    return {
      success: false,
      error: {
        code: ErrorCode.EXTRACTION_FAILED,
        message: `Failed to fetch from TikWM: ${message}`,
      },
    };
  }
}
