/**
 * Pixiv Extractor - Native TypeScript implementation
 * 
 * Uses Pixiv's internal AJAX API directly (no gallery-dl/yt-dlp needed)
 * 
 * API Endpoints:
 * - /ajax/illust/{id} - Get artwork metadata (title, author, type, page count)
 * - /ajax/illust/{id}/pages - Get all page URLs for multi-page artworks
 * 
 * Image Access:
 * - Images require Referer: https://www.pixiv.net/ header
 * - Original quality: i.pximg.net/img-original/...
 * - Regular quality: i.pximg.net/img-master/..._master1200.jpg
 */

import { BaseExtractor } from '../base.extractor';
import type { ExtractOptions, InternalExtractResponse, InternalExtractResult } from '../base.extractor';
import { ErrorCode } from '@/lib/utils/error.utils';
import { logger } from '@/lib/utils/logger';
import { fetchText, getFileSizes } from '@/lib/core/network/client';

// ============================================
// Types
// ============================================

interface PixivIllustResponse {
  error: boolean;
  message: string;
  body?: {
    id: string;
    title: string;
    description: string;
    illustType: number; // 0=illust, 1=manga, 2=ugoira
    createDate: string;
    uploadDate: string;
    pageCount: number;
    width: number;
    height: number;
    userId: string;
    userName: string;
    likeCount: number;
    bookmarkCount: number;
    viewCount: number;
    commentCount: number;
    urls: {
      mini: string;
      thumb: string;
      small: string;
      regular: string;
      original: string;
    };
    tags: {
      tags: Array<{ tag: string; translation?: { en?: string } }>;
    };
    xRestrict: number; // 0=all-ages, 1=R-18, 2=R-18G
  };
}

interface PixivPagesResponse {
  error: boolean;
  message: string;
  body?: Array<{
    urls: {
      thumb_mini: string;
      small: string;
      regular: string;
      original: string;
    };
    width: number;
    height: number;
  }>;
}

// ============================================
// Constants
// ============================================

const PIXIV_API_BASE = 'https://www.pixiv.net';
const PIXIV_REFERER = 'https://www.pixiv.net/';

// ============================================
// Helpers
// ============================================

/**
 * Extract artwork ID from Pixiv URL
 */
