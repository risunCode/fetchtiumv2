/**
 * Instagram Extract - Parse API responses and build extraction result
 * 
 * Handles both GraphQL API and Internal API responses
 * Supports single posts, videos, reels, and carousels (sidecar)
 */

import type {
  GraphQLResponse,
  InternalAPIResponse,
  ShortcodeMedia,
  SidecarEdge,
  APIMediaItem,
  CarouselItem,
  VideoVersion,
  ImageCandidate,
} from './scanner';
import type { MediaItem, MediaSource, EngagementStats } from '@/types/extract';
import type { InternalExtractResult } from '../base.extractor';
import { logger } from '@/lib/utils/logger';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Parsed Instagram result before building final response
 */
export interface ParsedInstagramResult {
  id: string;
  shortcode: string;
  author: {
    username: string;
    fullName: string;
    avatar: string;
  };
  caption: string;
  contentType: 'video' | 'image' | 'carousel';
  items: MediaItem[];
  stats: EngagementStats;
  uploadDate: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get best quality image URL from display resources
 */
function getBestImageUrl(displayUrl: string, resources?: { src: string; config_width: number; config_height: number }[]): string {
  if (resources && resources.length > 0) {
    // Sort by width descending and get the largest
    const sorted = [...resources].sort((a, b) => b.config_width - a.config_width);
    return sorted[0].src;
  }
  return displayUrl;
}

/**
 * Get best quality video URL from video versions
 */
function getBestVideoUrl(versions: VideoVersion[]): VideoVersion | null {
  if (!versions || versions.length === 0) return null;
  
  // Sort by width descending (higher resolution first)
  const sorted = [...versions].sort((a, b) => b.width - a.width);
  return sorted[0];
}

/**
 * Get best quality image from candidates
 */
function getBestImageCandidate(candidates: ImageCandidate[]): ImageCandidate | null {
  if (!candidates || candidates.length === 0) return null;
  
  // Sort by width descending
  const sorted = [...candidates].sort((a, b) => b.width - a.width);
  return sorted[0];
}

/**
 * Parse video versions into MediaSource array
 */
function parseVideoSources(versions: VideoVersion[]): MediaSource[] {
  if (!versions || versions.length === 0) return [];
  
  // Sort by resolution (width) descending
  const sorted = [...versions].sort((a, b) => b.width - a.width);
  
  return sorted.map((version, index) => ({
    quality: index === 0 ? 'hd' : 'sd',
    url: version.url,
    resolution: `${version.width}x${version.height}`,
    mime: 'video/mp4',
  }));
}

/**
 * Parse image candidates into MediaSource array
 */
function parseImageSources(candidates: ImageCandidate[]): MediaSource[] {
  if (!candidates || candidates.length === 0) return [];
  
  // Get the best quality image
  const best = getBestImageCandidate(candidates);
  if (!best) return [];
  
  return [{
    quality: 'original',
    url: best.url,
    resolution: `${best.width}x${best.height}`,
    mime: 'image/jpeg',
  }];
}

// ============================================================
// GRAPHQL PARSER
// ============================================================

/**
 * Parse GraphQL API response
 */
export function parseGraphQLResponse(data: GraphQLResponse): ParsedInstagramResult | null {
  const media = data.data?.xdt_shortcode_media;
  if (!media) {
    logger.warn('instagram-extract', 'No media data in GraphQL response');
    return null;
  }
  
  logger.debug('instagram-extract', 'Parsing GraphQL response', {
    id: media.id,
    shortcode: media.shortcode,
    typename: media.__typename,
    isVideo: media.is_video,
    hasSidecar: !!media.edge_sidecar_to_children,
  });
  
  const items: MediaItem[] = [];
  let contentType: 'video' | 'image' | 'carousel' = 'image';
  
  // Handle carousel/sidecar posts
  if (media.__typename === 'GraphSidecar' && media.edge_sidecar_to_children?.edges) {
    contentType = 'carousel';
    const edges = media.edge_sidecar_to_children.edges;
    
    for (let i = 0; i < edges.length; i++) {
      const node = edges[i].node;
      
      if (node.is_video && node.video_url) {
        items.push({
          index: i,
          type: 'video',
          thumbnail: node.display_url,
          sources: [{
            quality: 'hd',
            url: node.video_url,
            resolution: node.dimensions 
              ? `${node.dimensions.width}x${node.dimensions.height}`
              : undefined,
            mime: 'video/mp4',
          }],
        });
      } else {
        const imageUrl = getBestImageUrl(node.display_url, node.display_resources);
        items.push({
          index: i,
          type: 'image',
          thumbnail: node.display_url,
          sources: [{
            quality: 'original',
            url: imageUrl,
            resolution: node.dimensions 
              ? `${node.dimensions.width}x${node.dimensions.height}`
              : undefined,
            mime: 'image/jpeg',
          }],
        });
      }
    }
  }
  // Handle single video
  else if (media.is_video && media.video_url) {
    contentType = 'video';
    items.push({
      index: 0,
      type: 'video',
      thumbnail: media.display_url,
      sources: [{
        quality: 'hd',
        url: media.video_url,
        resolution: media.dimensions 
          ? `${media.dimensions.width}x${media.dimensions.height}`
          : undefined,
        mime: 'video/mp4',
      }],
    });
  }
  // Handle single image
  else {
    contentType = 'image';
    const imageUrl = getBestImageUrl(media.display_url, media.display_resources);
    items.push({
      index: 0,
      type: 'image',
      thumbnail: media.display_url,
      sources: [{
        quality: 'original',
        url: imageUrl,
        resolution: media.dimensions 
          ? `${media.dimensions.width}x${media.dimensions.height}`
          : undefined,
        mime: 'image/jpeg',
      }],
    });
  }
  
  // Extract caption
  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
  
  // Extract stats
  const stats: EngagementStats = {};
  if (media.edge_media_preview_like?.count) {
    stats.likes = media.edge_media_preview_like.count;
  }
  if (media.edge_media_to_comment?.count) {
    stats.comments = media.edge_media_to_comment.count;
  }
  if (media.video_view_count) {
    stats.views = media.video_view_count;
  }
  
  // Parse upload date
  const uploadDate = media.taken_at_timestamp 
    ? new Date(media.taken_at_timestamp * 1000).toISOString()
    : new Date().toISOString();
  
  return {
    id: media.id,
    shortcode: media.shortcode,
    author: {
      username: media.owner.username,
      fullName: media.owner.full_name || '',
      avatar: media.owner.profile_pic_url || '',
    },
    caption,
    contentType,
    items,
    stats,
    uploadDate,
  };
}

// ============================================================
// INTERNAL API PARSER
// ============================================================

/**
 * Parse Internal API response
 */
export function parseAPIResponse(data: InternalAPIResponse): ParsedInstagramResult | null {
  if (!data.items || data.items.length === 0) {
    logger.warn('instagram-extract', 'No items in API response');
    return null;
  }
  
  const item = data.items[0];
  
  logger.debug('instagram-extract', 'Parsing API response', {
    id: item.id,
    code: item.code,
    mediaType: item.media_type,
    hasCarousel: !!item.carousel_media,
  });
  
  const items: MediaItem[] = [];
  let contentType: 'video' | 'image' | 'carousel' = 'image';
  
  // Handle carousel (media_type = 8)
  if (item.media_type === 8 && item.carousel_media) {
    contentType = 'carousel';
    
    for (let i = 0; i < item.carousel_media.length; i++) {
      const carouselItem = item.carousel_media[i];
      
      if (carouselItem.media_type === 2 && carouselItem.video_versions) {
        // Video in carousel
        const sources = parseVideoSources(carouselItem.video_versions);
        const thumbnail = carouselItem.image_versions2?.candidates?.[0]?.url || '';
        
        items.push({
          index: i,
          type: 'video',
          thumbnail,
          sources,
        });
      } else if (carouselItem.image_versions2?.candidates) {
        // Image in carousel
        const sources = parseImageSources(carouselItem.image_versions2.candidates);
        const thumbnail = carouselItem.image_versions2.candidates[0]?.url || '';
        
        items.push({
          index: i,
          type: 'image',
          thumbnail,
          sources,
        });
      }
    }
  }
  // Handle video (media_type = 2)
  else if (item.media_type === 2 && item.video_versions) {
    contentType = 'video';
    const sources = parseVideoSources(item.video_versions);
    const thumbnail = item.image_versions2?.candidates?.[0]?.url || '';
    
    items.push({
      index: 0,
      type: 'video',
      thumbnail,
      sources,
    });
  }
  // Handle image (media_type = 1)
  else if (item.image_versions2?.candidates) {
    contentType = 'image';
    const sources = parseImageSources(item.image_versions2.candidates);
    const thumbnail = item.image_versions2.candidates[0]?.url || '';
    
    items.push({
      index: 0,
      type: 'image',
      thumbnail,
      sources,
    });
  }
  
  // Extract caption
  const caption = item.caption?.text || '';
  
  // Extract stats
  const stats: EngagementStats = {};
  if (item.like_count) stats.likes = item.like_count;
  if (item.comment_count) stats.comments = item.comment_count;
  if (item.play_count) stats.views = item.play_count;
  if (item.view_count) stats.views = item.view_count;
  
  // Parse upload date
  const uploadDate = item.taken_at 
    ? new Date(item.taken_at * 1000).toISOString()
    : new Date().toISOString();
  
  return {
    id: item.id,
    shortcode: item.code,
    author: {
      username: item.user.username,
      fullName: item.user.full_name || '',
      avatar: item.user.profile_pic_url || '',
    },
    caption,
    contentType,
    items,
    stats,
    uploadDate,
  };
}

// ============================================================
// BUILD RESULT
// ============================================================

/**
 * Build final extraction result from parsed Instagram data
 */
export function buildExtractResult(
  parsed: ParsedInstagramResult,
  usedCookie: boolean = false
): InternalExtractResult {
  // Build title from caption
  let title = parsed.caption;
  
  // Remove hashtags and mentions for cleaner title
  title = title.replace(/#\w+/g, '').replace(/@\w+/g, '').trim();
  
  // Truncate long titles
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }
  
  // Fallback title
  if (!title) {
    title = `Instagram post by @${parsed.author.username}`;
  }
  
  // For author field, prefer username (always ASCII) over fullName (may be non-ASCII)
  // This ensures filename generation works properly
  const authorForDisplay = parsed.author.fullName || `@${parsed.author.username}`;
  const authorForFilename = parsed.author.username; // Always use username for filename
  
  const result: InternalExtractResult = {
    success: true,
    platform: 'instagram',
    contentType: parsed.contentType,
    title,
    author: authorForFilename, // Use username for filename generation
    authorDisplay: authorForDisplay, // Keep full name for display
    id: parsed.id,
    description: parsed.caption,
    uploadDate: parsed.uploadDate,
    items: parsed.items,
    usedCookie,
  };
  
  // Add stats if present
  if (Object.keys(parsed.stats).length > 0) {
    result.stats = parsed.stats;
  }
  
  logger.media('instagram', {
    items: parsed.items.length,
    totalSources: parsed.items.reduce((sum, i) => sum + i.sources.length, 0),
    contentType: parsed.contentType,
    usedCookie,
  });
  
  return result;
}
