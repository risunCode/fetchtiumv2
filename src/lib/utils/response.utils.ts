/**
 * Response Builder - Standardize API response format
 * 
 * Handles:
 * - Stats/Engagement (views, likes, comments, shares) - for all platforms
 * - Meta (responseTime, accessMode, publicContent)
 * 
 * TypeScript conversion of response.utils.js
 */

import type { EngagementStats, ResponseMeta, ExtractResult, ExtractError } from '@/types';

/**
 * Raw stats from extractor (may have platform-specific fields)
 */
export interface RawStats {
  views?: number | string;
  likes?: number | string;
  comments?: number | string;
  shares?: number | string;
  reposts?: number | string;
  quotes?: number | string;
  bookmarks?: number | string;
  retweets?: number | string;
  replies?: number | string;
  [key: string]: number | string | undefined;
}

/**
 * Options for building meta object
 */
export interface MetaOptions {
  responseTime?: number;
  accessMode?: string;
  usedCookie?: boolean;
}

/**
 * Raw extraction result from extractor
 */
export interface RawExtractResult {
  success: boolean;
  platform?: string;
  contentType?: string;
  title?: string;
  author?: string;
  id?: string;
  description?: string;
  uploadDate?: string;
  duration?: number;
  stats?: RawStats;
  engagement?: RawStats;
  items?: Array<{
    index: number;
    type: 'video' | 'image' | 'audio';
    thumbnail?: string;
    sources: Array<{
      quality: string;
      url: string;
      resolution?: string;
      mime?: string;
      size?: number;
      filename?: string;
    }>;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Standard engagement/stats fields
 * Supported by: YouTube, Facebook, Instagram, Twitter/X
 */
const ENGAGEMENT_FIELDS = ['views', 'likes', 'comments', 'shares', 'reposts', 'quotes', 'bookmarks'] as const;

/**
 * Normalize engagement stats from raw extractor output
 * @param rawStats - Raw stats from extractor
 * @returns Normalized stats or null
 */
export function normalizeStats(rawStats: RawStats | undefined | null): EngagementStats | null {
  if (!rawStats || typeof rawStats !== 'object') return null;
  
  const stats: EngagementStats = {};
  
  for (const field of ENGAGEMENT_FIELDS) {
    const rawValue = rawStats[field];
    if (rawValue !== undefined && rawValue !== null) {
      // Ensure it's a number
      const value = typeof rawValue === 'number' 
        ? rawValue 
        : parseInt(String(rawValue), 10);
      
      if (!isNaN(value) && value >= 0) {
        (stats as Record<string, number>)[field] = value;
      }
    }
  }
  
  // Platform-specific mappings
  // Twitter: retweets -> shares
  if (rawStats.retweets && !stats.shares) {
    const value = typeof rawStats.retweets === 'number'
      ? rawStats.retweets
      : parseInt(String(rawStats.retweets), 10);
    if (!isNaN(value)) stats.shares = value;
  }
  // Twitter: replies -> comments
  if (rawStats.replies && !stats.comments) {
    const value = typeof rawStats.replies === 'number'
      ? rawStats.replies
      : parseInt(String(rawStats.replies), 10);
    if (!isNaN(value)) stats.comments = value;
  }
  
  return Object.keys(stats).length > 0 ? stats : null;
}

/**
 * Build meta object for response
 * @param options - Meta options
 * @returns Meta object
 */
export function buildMeta(options: MetaOptions = {}): ResponseMeta {
  const { responseTime, accessMode, usedCookie } = options;
  
  return {
    responseTime: responseTime || 0,
    accessMode: accessMode || 'public',
    publicContent: !usedCookie
  };
}

/**
 * Build standardized API response
 * @param extractResult - Raw result from extractor
 * @param options - Additional options
 * @returns Standardized response
 */
export function buildResponse(
  extractResult: RawExtractResult | null | undefined,
  options: MetaOptions = {}
): ExtractResult | ExtractError {
  if (!extractResult) {
    return {
      success: false,
      error: { code: 'EXTRACTION_FAILED', message: 'No result' },
      meta: buildMeta(options)
    };
  }
  
  // If error response, just add meta
  if (!extractResult.success) {
    return {
      success: false,
      error: extractResult.error || { code: 'EXTRACTION_FAILED', message: 'Unknown error' },
      meta: buildMeta(options)
    };
  }
  
  // Build successful response
  const response: ExtractResult = {
    success: true,
    platform: extractResult.platform || 'unknown',
    contentType: extractResult.contentType || 'unknown',
    items: extractResult.items || [],
    meta: buildMeta(options)
  };
  
  // Basic info
  if (extractResult.title) response.title = extractResult.title;
  if (extractResult.author) response.author = extractResult.author;
  if (extractResult.id) response.id = extractResult.id;
  if (extractResult.description) response.description = extractResult.description;
  if (extractResult.uploadDate) response.uploadDate = extractResult.uploadDate;
  
  // Normalize stats/engagement
  const stats = normalizeStats(extractResult.stats || extractResult.engagement);
  if (stats) response.stats = stats;
  
  return response;
}

/**
 * Build error response
 * @param code - Error code
 * @param message - Error message
 * @param options - Meta options
 * @returns Error response
 */
export function buildErrorResponse(
  code: string,
  message: string,
  options: MetaOptions = {}
): ExtractError {
  return {
    success: false,
    error: { code, message },
    meta: buildMeta(options)
  };
}
