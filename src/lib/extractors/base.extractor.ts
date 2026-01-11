/**
 * Base Extractor class
 * All platform extractors should extend this class
 * TypeScript conversion of base.extractor.js
 */

import type { ExtractResult, ExtractError, ResponseMeta } from '@/types/extract';

/**
 * Extraction options
 */
export interface ExtractOptions {
  signal?: AbortSignal;
  timeout?: number;
  cookie?: string;
}

/**
 * Internal extraction result (before meta is added)
 */
export interface InternalExtractResult {
  success: true;
  platform: string;
  contentType: string;
  title?: string;
  author?: string;
  /** Display name for author (may contain non-ASCII) - used for UI display */
  authorDisplay?: string;
  id?: string;
  description?: string;
  uploadDate?: string;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  items: Array<{
    index: number;
    type: 'video' | 'image' | 'audio';
    thumbnail?: string;
    /** Short hash for thumbnail proxy URL (16 chars) */
    thumbnailHash?: string;
    sources: Array<{
      quality: string;
      url: string;
      resolution?: string;
      mime?: string;
      size?: number;
      filename?: string;
      hash?: string;
    }>;
  }>;
  usedCookie?: boolean;
}

/**
 * Internal error result (before meta is added)
 */
export interface InternalExtractError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Union type for internal extraction responses
 */
export type InternalExtractResponse = InternalExtractResult | InternalExtractError;

/**
 * Base extractor interface
 * All platform extractors should extend this class
 */
export abstract class BaseExtractor {
  /**
   * Platform identifier
   */
  static platform: string = 'base';

  /**
   * URL patterns that this extractor handles
   */
  static patterns: RegExp[] = [];

  /**
   * Check if URL matches this extractor's patterns
   * @param url - URL to check
   * @returns True if matches
   */
  static match(url: string): boolean {
    return this.patterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract media from URL
   * @param url - URL to extract from
   * @param options - Extraction options
   * @returns Extraction result
   */
  abstract extract(url: string, options?: ExtractOptions): Promise<InternalExtractResponse>;

  /**
   * Refresh expired media URL (optional)
   * @param mediaId - Media ID
   * @returns Refreshed result
   */
  async refresh(mediaId: string): Promise<InternalExtractResponse> {
    throw new Error('refresh() not implemented');
  }
}

/**
 * Type for extractor class constructor
 */
export interface ExtractorClass {
  platform: string;
  patterns: RegExp[];
  match(url: string): boolean;
  new (): BaseExtractor;
}

