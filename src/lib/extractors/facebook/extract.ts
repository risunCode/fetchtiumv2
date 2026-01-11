/**
 * Facebook Extract - Data extraction + Output normalization
 * TypeScript conversion of facebook/extract.js
 */

import { decodeUrl, cleanJsonString, extractAll } from '@/lib/core/parser/regex.extractor';
import { decodeHtmlEntities } from '@/lib/core/parser/html.parser';
import {
  VIDEO_PATTERNS, IMAGE_PATTERNS, STORY_PATTERNS, METADATA_PATTERNS,
  SKIP_IMAGE_SIDS, SKIP_IMAGE_PATTERNS, VALID_MEDIA_PATTERNS,
  ID_PATTERNS, CONTENT_TYPE_PATTERNS
} from './scanner';
import { logger } from '@/lib/utils/logger';
import type { MediaItem, MediaSource, EngagementStats } from '@/types/extract';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface RawFormat {
  index: number;
  quality: string;
  type: 'video' | 'image' | 'audio';
  url: string;
  thumbnail?: string | null;
  resolution?: string;
  mime?: string;
  size?: number;
}

export interface ExtractedMetadata {
  author: string | null;
  description: string | null;
  thumbnail: string | null;
  uploadDate: string | null;
  title?: string | null;
  engagement: Partial<EngagementStats>;
}

export interface BuildExtractResultData {
  url?: string;
  id?: string | null;
  contentType: string;
  formats: RawFormat[];
  metadata: ExtractedMetadata;
}

export interface ExtractResultSuccess {
  success: true;
  platform: string;
  contentType: string;
  title: string;
  author?: string;
  id?: string;
  description?: string;
  uploadDate?: string;
  stats?: EngagementStats;
  items: MediaItem[];
  usedCookie?: boolean;
}

export interface ExtractResultError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isValidMediaUrl(url: string, type: 'video' | 'image' = 'video'): boolean {
  const minLength = VALID_MEDIA_PATTERNS.minLength as number;
  if (!url || url.length < minLength) return false;
  if (/<|>/.test(url)) return false;
  const pattern = VALID_MEDIA_PATTERNS[type] as RegExp;
  return pattern.test(url);
}

function isSkipImage(url: string): boolean {
  if (SKIP_IMAGE_SIDS.some(sid => url.includes('_nc_sid=' + sid))) return true;
  return SKIP_IMAGE_PATTERNS.some(pattern => pattern.test(url));
}

function getQualityLabel(height: number): string {
  if (height >= 1080) return 'HD 1080p';
  if (height >= 720) return 'HD 720p';
  if (height >= 480) return 'SD 480p';
  return height + 'p';
}

function getResolution(quality: string | undefined): string | null {
  const q = (quality || '').toLowerCase();
  if (q.includes('1080') || q === 'hd') return '1280x720';
  if (q.includes('720')) return '1280x720';
  if (q.includes('480') || q === 'sd') return '640x360';
  if (q.includes('360')) return '640x360';
  return null;
}

function getMime(type: string): string | null {
  if (type === 'video') return 'video/mp4';
  if (type === 'image') return 'image/jpeg';
  if (type === 'audio') return 'audio/mp4';
  return null;
}

// ============================================================
// VIDEO EXTRACTION
// ============================================================

