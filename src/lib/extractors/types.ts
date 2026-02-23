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

export interface ExtractionError {
  code: string;
  message: string;
}

export interface MediaSource {
  quality: string;
  url: string;
  mime?: string;
  extension?: string;
  filename?: string;
  size?: number;
  resolution?: string;
  hasAudio?: boolean;
  needsMerge?: boolean;
  codec?: string;
  bitrate?: number;
  fps?: number;
  format?: string;
  needsProxy?: boolean;
}

export interface MediaItem {
  index: number;
  type: 'video' | 'audio' | 'image';
  thumbnail?: string;
  sources: MediaSource[];
  title?: string;
  duration?: number;
}

export interface ExtractionResult {
  success: boolean;
  error?: ExtractionError;
  platform?: SupportedPlatform | string;
  contentType?: 'video' | 'audio' | 'image' | 'gallery' | string;
  title?: string;
  author?: string;
  id?: string;
  description?: string;
  uploadDate?: string;
  duration?: number;
  items?: MediaItem[];
  [key: string]: unknown;
}

export type ExtractorFunction = (request: ExtractionRequest) => Promise<ExtractionResult>;
