import type { ExtractError, ExtractResult } from '@/types/extract';

export type SupportedPlatform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'pixiv'
  | 'youtube'
  | 'bilibili'
  | 'soundcloud'
  | 'twitch'
  | 'bandcamp'
  | 'reddit'
  | 'pinterest'
  | 'weibo'
  | 'eporner'
  | 'rule34video';

export interface ExtractionRequest {
  url: string;
  cookie?: string;
}

export type ExtractionResult = ExtractResult | ExtractError;

export type PlatformExtractor = (request: ExtractionRequest) => Promise<ExtractionResult>;