export function extractVideoUrls(
  fragment: string,
  seenUrls?: Set<string>,
  thumbnail?: string | null,
  index?: number
): RawFormat[] {
  seenUrls = seenUrls || new Set();
  thumbnail = thumbnail || null;
  index = index || 0;
  
  const formats: RawFormat[] = [];
  const found = new Set<string>();

  const add = (quality: string, url: string): void => {
    if (!url.includes('.mp4') && !isValidMediaUrl(url, 'video')) return;
    if (seenUrls!.has(url) || found.has(quality)) return;
    seenUrls!.add(url);
    found.add(quality);
    formats.push({ index: index!, quality, type: 'video', url, thumbnail });
  };

  // Priority 1: Native Browser URLs
  const hdNative = fragment.match(VIDEO_PATTERNS.nativeHD);
  const sdNative = fragment.match(VIDEO_PATTERNS.nativeSD);
  if (hdNative) add('HD', decodeUrl(hdNative[1]));
  if (sdNative) add('SD', decodeUrl(sdNative[1]));
  if (found.size > 0) return formats;

  // Priority 2: Playable URLs
  const hdPlay = fragment.match(VIDEO_PATTERNS.playableHD);
  const sdPlay = fragment.match(VIDEO_PATTERNS.playableSD);
  if (hdPlay) add('HD', decodeUrl(hdPlay[1]));
  if (sdPlay) add('SD', decodeUrl(sdPlay[1]));
  if (found.size > 0) return formats;

  // Priority 3: Source URLs
  const hdSrc = fragment.match(VIDEO_PATTERNS.hdSrc);
  const sdSrc = fragment.match(VIDEO_PATTERNS.sdSrc);
  if (hdSrc) add('HD', decodeUrl(hdSrc[1]));
  if (sdSrc) add('SD', decodeUrl(sdSrc[1]));
  if (found.size > 0) return formats;

  // Priority 4: DASH
  const dashMatches = extractAll(fragment, VIDEO_PATTERNS.dash);
  if (dashMatches.length > 0) {
    const dashVideos = dashMatches
      .map((m) => ({ height: parseInt(m[1], 10), url: decodeUrl(m[2]) }))
      .filter((v) => v.height >= 360)
      .sort((a, b) => b.height - a.height);

    const hd = dashVideos.find((v) => v.height >= 720);
    const sd = dashVideos.find((v) => v.height < 720 && v.height >= 360);
    if (hd) add(getQualityLabel(hd.height), hd.url);
    if (sd) add(getQualityLabel(sd.height), sd.url);
    if (found.size > 0) return formats;
  }

  // Priority 5: Progressive
  const progMatches = extractAll(fragment, VIDEO_PATTERNS.progressive, 5);
  for (let i = 0; i < progMatches.length; i++) {
    if (found.size >= 2) break;
    const url = decodeUrl(progMatches[i][1]);
    if (/\.mp4|scontent.*\/v\/|fbcdn.*\/v\//.test(url)) {
      const quality = /720|1080|_hd/i.test(url) || found.size === 0 ? 'HD' : 'SD';
      add(quality, url);
    }
  }

  return formats;
}

// ============================================================
// STORY EXTRACTION
// ============================================================

export function extractStories(html: string, seenUrls?: Set<string>): RawFormat[] {
  seenUrls = seenUrls || new Set();
  const formats: RawFormat[] = [];
  let itemIndex = 0;

  const videoMatches = extractAll(html, STORY_PATTERNS.video);
  const videoPairs: Array<{ url: string; isHD: boolean }> = [];

  for (let i = 0; i < videoMatches.length; i++) {
    const url = decodeUrl(videoMatches[i][1]);
    const isHD = videoMatches[i][2] === 'HD';
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      videoPairs.push({ url, isHD });
    }
  }

  if (videoPairs.length === 0) {
    const fallbackMatches = extractAll(html, STORY_PATTERNS.videoFallback);
    for (let i = 0; i < fallbackMatches.length; i++) {
      const url = decodeUrl(fallbackMatches[i][1]);
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        videoPairs.push({ url, isHD: /720p|1080p|_hd/.test(url) });
      }
    }
  }

  const thumbs: string[] = [];
  const thumbMatches = extractAll(html, STORY_PATTERNS.thumbnail);
  for (let i = 0; i < thumbMatches.length; i++) {
    const url = cleanJsonString(thumbMatches[i][1]);
    if (isValidMediaUrl(url, 'image') && thumbs.indexOf(url) === -1) {
      thumbs.push(url);
    }
  }

  const hasHD = videoPairs.some((v) => v.isHD);
  const hasSD = videoPairs.some((v) => !v.isHD);

  if (hasHD && hasSD) {
    const count = Math.ceil(videoPairs.length / 2);
    for (let i = 0; i < count; i++) {
      const pair = videoPairs.slice(i * 2, i * 2 + 2);
      const hd = pair.find((v) => v.isHD);
      const sd = pair.find((v) => !v.isHD);
      if (hd) formats.push({ index: itemIndex, quality: 'hd', type: 'video', url: hd.url, thumbnail: thumbs[i] || null });
      if (sd) formats.push({ index: itemIndex, quality: 'sd', type: 'video', url: sd.url, thumbnail: thumbs[i] || null });
      itemIndex++;
    }
  } else {
    for (let i = 0; i < videoPairs.length; i++) {
      const v = videoPairs[i];
      formats.push({ index: itemIndex, quality: v.isHD ? 'hd' : 'sd', type: 'video', url: v.url, thumbnail: thumbs[i] || null });
      itemIndex++;
    }
  }

  const storyImages: string[] = [];
  const imgMatches = extractAll(html, STORY_PATTERNS.image);
  for (let i = 0; i < imgMatches.length; i++) {
    const url = cleanJsonString(decodeUrl(imgMatches[i][0]));
    if (/s(1080|1440|2048)x/.test(url) && !seenUrls.has(url) && storyImages.indexOf(url) === -1) {
      storyImages.push(url);
    }
  }

  for (let i = 0; i < storyImages.length; i++) {
    seenUrls.add(storyImages[i]);
    formats.push({ index: itemIndex, quality: 'original', type: 'image', url: storyImages[i], thumbnail: storyImages[i] });
    itemIndex++;
  }

  return formats;
}

