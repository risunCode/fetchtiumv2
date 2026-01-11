/**
 * Instagram Extract - Parse API responses and build extraction result
 * 
 * Handles both GraphQL API and Internal API responses
 * Supports single posts, videos, reels, and carousels (sidecar)
 */

import type {
  GraphQLResponse,
  InternalAPIResponse,
  StoryResponse,
  StoryReel,
  StoryItem,
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
 * Returns only the best quality video
 */
function parseVideoSources(versions: VideoVersion[]): MediaSource[] {
  if (!versions || versions.length === 0) return [];
  
  // Sort by resolution (width) descending, get best
  const sorted = [...versions].sort((a, b) => b.width - a.width);
  const best = sorted[0];
  
  return [{
    quality: best.width >= 720 ? 'hd' : 'sd',
    url: best.url,
    resolution: `${best.width}x${best.height}`,
    mime: 'video/mp4',
  }];
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
  if ((media.__typename === 'GraphSidecar' || media.__typename === 'XDTGraphSidecar') && media.edge_sidecar_to_children?.edges) {
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

// ============================================================
// STORY PARSER
// ============================================================

/**
 * Parse story response from Instagram Stories API
 * 
 * @param data - Story API response
 * @param targetStoryId - The specific story ID we're looking for (empty = get all)
 * @returns Parsed result or null if parsing fails
 */
export function parseStoryResponse(
  data: StoryResponse,
  targetStoryId: string
): ParsedInstagramResult | null {
  // Handle both response formats: reels_media (array) or reels (object)
  let reel: StoryReel | undefined;
  
  if (data.reels_media && data.reels_media.length > 0) {
    reel = data.reels_media[0];
  } else if (data.reels) {
    const reelKeys = Object.keys(data.reels);
    if (reelKeys.length > 0) {
      reel = data.reels[reelKeys[0]];
    }
  }
  
  if (!reel || !reel.items || reel.items.length === 0) {
    logger.warn('instagram-extract', 'No story items in response');
    return null;
  }

  const items: MediaItem[] = [];
  let contentType: 'video' | 'image' | 'carousel' = 'image';
  let firstItemDate: string | undefined;

  // If targetStoryId is provided, find that specific item
  // Otherwise, parse ALL items as a carousel
  const itemsToParse = targetStoryId 
    ? reel.items.filter(item => item.pk === targetStoryId || item.id === targetStoryId)
    : reel.items;

  // If specific ID requested but not found, use all items
  const finalItems = itemsToParse.length > 0 ? itemsToParse : reel.items;

  // Parse each story item
  for (let i = 0; i < finalItems.length; i++) {
    const storyItem = finalItems[i];
    
    logger.debug('instagram-extract', `Parsing story item ${i}`, {
      pk: storyItem.pk,
      media_type: storyItem.media_type,
      hasVideo: !!storyItem.video_versions,
      hasImage: !!storyItem.image_versions2,
    });
    
    // Track first item date
    if (i === 0 && storyItem.taken_at) {
      firstItemDate = new Date(storyItem.taken_at * 1000).toISOString();
    }

    if (storyItem.media_type === 2 && storyItem.video_versions) {
      // Video story
      const sources = parseVideoSources(storyItem.video_versions);
      const thumbnail = storyItem.image_versions2?.candidates?.[0]?.url || '';

      items.push({
        index: i,
        type: 'video',
        thumbnail,
        sources,
      });
    } else if (storyItem.image_versions2?.candidates) {
      // Image story
      const sources = parseImageSources(storyItem.image_versions2.candidates);
      const thumbnail = storyItem.image_versions2.candidates[0]?.url || '';

      items.push({
        index: i,
        type: 'image',
        thumbnail,
        sources,
      });
    }
  }

  logger.debug('instagram-extract', 'Parsed story items', {
    totalItems: items.length,
    types: items.map(i => i.type),
  });

  if (items.length === 0) {
    logger.warn('instagram-extract', 'Could not parse any story media');
    return null;
  }

  // Determine content type
  if (items.length > 1) {
    contentType = 'carousel';
  } else if (items[0].type === 'video') {
    contentType = 'video';
  } else {
    contentType = 'image';
  }

  // Use first item's date or current date
  const uploadDate = firstItemDate || new Date().toISOString();

  // Use first item's pk (not id which includes user ID suffix)
  const firstItem = finalItems[0];

  return {
    id: firstItem.pk, // Use pk only, not id (which is pk_userId)
    shortcode: firstItem.pk,
    author: {
      username: reel.user.username,
      fullName: reel.user.full_name || '',
      avatar: reel.user.profile_pic_url || '',
    },
    caption: '', // Stories typically don't have captions
    contentType,
    items,
    stats: {},
    uploadDate,
  };
}