function extractArtworkId(url: string): string | null {
  // Patterns:
  // - pixiv.net/artworks/12345
  // - pixiv.net/en/artworks/12345
  // - pixiv.net/member_illust.php?illust_id=12345
  // - pixiv.net/i/12345
  
  const patterns = [
    /pixiv\.net\/(?:en\/)?artworks\/(\d+)/i,
    /pixiv\.net\/member_illust\.php\?.*illust_id=(\d+)/i,
    /pixiv\.net\/i\/(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Get quality label from URL
 */
function getQualityFromUrl(url: string): string {
  if (url.includes('img-original')) return 'original';
  if (url.includes('master1200')) return '1200px';
  if (url.includes('_small')) return 'small';
  if (url.includes('_thumb')) return 'thumb';
  return 'original';
}

/**
 * Get MIME type from URL
 */
function getMimeFromUrl(url: string): string {
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.gif')) return 'image/gif';
  if (url.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

// ============================================
// API Functions
// ============================================

/**
 * Fetch artwork metadata from Pixiv API
 */
async function fetchIllustInfo(
  artworkId: string,
  signal?: AbortSignal
): Promise<{ success: true; data: NonNullable<PixivIllustResponse['body']> } | { success: false; error: { code: string; message: string } }> {
  const url = `${PIXIV_API_BASE}/ajax/illust/${artworkId}`;
  
  try {
    const { data, status } = await fetchText(url, {
      headers: {
        'Accept': 'application/json',
        'Referer': PIXIV_REFERER,
      },
      signal,
    });
    
    if (status === 404) {
      return { success: false, error: { code: ErrorCode.DELETED_CONTENT, message: 'Artwork not found' } };
    }
    if (status >= 400) {
      return { success: false, error: { code: ErrorCode.FETCH_FAILED, message: `HTTP ${status}` } };
    }
    
    const json: PixivIllustResponse = JSON.parse(data);
    
    if (json.error || !json.body) {
      // Check for specific error messages
      const msg = json.message?.toLowerCase() || '';
      if (msg.includes('not found') || msg.includes('deleted')) {
        return { success: false, error: { code: ErrorCode.DELETED_CONTENT, message: json.message || 'Artwork not found' } };
      }
      if (msg.includes('private') || msg.includes('restricted')) {
        return { success: false, error: { code: ErrorCode.PRIVATE_CONTENT, message: json.message || 'Artwork is private' } };
      }
      return { success: false, error: { code: ErrorCode.EXTRACTION_FAILED, message: json.message || 'Failed to fetch artwork' } };
    }
    
    return { success: true, data: json.body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort')) {
      return { success: false, error: { code: ErrorCode.TIMEOUT, message: 'Request aborted' } };
    }
    return { success: false, error: { code: ErrorCode.FETCH_FAILED, message } };
  }
}

/**
 * Fetch all pages for multi-page artwork
 */
async function fetchIllustPages(
  artworkId: string,
  signal?: AbortSignal
): Promise<{ success: true; data: NonNullable<PixivPagesResponse['body']> } | { success: false; error: { code: string; message: string } }> {
  const url = `${PIXIV_API_BASE}/ajax/illust/${artworkId}/pages`;
  
  try {
    const { data, status } = await fetchText(url, {
      headers: {
        'Accept': 'application/json',
        'Referer': PIXIV_REFERER,
      },
      signal,
    });
    
    if (status >= 400) {
      return { success: false, error: { code: ErrorCode.FETCH_FAILED, message: `HTTP ${status}` } };
    }
    
    const json: PixivPagesResponse = JSON.parse(data);
    
    if (json.error || !json.body) {
      return { success: false, error: { code: ErrorCode.EXTRACTION_FAILED, message: json.message || 'Failed to fetch pages' } };
    }
    
    return { success: true, data: json.body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: { code: ErrorCode.FETCH_FAILED, message } };
  }
}

// ============================================
// Extractor Class
// ============================================

export class PixivExtractor extends BaseExtractor {
  static platform = 'pixiv';
  
  static patterns: RegExp[] = [
    /pixiv\.net\/(?:en\/)?artworks\/\d+/i,
    /pixiv\.net\/member_illust\.php\?.*illust_id=\d+/i,
    /pixiv\.net\/i\/\d+/i,
  ];

  async extract(url: string, options: ExtractOptions = {}): Promise<InternalExtractResponse> {
    const startTime = Date.now();
    const { signal } = options;

    try {
      // Extract artwork ID
      const artworkId = extractArtworkId(url);
      if (!artworkId) {
        return {
          success: false,
          error: { code: ErrorCode.INVALID_URL, message: 'Could not extract artwork ID from URL' },
        };
      }

      logger.info('pixiv', 'Starting extraction', { artworkId });

      // Fetch artwork metadata
      const illustResult = await fetchIllustInfo(artworkId, signal);
      if (!illustResult.success) {
        return { success: false, error: illustResult.error };
      }

      const illust = illustResult.data;
      
      // Check if it's ugoira (animated) - not supported yet
      if (illust.illustType === 2) {
        return {
          success: false,
          error: { code: ErrorCode.UNSUPPORTED_FORMAT, message: 'Animated illustrations (ugoira) are not supported yet' },
        };
      }

      // For multi-page artworks, fetch all pages
      let pages: NonNullable<PixivPagesResponse['body']> = [];
      if (illust.pageCount > 1) {
        const pagesResult = await fetchIllustPages(artworkId, signal);
        if (pagesResult.success) {
          pages = pagesResult.data;
        }
      }

      // Build items array
      const items: InternalExtractResult['items'] = [];
      
      if (pages.length > 0) {
        // Multi-page artwork
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          items.push({
            index: i,
            type: 'image',
            thumbnail: page.urls.small,
            sources: [
              {
                quality: 'original',
                url: page.urls.original,
                resolution: `${page.width}x${page.height}`,
                mime: getMimeFromUrl(page.urls.original),
                needsProxy: true, // Pixiv requires Referer header
              },
            ],
          });
        }
      } else {
        // Single page artwork
        items.push({
          index: 0,
          type: 'image',
          thumbnail: illust.urls.small,
          sources: [
            {
              quality: 'original',
              url: illust.urls.original,
              resolution: `${illust.width}x${illust.height}`,
              mime: getMimeFromUrl(illust.urls.original),
              needsProxy: true, // Pixiv requires Referer header
            },
          ],
        });
      }

      // Build tags string for description
      const tags = illust.tags.tags
        .map(t => t.translation?.en || t.tag)
        .slice(0, 10)
        .join(', ');

      // Fetch file sizes for all sources (with Referer header)
      const allUrls = items.flatMap(item => item.sources.map(s => s.url));
      const sizes = await getFileSizes(allUrls, 3000, { 'Referer': PIXIV_REFERER });
      
      // Apply sizes to sources
      for (const item of items) {
        for (const source of item.sources) {
          const size = sizes.get(source.url);
          if (size) source.size = size;
        }
      }

      logger.complete('pixiv', Date.now() - startTime);

      return {
        success: true,
        platform: 'pixiv',
        contentType: illust.pageCount > 1 ? 'gallery' : 'image',
        title: illust.title,
        author: illust.userId,
        authorDisplay: illust.userName,
        id: illust.id,
        description: tags || illust.description?.slice(0, 200),
        uploadDate: illust.uploadDate,
        stats: {
          views: illust.viewCount,
          likes: illust.likeCount,
          comments: illust.commentCount,
        },
        items,
      };

    } catch (error) {
      logger.error('pixiv', 'Extraction failed', error as Error);
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: { code: ErrorCode.EXTRACTION_FAILED, message },
      };
    }
  }
}

export default PixivExtractor;