// ============================================================
// IMAGE EXTRACTION
// ============================================================

export function extractImageUrls(
  html: string,
  decoded: string,
  seenUrls?: Set<string>,
  targetPostId?: string | null
): RawFormat[] {
  seenUrls = seenUrls || new Set();
  const formats: RawFormat[] = [];
  const seenPaths = new Set<string>();
  let itemIndex = 0;

  const add = (imgUrl: string): boolean => {
    const path = imgUrl.split('?')[0];
    if (isSkipImage(imgUrl) || seenPaths.has(path)) return false;
    if (/t39\.30808-1\//.test(imgUrl)) return false;
    
    seenPaths.add(path);
    seenUrls!.add(imgUrl);
    formats.push({ index: itemIndex, quality: 'original', type: 'image', url: imgUrl, thumbnail: imgUrl });
    itemIndex++;
    return true;
  };

  // Try subattachments block
  const subStart = decoded.indexOf('"all_subattachments":{"count":');
  if (subStart > -1) {
    const countMatch = decoded.substring(subStart, subStart + 50).match(/"count":(\d+)/);
    const expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    
    const nodesStart = decoded.indexOf('"nodes":[', subStart);
    if (nodesStart > -1 && nodesStart - subStart < 100) {
      let depth = 1;
      let nodesEnd = nodesStart + 9;
      
      for (let i = nodesStart + 9; i < decoded.length && i < nodesStart + 30000; i++) {
        if (decoded[i] === '[') depth++;
        if (decoded[i] === ']') {
          depth--;
          if (depth === 0) { nodesEnd = i + 1; break; }
        }
      }
      
      const nodesBlock = decoded.substring(nodesStart, nodesEnd);
      const viewerMatches = extractAll(nodesBlock, IMAGE_PATTERNS.viewerImage);
      
      for (let i = 0; i < viewerMatches.length; i++) {
        const url = cleanJsonString(viewerMatches[i][3]);
        if (/scontent|fbcdn/.test(url) && /t39\.30808|t51\.82787/.test(url)) {
          add(url);
        }
      }
      
      if (itemIndex >= expectedCount && itemIndex > 0) return formats;
    }
  }

  // Fallback: viewer_image pattern
  if (itemIndex === 0) {
    const viewerMatches = extractAll(decoded, IMAGE_PATTERNS.viewerImage);
    const candidates: Array<{ url: string; size: number }> = [];
    
    for (let i = 0; i < viewerMatches.length; i++) {
      const height = parseInt(viewerMatches[i][1], 10);
      const width = parseInt(viewerMatches[i][2], 10);
      const url = cleanJsonString(viewerMatches[i][3]);
      
      if (/scontent|fbcdn/.test(url) && height >= 400 && width >= 400) {
        if (/t39\.30808|t51\.82787/.test(url) && !/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\//.test(url)) {
          candidates.push({ url, size: height * width });
        }
      }
    }
    
    candidates.sort((a, b) => b.size - a.size);
    const addedUrls = new Set<string>();
    
    for (let i = 0; i < candidates.length; i++) {
      const basePath = candidates[i].url.split('?')[0].replace(/_n\.jpg$/, '');
      if (!addedUrls.has(basePath)) {
        addedUrls.add(basePath);
        add(candidates[i].url);
      }
    }
  }

  // Fallback: photo_image pattern
  if (itemIndex === 0) {
    const photoMatches = extractAll(decoded, IMAGE_PATTERNS.photoImage, 5);
    for (let i = 0; i < photoMatches.length; i++) {
      const url = cleanJsonString(photoMatches[i][1]);
      if (/scontent|fbcdn/.test(url) && /t39\.30808-6/.test(url)) {
        add(url);
      }
    }
  }

  // Fallback: preload link
  if (itemIndex === 0) {
    const preloadMatch = html.match(IMAGE_PATTERNS.preload);
    if (preloadMatch) add(cleanJsonString(preloadMatch[1]));
  }

  // Fallback: image.uri pattern
  if (itemIndex === 0) {
    const imageUriMatches = extractAll(decoded, IMAGE_PATTERNS.imageUri, 3);
    for (let i = 0; i < imageUriMatches.length; i++) {
      const url = cleanJsonString(imageUriMatches[i][1]);
      if (/scontent|fbcdn/.test(url) && !/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\//.test(url)) {
        add(url);
      }
    }
  }

  // Last resort: t39.30808 URLs
  if (itemIndex === 0) {
    const t39Matches = extractAll(decoded, IMAGE_PATTERNS.t39, 5);
    let count = 0;
    for (let i = 0; i < t39Matches.length; i++) {
      if (count >= 5) break;
      const url = decodeUrl(t39Matches[i][0]);
      if (!/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\/|_s\d+x\d+|\/s\d{2,3}x\d{2,3}\//.test(url)) {
        if (add(url)) count++;
      }
    }
  }

  return formats;
}



// ============================================================
// METADATA EXTRACTION
// ============================================================

export function extractMetadata(html: string, url: string): ExtractedMetadata {
  const metadata: ExtractedMetadata = { 
    author: null, 
    description: null, 
    thumbnail: null, 
    uploadDate: null, 
    engagement: {} 
  };
  const isStory = CONTENT_TYPE_PATTERNS.story.test(url);

  const decode = (s: string): string => {
    return s.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => {
      return String.fromCharCode(parseInt(h, 16));
    });
  };

  // Story author patterns
  if (isStory && METADATA_PATTERNS.storyAuthor) {
    for (let i = 0; i < METADATA_PATTERNS.storyAuthor.length; i++) {
      const match = html.match(METADATA_PATTERNS.storyAuthor[i]);
      if (match && match[1] && match[1] !== 'Facebook' && !/^(User|Page|Video|Photo|Post)$/i.test(match[1])) {
        metadata.author = decode(match[1]);
        break;
      }
    }
  }

  // Regular author patterns
  if (!metadata.author) {
    for (let i = 0; i < METADATA_PATTERNS.author.length; i++) {
      const match = html.match(METADATA_PATTERNS.author[i]);
      if (match && match[1] && match[1] !== 'Facebook' && !/^(User|Page|Video|Photo|Post)$/i.test(match[1])) {
        metadata.author = decode(match[1]);
        break;
      }
    }
  }

  // URL fallback for stories
  if (!metadata.author && isStory) {
    const storyUrlMatch = url.match(/\/stories\/([^/?]+)/);
    if (storyUrlMatch && storyUrlMatch[1] !== 'stories') {
      const userPart = storyUrlMatch[1];
      if (!/^\d+$/.test(userPart)) {
        metadata.author = userPart.replace(/\./g, ' ');
      }
    }
  }

  // URL fallback
  if (!metadata.author) {
    const urlMatch = url.match(/facebook\.com\/([^/?]+)/);
    if (urlMatch && ['watch', 'reel', 'share', 'groups', 'www', 'web', 'stories'].indexOf(urlMatch[1]) === -1) {
      metadata.author = urlMatch[1];
    }
  }

  // Description
  for (let i = 0; i < METADATA_PATTERNS.description.length; i++) {
    const match = html.match(METADATA_PATTERNS.description[i]);
    if (match && match[1] && match[1].length > 2) {
      metadata.description = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      break;
    }
  }

  // Thumbnail
  const thumbMatch = html.match(METADATA_PATTERNS.thumbnail);
  if (thumbMatch && /scontent|fbcdn/.test(thumbMatch[1])) {
    metadata.thumbnail = cleanJsonString(thumbMatch[1]);
  }

  // Upload date
  const timeMatch = html.match(METADATA_PATTERNS.creationTime);
  if (timeMatch) {
    metadata.uploadDate = new Date(parseInt(timeMatch[1], 10) * 1000).toISOString();
  }

  // Engagement parser
  const parseEngagement = (s: string | undefined): number => {
    if (!s) return 0;
    let str = s.trim().toLowerCase();
    
    if (str.indexOf('rb') > -1) {
      const num = parseFloat(str.replace(/[^\d,\.]/g, '').replace(',', '.'));
      return Math.round(num * 1000);
    }
    if (str.indexOf('jt') > -1) {
      const num = parseFloat(str.replace(/[^\d,\.]/g, '').replace(',', '.'));
      return Math.round(num * 1000000);
    }
    
    const n = parseFloat(str.replace(/,/g, '').replace(/[^\d\.]/g, ''));
    if (isNaN(n)) return 0;
    if (/k/.test(str)) return Math.round(n * 1000);
    if (/m/.test(str)) return Math.round(n * 1000000);
    if (/b/.test(str)) return Math.round(n * 1000000000);
    return Math.round(n);
  };

  // Likes
  for (let i = 0; i < METADATA_PATTERNS.likes.length; i++) {
    const match = html.match(METADATA_PATTERNS.likes[i]);
    if (match) { metadata.engagement.likes = parseEngagement(match[1]); break; }
  }

  // Comments
  for (let i = 0; i < METADATA_PATTERNS.comments.length; i++) {
    const match = html.match(METADATA_PATTERNS.comments[i]);
    if (match) { metadata.engagement.comments = parseEngagement(match[1]); break; }
  }

  // Shares
  for (let i = 0; i < METADATA_PATTERNS.shares.length; i++) {
    const match = html.match(METADATA_PATTERNS.shares[i]);
    if (match) { metadata.engagement.shares = parseEngagement(match[1]); break; }
  }

  // Views
  for (let i = 0; i < METADATA_PATTERNS.views.length; i++) {
    const match = html.match(METADATA_PATTERNS.views[i]);
    if (match) { metadata.engagement.views = parseEngagement(match[1]); break; }
  }
  
  // Fallback: extract stats from title
  const titleMatch = html.match(/property="og:title"\s+content="([^"]+)"/) ||
                     html.match(/"title":\{"text":"([^"]+)"/);
  if (titleMatch) {
    const titleText = titleMatch[1];
    
    // Views from title
    if (!metadata.engagement.views) {
      const viewMatch = titleText.match(/([\d.,]+[KMB]?)\s*(?:views|Views|lượt xem|tayangan|次观看|回視聴)/i);
      if (viewMatch) metadata.engagement.views = parseEngagement(viewMatch[1]);
    }
    
    // Likes/reactions from title
    if (!metadata.engagement.likes) {
      const likeMatch = titleText.match(/([\d.,]+[KMB]?)\s*(?:reactions|likes|reaksi|lượt thích)/i);
      if (likeMatch) metadata.engagement.likes = parseEngagement(likeMatch[1]);
    }
    
    // Comments from title
    if (!metadata.engagement.comments) {
      const commentMatch = titleText.match(/([\d.,]+[KMB]?)\s*(?:comments|komentar|bình luận)/i);
      if (commentMatch) metadata.engagement.comments = parseEngagement(commentMatch[1]);
    }
    
    // Shares from title
    if (!metadata.engagement.shares) {
      const shareMatch = titleText.match(/([\d.,]+[KMB]?)\s*(?:shares|bagikan|chia sẻ)/i);
      if (shareMatch) metadata.engagement.shares = parseEngagement(shareMatch[1]);
    }
  }

  // Debug: log engagement extraction result
  if (Object.keys(metadata.engagement).length > 0) {
    logger.debug('facebook', 'Engagement found', metadata.engagement);
  } else {
    logger.debug('facebook', 'No engagement data found');
  }

  return metadata;
}

