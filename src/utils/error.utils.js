/**
 * Custom error classes and error codes
 * Based on PROPOSAL.md section 15
 */

/**
 * Error codes enum
 */
export const ErrorCode = {
  // Platform detection
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
  INVALID_URL: 'INVALID_URL',
  
  // Network
  FETCH_FAILED: 'FETCH_FAILED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Content issues
  AGE_RESTRICTED: 'AGE_RESTRICTED',
  PRIVATE_CONTENT: 'PRIVATE_CONTENT',
  DELETED_CONTENT: 'DELETED_CONTENT',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  STORY_EXPIRED: 'STORY_EXPIRED',
  
  // Extraction
  NO_MEDIA_FOUND: 'NO_MEDIA_FOUND',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT'
};

/**
 * Error messages mapping
 */
export const ErrorMessage = {
  [ErrorCode.UNSUPPORTED_PLATFORM]: 'Platform tidak didukung',
  [ErrorCode.INVALID_URL]: 'URL tidak valid',
  [ErrorCode.FETCH_FAILED]: 'Gagal mengambil halaman',
  [ErrorCode.TIMEOUT]: 'Request timeout',
  [ErrorCode.RATE_LIMITED]: 'Terlalu banyak request, coba lagi nanti',
  [ErrorCode.AGE_RESTRICTED]: 'Konten dibatasi usia (18+)',
  [ErrorCode.PRIVATE_CONTENT]: 'Konten privat atau tidak tersedia',
  [ErrorCode.DELETED_CONTENT]: 'Konten sudah dihapus',
  [ErrorCode.LOGIN_REQUIRED]: 'Perlu login untuk akses konten ini',
  [ErrorCode.STORY_EXPIRED]: 'Story sudah expired atau dihapus',
  [ErrorCode.NO_MEDIA_FOUND]: 'Tidak ditemukan media',
  [ErrorCode.EXTRACTION_FAILED]: 'Gagal mengekstrak media',
  [ErrorCode.UNSUPPORTED_FORMAT]: 'Format media tidak didukung'
};

/**
 * Base extractor error
 */
export class ExtractorError extends Error {
  constructor(code, message, details = {}) {
    super(message || ErrorMessage[code] || 'Unknown error');
    this.name = 'ExtractorError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
}

/**
 * Network-related error
 */
export class NetworkError extends ExtractorError {
  constructor(message, details = {}) {
    super(ErrorCode.FETCH_FAILED, message, details);
    this.name = 'NetworkError';
  }
}

/**
 * Content issue error
 */
export class ContentError extends ExtractorError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'ContentError';
  }
}

/**
 * Helper to create error response
 */
export function createErrorResponse(code, message, details = {}) {
  return {
    success: false,
    error: {
      code,
      message: message || ErrorMessage[code] || 'Unknown error',
      details
    }
  };
}
