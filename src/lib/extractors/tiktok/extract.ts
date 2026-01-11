/**
 * TikTok Extract - Parse TikWM response and build extraction result
 * 
 * Handles both video and slideshow (images) content types
 */

import type { TikWMData } from './scanner';
import type { MediaItem, MediaSource, EngagementStats } from '@/types/extract';
import type { InternalExtractResult } from '../base.extractor';
import { logger } from '@/lib/utils/logger';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Parsed TikTok result before building final response
 */
export interface ParsedTikTokResult {
  id: string;
  title: string;
  author: {
    username: string;
    nickname: string;
    avatar: string;
  };
  thumbnail: string;
  duration: number;
  contentType: 'video' | 'slideshow';
  items: MediaItem[];
  stats: EngagementStats;
  uploadDate: string;
}

// ============================================================
// PARSER FUNCTIONS
// ============================================================

/**
 * Parse TikWM response for video content
 * Extracts HD and SD quality URLs
 */
function parseVideo(data: TikWMData): MediaItem {
  const sources: MediaSource[] = [];
  
  // HD quality (no watermark) - primary
  if (data.hdplay) {
    sources.push({
      quality: 'hd',
      url: data.hdplay,
      mime: 'video/mp4',
      size: data.hd_size || undefined,
    });
  }
  
  // SD quality (no watermark)
  if (data.play && data.play !== data.hdplay) {
    sources.push({
      quality: 'sd',
      url: data.play,
      mime: 'video/mp4',
      size: data.size || undefined,
    });
  }
  
  // Watermarked version as fallback
  if (data.wmplay && sources.length === 0) {
    sources.push({
      quality: 'sd_watermark',
      url: data.wmplay,
      mime: 'video/mp4',
      size: data.wm_size || undefined,
    });
  }
  
  return {
    index: 0,
    type: 'video',
    thumbnail: data.cover || data.origin_cover,
    sources,
  };
}

/**
 * Parse TikWM response for slideshow content
 * Extracts all image URLs in order
 */
function parseSlideshow(data: TikWMData): MediaItem[] {
  const items: MediaItem[] = [];
  
  if (!data.images || data.images.length === 0) {
    return items;
  }
  
  for (let i = 0; i < data.images.length; i++) {
    const imageUrl = data.images[i];
    items.push({
      index: i,
      type: 'image',
      thumbnail: imageUrl,
      sources: [{
        quality: 'original',
        url: imageUrl,
        mime: 'image/jpeg',
      }],
    });
  }
  
  return items;
}

/**
 * Extract engagement statistics from TikWM data
 */
function extractStats(data: TikWMData): EngagementStats {
  const stats: EngagementStats = {};
  
  if (data.play_count) stats.views = data.play_count;
  if (data.digg_count) stats.likes = data.digg_count;
  if (data.comment_count) stats.comments = data.comment_count;
  if (data.share_count) stats.shares = data.share_count;
  
  return stats;
}

/**
 * Parse TikWM response into structured result
 * Handles both video and slideshow content types
 */
export function parseTikWM(data: TikWMData): ParsedTikTokResult {
  const isSlideshow = data.images && data.images.length > 0;
  const contentType = isSlideshow ? 'slideshow' : 'video';
  
  logger.debug('tiktok-extract', 'Parsing TikWM data', {
    id: data.id,
    contentType,
    imageCount: data.images?.length || 0,
    hasHD: !!data.hdplay,
  });
  
  // Parse items based on content type
  const items = isSlideshow 
    ? parseSlideshow(data) 
    : [parseVideo(data)];
  
  // Build upload date from timestamp
  const uploadDate = data.create_time 
    ? new Date(data.create_time * 1000).toISOString()
    : new Date().toISOString();
  
  return {
    id: data.id,
    title: data.title || 'TikTok Video',
    author: {
      username: data.author?.unique_id || '',
      nickname: data.author?.nickname || '',
      avatar: data.author?.avatar || '',
    },
    thumbnail: data.cover || data.origin_cover || '',
    duration: data.duration || 0,
    contentType,
    items,
    stats: extractStats(data),
    uploadDate,
  };
}

/**
 * Build final extraction result from parsed TikTok data
 */
export function buildExtractResult(parsed: ParsedTikTokResult): InternalExtractResult {
  // Build title with author if available
  let title = parsed.title;
  if (!title || title === 'TikTok Video') {
    title = parsed.author.nickname 
      ? `${parsed.author.nickname}'s TikTok`
      : 'TikTok Video';
  }
  
  // Truncate long titles
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }
  
  const result: InternalExtractResult = {
    success: true,
    platform: 'tiktok',
    contentType: parsed.contentType,
    title,
    author: parsed.author.nickname || parsed.author.username,
    id: parsed.id,
    description: parsed.title,
    uploadDate: parsed.uploadDate,
    items: parsed.items,
  };
  
  // Add stats if present
  if (Object.keys(parsed.stats).length > 0) {
    result.stats = parsed.stats;
  }
  
  logger.media('tiktok', {
    items: parsed.items.length,
    totalSources: parsed.items.reduce((sum, i) => sum + i.sources.length, 0),
    contentType: parsed.contentType,
  });
  
  return result;
}