// ============================================================
// ID EXTRACTION
// ============================================================

export function extractVideoId(url: string): string | null {
  const match = url.match(ID_PATTERNS.video);
  return match ? match[1] : null;
}

export function extractPostId(url: string): string | null {
  for (let i = 0; i < ID_PATTERNS.post.length; i++) {
    const match = url.match(ID_PATTERNS.post[i]);
    if (match) return match[1];
  }
  return null;
}

// ============================================================
// OUTPUT BUILDERS
// ============================================================

function groupFormatsToItems(formats: RawFormat[], defaultThumbnail: string | null): MediaItem[] {
  const itemsMap = new Map<number, MediaItem>();

  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    const idx = format.index !== undefined ? format.index : 0;
    
    if (!itemsMap.has(idx)) {
      itemsMap.set(idx, {
        index: idx,
        type: format.type || 'video',
        thumbnail: format.thumbnail || defaultThumbnail || undefined,
        sources: []
      });
    }

    const item = itemsMap.get(idx)!;
    const quality = (format.quality || 'sd').toLowerCase();
    
    const source: MediaSource = { quality, url: format.url };
    
    const resolution = format.resolution || getResolution(quality);
    if (resolution) source.resolution = resolution;
    
    const mime = format.mime || getMime(format.type);
    if (mime) source.mime = mime;
    
    if (format.size) source.size = format.size;

    item.sources.push(source);

    if (format.thumbnail && !item.thumbnail) {
      item.thumbnail = format.thumbnail;
    }
  }

  const items = Array.from(itemsMap.values())
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      item.sources.sort((a, b) => {
        const order: Record<string, number> = { hd: 0, sd: 1, original: 2, audio: 3 };
        const orderA = order[a.quality] !== undefined ? order[a.quality] : 99;
        const orderB = order[b.quality] !== undefined ? order[b.quality] : 99;
        return orderA - orderB;
      });
      return item;
    });

  return items;
}

