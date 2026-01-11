/**
 * Twitter/X Extract - Parse API responses and build extraction result
 * 
 * Handles both Syndication API and GraphQL API responses
 * Extracts videos (sorted by bitrate) and photos (original quality)
 */

import type {
  SyndicationResponse,
  GraphQLResponse,
  VideoVariant,
  MediaDetail,
  Photo,
  TweetResult,
  TweetLegacy,
  ExtendedMedia,
  QuotedTweet,
} from './scanner';
import type { MediaItem, MediaSource, EngagementStats } from '@/types/extract';
import type { InternalExtractResult } from '../base.extractor';
import { logger } from '@/lib/utils/logger';
import { getQualityFromBitrate, getResolutionFromBitrate } from '@/lib/utils/quality.utils';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Parsed Twitter result before building final response
 */
export interface ParsedTwitterResult {
  id: string;
  text: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  contentType: 'video' | 'image' | 'mixed';
  items: MediaItem[];
  stats: EngagementStats;
  uploadDate: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Sort video variants by bitrate (highest first)
 */
function sortVideoVariants(variants: VideoVariant[]): VideoVariant[] {
  return [...variants]
    .filter(v => v.content_type === 'video/mp4' && v.bitrate !== undefined)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
}

/**
 * Extract resolution from URL if present
 */
function extractResolutionFromUrl(url: string): string | undefined {
  const match = url.match(/\/(\d+)x(\d+)\//);
  if (match) {
    return `${match[1]}x${match[2]}`;
  }
  return undefined;
}

/**
 * Parse video variants into MediaSource array
 */
function parseVideoSources(variants: VideoVariant[]): MediaSource[] {
  const sorted = sortVideoVariants(variants);
  
  return sorted.map((variant, index) => {
    const bitrate = variant.bitrate || 0;
    const urlResolution = extractResolutionFromUrl(variant.url);
    
    return {
      quality: index === 0 ? 'best' : getQualityFromBitrate(bitrate),
      url: variant.url,
      resolution: urlResolution || getResolutionFromBitrate(bitrate),
      mime: variant.content_type,
    };
  });
}

/**
 * Get original quality photo URL
 * Twitter serves photos with ?format=jpg&name=large by default
 * We want ?format=jpg&name=orig for original quality
 */
function getOriginalPhotoUrl(url: string): string {
  // Handle pbs.twimg.com URLs
  if (url.includes('pbs.twimg.com')) {
    // Remove existing query params and add orig
    const baseUrl = url.split('?')[0];
    return `${baseUrl}?format=jpg&name=orig`;
  }
  return url;
}

// ============================================================
// RETWEET HELPERS
// ============================================================

/**
 * Check if Syndication response is a retweet
 */
function isSyndicationRetweet(data: SyndicationResponse): boolean {
  return !!data.retweeted_status;
}

/**
 * Get original tweet from Syndication retweet
 */
function getOriginalSyndicationTweet(data: SyndicationResponse): SyndicationResponse {
  return data.retweeted_status || data;
}

/**
 * Check if GraphQL response is a retweet
 */
function isGraphQLRetweet(legacy: TweetLegacy): boolean {
  return !!legacy.retweeted_status_result;
}

/**
 * Get original tweet result from GraphQL retweet
 */
function getOriginalGraphQLTweet(legacy: TweetLegacy): TweetResult | null {
  return legacy.retweeted_status_result?.result || null;
}

// ============================================================
// QUOTE TWEET HELPERS
// ============================================================

/**
 * Check if Syndication response is a quote tweet
 */
function isSyndicationQuoteTweet(data: SyndicationResponse): boolean {
  return !!data.quoted_tweet;
}

/**
 * Check if quote tweet has media
 */
function quotedTweetHasMedia(quoted: QuotedTweet): boolean {
  return !!(quoted.mediaDetails?.length || quoted.photos?.length || quoted.video);
}

/**
 * Check if main tweet has media
 */
function mainTweetHasMedia(data: SyndicationResponse): boolean {
  return !!(data.mediaDetails?.length || data.photos?.length || data.video);
}

/**
 * Check if GraphQL response is a quote tweet
 */
function isGraphQLQuoteTweet(legacy: TweetLegacy): boolean {
  return !!legacy.quoted_status_result;
}

/**
 * Get quoted tweet result from GraphQL
 */
function getQuotedGraphQLTweet(legacy: TweetLegacy): TweetResult | null {
  return legacy.quoted_status_result?.result || null;
}

/**
 * Check if GraphQL tweet result has media
 */
function graphQLTweetHasMedia(result: TweetResult): boolean {
  const legacy = result.legacy;
  if (!legacy) return false;
  const mediaList = legacy.extended_entities?.media || legacy.entities?.media || [];
  return mediaList.length > 0;
}

// ============================================================
// SYNDICATION PARSER
// ============================================================

/**
 * Parse Syndication API response
 */
export function parseSyndication(data: SyndicationResponse): ParsedTwitterResult {
  // Check if this is a retweet and get the original tweet
  const isRetweet = isSyndicationRetweet(data);
  const originalTweet = getOriginalSyndicationTweet(data);
  const retweetAuthor = isRetweet ? data.user : null;
  
  // Check if this is a quote tweet (main tweet quotes another)
  const isQuoteTweet = isSyndicationQuoteTweet(originalTweet);
  const quotedTweet = originalTweet.quoted_tweet;
  
  // Determine if we should use quoted tweet's media
  // Use quoted tweet media if: main tweet has no media AND quoted tweet has media
  const useQuotedMedia = isQuoteTweet && 
    quotedTweet && 
    !mainTweetHasMedia(originalTweet) && 
    quotedTweetHasMedia(quotedTweet);
  
  logger.debug('twitter-extract', 'Parsing Syndication response', {
    id: data.id_str,
    isRetweet,
    isQuoteTweet,
    useQuotedMedia,
    originalId: isRetweet ? originalTweet.id_str : undefined,
    quotedId: quotedTweet?.id_str,
    hasMediaDetails: !!originalTweet.mediaDetails?.length,
    hasPhotos: !!originalTweet.photos?.length,
    hasVideo: !!originalTweet.video,
  });
  
  const items: MediaItem[] = [];
  let contentType: 'video' | 'image' | 'mixed' = 'image';
  let hasVideo = false;
  let hasImage = false;
  
  // Choose media source: quoted tweet or original tweet
  const mediaSource = useQuotedMedia ? quotedTweet! : originalTweet;
  
  // Parse mediaDetails (primary source)
  if (mediaSource.mediaDetails && mediaSource.mediaDetails.length > 0) {
    for (let i = 0; i < mediaSource.mediaDetails.length; i++) {
      const media = mediaSource.mediaDetails[i];
      
      if (media.type === 'video' || media.type === 'animated_gif') {
        hasVideo = true;
        const sources = media.video_info?.variants 
          ? parseVideoSources(media.video_info.variants)
          : [];
        
        if (sources.length > 0) {
          items.push({
            index: i,
            type: 'video',
            thumbnail: media.media_url_https,
            sources,
          });
        }
      } else if (media.type === 'photo') {
        hasImage = true;
        const originalUrl = getOriginalPhotoUrl(media.media_url_https);
        
        items.push({
          index: i,
          type: 'image',
          thumbnail: media.media_url_https,
          sources: [{
            quality: 'original',
            url: originalUrl,
            mime: 'image/jpeg',
            resolution: media.original_info 
              ? `${media.original_info.width}x${media.original_info.height}`
              : undefined,
          }],
        });
      }
    }
  }
  
  // Fallback to video object (for single video tweets)
  if (items.length === 0 && mediaSource.video) {
    hasVideo = true;
    const sources = parseVideoSources(mediaSource.video.variants);
    
    if (sources.length > 0) {
      items.push({
        index: 0,
        type: 'video',
        thumbnail: mediaSource.video.poster,
        sources,
      });
    }
  }
  
  // Fallback to photos array
  if (items.length === 0 && mediaSource.photos && mediaSource.photos.length > 0) {
    hasImage = true;
    for (let i = 0; i < mediaSource.photos.length; i++) {
      const photo = mediaSource.photos[i];
      const originalUrl = getOriginalPhotoUrl(photo.url);
      
      items.push({
        index: i,
        type: 'image',
        thumbnail: photo.url,
        sources: [{
          quality: 'original',
          url: originalUrl,
          mime: 'image/jpeg',
          resolution: `${photo.width}x${photo.height}`,
        }],
      });
    }
  }
  
  // Determine content type
  if (hasVideo && hasImage) {
    contentType = 'mixed';
  } else if (hasVideo) {
    contentType = 'video';
  } else {
    contentType = 'image';
  }
  
  // Extract stats - use quoted tweet stats if we're using its media
  const statsSource = useQuotedMedia ? quotedTweet! : originalTweet;
  const stats: EngagementStats = {};
  if (statsSource.favorite_count) stats.likes = statsSource.favorite_count;
  if (statsSource.retweet_count) stats.shares = statsSource.retweet_count;
  if (statsSource.reply_count) stats.comments = statsSource.reply_count;
  if ('views_count' in statsSource && statsSource.views_count) {
    stats.views = parseInt(statsSource.views_count as string, 10);
  }
  
  // Parse upload date - use quoted tweet date if we're using its media
  const dateSource = useQuotedMedia ? quotedTweet! : originalTweet;
  const uploadDate = dateSource.created_at 
    ? new Date(dateSource.created_at).toISOString()
    : new Date().toISOString();
  
  // Build description with retweet/quote indicator
  let text = originalTweet.full_text || originalTweet.text;
  if (isRetweet && retweetAuthor) {
    text = `🔁 Retweeted by @${retweetAuthor.screen_name}\n\n${text}`;
  }
  if (useQuotedMedia && quotedTweet) {
    text = `💬 Quote tweet by @${originalTweet.user.screen_name}\n\n📎 Original by @${quotedTweet.user.screen_name}:\n${quotedTweet.full_text || quotedTweet.text || ''}`;
  }
  
  // Use quoted tweet author if we're using its media
  const authorSource = useQuotedMedia ? quotedTweet! : originalTweet;
  
  return {
    id: useQuotedMedia ? quotedTweet!.id_str : originalTweet.id_str,
    text,
    author: {
      name: authorSource.user.name,
      username: authorSource.user.screen_name,
      avatar: authorSource.user.profile_image_url_https,
    },
    contentType,
    items,
    stats,
    uploadDate,
  };
}

// ============================================================
// GRAPHQL PARSER
// ============================================================

/**
 * Parse GraphQL API response
 */
export function parseGraphQL(data: GraphQLResponse): ParsedTwitterResult | null {
  const result = data.data?.tweetResult?.result;
  if (!result || !result.legacy) {
    logger.warn('twitter-extract', 'No tweet data in GraphQL response');
    return null;
  }
  
  // Check if this is a retweet and get the original tweet
  const isRetweet = isGraphQLRetweet(result.legacy);
  const originalTweetResult = isRetweet ? getOriginalGraphQLTweet(result.legacy) : null;
  const retweetAuthor = isRetweet ? result.core?.user_results?.result?.legacy : null;
  
  // Use original tweet data if this is a retweet
  const tweetResult = originalTweetResult || result;
  const legacy = tweetResult.legacy;
  
  if (!legacy) {
    logger.warn('twitter-extract', 'No legacy data in tweet result');
    return null;
  }
  
  // Check if this is a quote tweet
  const isQuoteTweet = isGraphQLQuoteTweet(legacy);
  const quotedTweetResult = isQuoteTweet ? getQuotedGraphQLTweet(legacy) : null;
  
  // Determine if we should use quoted tweet's media
  const useQuotedMedia = isQuoteTweet && 
    quotedTweetResult && 
    !graphQLTweetHasMedia(tweetResult) && 
    graphQLTweetHasMedia(quotedTweetResult);
  
  // Choose which tweet result to use for media
  const mediaSourceResult = useQuotedMedia ? quotedTweetResult! : tweetResult;
  const mediaSourceLegacy = mediaSourceResult.legacy;
  
  if (!mediaSourceLegacy) {
    logger.warn('twitter-extract', 'No legacy data in media source');
    return null;
  }
  
  logger.debug('twitter-extract', 'Parsing GraphQL response', {
    id: result.rest_id,
    isRetweet,
    isQuoteTweet,
    useQuotedMedia,
    originalId: isRetweet ? tweetResult.rest_id : undefined,
    quotedId: quotedTweetResult?.rest_id,
    typename: tweetResult.__typename,
    hasExtendedEntities: !!legacy.extended_entities,
  });
  
  const items: MediaItem[] = [];
  let contentType: 'video' | 'image' | 'mixed' = 'image';
  let hasVideo = false;
  let hasImage = false;
  
  // Get media from extended_entities (preferred) or entities
  const mediaList = mediaSourceLegacy.extended_entities?.media || mediaSourceLegacy.entities?.media || [];
  
  for (let i = 0; i < mediaList.length; i++) {
    const media = mediaList[i];
    
    if (media.type === 'video' || media.type === 'animated_gif') {
      hasVideo = true;
      const sources = media.video_info?.variants 
        ? parseVideoSources(media.video_info.variants)
        : [];
      
      if (sources.length > 0) {
        items.push({
          index: i,
          type: 'video',
          thumbnail: media.media_url_https,
          sources,
        });
      }
    } else if (media.type === 'photo') {
      hasImage = true;
      const originalUrl = getOriginalPhotoUrl(media.media_url_https);
      
      items.push({
        index: i,
        type: 'image',
        thumbnail: media.media_url_https,
        sources: [{
          quality: 'original',
          url: originalUrl,
          mime: 'image/jpeg',
          resolution: media.original_info 
            ? `${media.original_info.width}x${media.original_info.height}`
            : undefined,
        }],
      });
    }
  }
  
  // Determine content type
  if (hasVideo && hasImage) {
    contentType = 'mixed';
  } else if (hasVideo) {
    contentType = 'video';
  } else {
    contentType = 'image';
  }
  
  // Extract user info - use quoted tweet author if we're using its media
  const authorResult = useQuotedMedia ? quotedTweetResult! : tweetResult;
  const userLegacy = authorResult.core?.user_results?.result?.legacy;
  const author = {
    name: userLegacy?.name || '',
    username: userLegacy?.screen_name || '',
    avatar: userLegacy?.profile_image_url_https || '',
  };
  
  // Extract stats - use quoted tweet stats if we're using its media
  const statsLegacy = useQuotedMedia ? mediaSourceLegacy : legacy;
  const statsResult = useQuotedMedia ? quotedTweetResult! : tweetResult;
  const stats: EngagementStats = {};
  if (statsLegacy.favorite_count) stats.likes = statsLegacy.favorite_count;
  if (statsLegacy.retweet_count) stats.shares = statsLegacy.retweet_count;
  if (statsLegacy.reply_count) stats.comments = statsLegacy.reply_count;
  if (statsResult.views?.count) stats.views = parseInt(statsResult.views.count, 10);
  
  // Parse upload date - use quoted tweet date if we're using its media
  const dateLegacy = useQuotedMedia ? mediaSourceLegacy : legacy;
  const uploadDate = dateLegacy.created_at 
    ? new Date(dateLegacy.created_at).toISOString()
    : new Date().toISOString();
  
  // Build description with retweet/quote indicator
  let text = legacy.full_text;
  if (isRetweet && retweetAuthor) {
    text = `🔁 Retweeted by @${retweetAuthor.screen_name}\n\n${text}`;
  }
  if (useQuotedMedia && quotedTweetResult?.legacy) {
    const quoterUsername = tweetResult.core?.user_results?.result?.legacy?.screen_name || '';
    const quotedUsername = userLegacy?.screen_name || '';
    text = `💬 Quote tweet by @${quoterUsername}\n\n📎 Original by @${quotedUsername}:\n${quotedTweetResult.legacy.full_text || ''}`;
  }
  
  return {
    id: useQuotedMedia ? (mediaSourceLegacy.id_str || mediaSourceResult.rest_id || '') : (legacy.id_str || tweetResult.rest_id || ''),
    text,
    author,
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
 * Build final extraction result from parsed Twitter data
 */
export function buildExtractResult(
  parsed: ParsedTwitterResult,
  usedCookie: boolean = false
): InternalExtractResult {
  // Build title from tweet text
  let title = parsed.text;
  
  // Remove URLs from title
  title = title.replace(/https?:\/\/\S+/g, '').trim();
  
  // Truncate long titles
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }
  
  // Fallback title
  if (!title) {
    title = `Tweet by @${parsed.author.username}`;
  }
  
  // Use username for filename (always ASCII), display name for UI
  const authorForFilename = parsed.author.username;
  const authorForDisplay = parsed.author.name || `@${parsed.author.username}`;
  
  const result: InternalExtractResult = {
    success: true,
    platform: 'twitter',
    contentType: parsed.contentType,
    title,
    author: authorForFilename, // Use username for filename generation
    authorDisplay: authorForDisplay, // Keep display name for UI
    id: parsed.id,
    description: parsed.text,
    uploadDate: parsed.uploadDate,
    items: parsed.items,
    usedCookie,
  };
  
  // Add stats if present
  if (Object.keys(parsed.stats).length > 0) {
    result.stats = parsed.stats;
  }
  
  logger.media('twitter', {
    items: parsed.items.length,
    totalSources: parsed.items.reduce((sum, i) => sum + i.sources.length, 0),
    contentType: parsed.contentType,
    usedCookie,
  });
  
  return result;
}
