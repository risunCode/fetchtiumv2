/**
 * Utils Index
 * Re-exports all utility modules
 */

// Error utilities
export {
  ErrorCode,
  ErrorMessage,
  ExtractorError,
  NetworkError,
  ContentError,
  createErrorResponse,
  type ErrorDetails,
  type ErrorResponse
} from './error.utils';

// URL utilities
export {
  normalizeUrl,
  isValidUrl,
  isKnownPattern,
  extractDomain,
  parseUrl,
  type ParsedUrl
} from './url.utils';

// URL store
export {
  addUrl,
  addUrls,
  isValidUrl as isStoredUrl,
  cleanup as cleanupUrlStore,
  getStats as getUrlStoreStats,
  clear as clearUrlStore,
  startCleanupInterval,
  stopCleanupInterval,
  type UrlStoreStats
} from './url-store';

// Filename utilities
export {
  sanitize,
  generateFilename,
  addFilenames,
  type FilenameOptions
} from './filename.utils';

// Response utilities
export {
  normalizeStats,
  buildMeta,
  buildResponse,
  buildErrorResponse,
  type RawStats,
  type MetaOptions,
  type RawExtractResult
} from './response.utils';

// MIME helper
export {
  analyze as analyzeMime,
  getMimeFromExtension,
  getExtensionFromMime,
  isSupported as isMimeSupported,
  isStreamable,
  isPlaylist,
  type MediaAnalysisContext,
  type MediaAnalysisResult,
  type MediaKind
} from './mime.helper';

// Logger
export {
  logger,
  type LogLevel,
  type LogData
} from './logger';

// Quality utilities
export {
  QUALITY_THRESHOLDS,
  getQualityInfo,
  getQualityFromBitrate,
  getResolutionFromBitrate,
  type QualityThreshold,
  type QualityInfo
} from './quality.utils';

// Platform headers utilities
export {
  COMMON_USER_AGENT,
  isBiliBiliUrl,
  isYouTubeUrl,
  getPlatformHeaders,
  buildFFmpegHeadersString,
  type PlatformHeaders
} from './platform-headers';

// Merge helper utilities
export {
  buildMergeUrl,
  needsMerge,
  findBestAudio,
  type MergeUrlOptions
} from './merge.helper';