export function deduplicateFormats(formats: RawFormat[]): RawFormat[] {
  const seen = new Set<string>();
  return formats.filter((format) => {
    if (seen.has(format.url)) return false;
    seen.add(format.url);
    return true;
  });
}

export function buildExtractResult(data: BuildExtractResultData): ExtractResultSuccess {
  const { formats, metadata, contentType: urlContentType, id } = data;

  const uniqueFormats = deduplicateFormats(formats);
  const defaultThumbnail = metadata.thumbnail || null;
  const items = groupFormatsToItems(uniqueFormats, defaultThumbnail);

  let title = metadata.title || 'Facebook Post';
  title = decodeHtmlEntities(title);
  title = title.replace(/^[\d.]+K?\s*views.*?\|\s*/i, '').trim();
  
  if (urlContentType === 'story' && metadata.author) {
    title = metadata.author + "'s Stories";
  } else if ((title === 'Facebook' || title === 'Facebook Post') && metadata.description) {
    title = metadata.description.length > 80 
      ? metadata.description.substring(0, 80) + '...' 
      : metadata.description;
  }
  
  if (title.length > 100) {
    title = title.substring(0, 100) + '...';
  }

  const result: ExtractResultSuccess = {
    success: true,
    platform: 'facebook',
    contentType: urlContentType || 'video',
    title,
    items
  };

  if (metadata.author) result.author = metadata.author;
  if (id) result.id = id;
  if (metadata.description) result.description = metadata.description;
  if (metadata.uploadDate) result.uploadDate = metadata.uploadDate;

  if (metadata.engagement && Object.keys(metadata.engagement).length > 0) {
    const stats: EngagementStats = {};
    if (metadata.engagement.views) stats.views = metadata.engagement.views;
    if (metadata.engagement.likes) stats.likes = metadata.engagement.likes;
    if (metadata.engagement.comments) stats.comments = metadata.engagement.comments;
    if (metadata.engagement.shares) stats.shares = metadata.engagement.shares;
    
    if (Object.keys(stats).length > 0) {
      result.stats = stats;
    }
  }

  logger.media('facebook', {
    items: items.length,
    totalSources: items.reduce((sum, i) => sum + i.sources.length, 0)
  });

  return result;
}

export function buildErrorResult(code: string, message: string): ExtractResultError {
  return {
    success: false,
    error: { code, message }
  };
}

