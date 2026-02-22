/**
 * Custom error classes and error codes
 * TypeScript conversion of error.utils.js
 */

/**
 * Error codes enum
 */
export enum ErrorCode {
  // Platform detection
  UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
  INVALID_URL = 'INVALID_URL',
  PLATFORM_UNAVAILABLE_ON_DEPLOYMENT = 'PLATFORM_UNAVAILABLE_ON_DEPLOYMENT',
  
  // Network
  FETCH_FAILED = 'FETCH_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Content issues
  AGE_RESTRICTED = 'AGE_RESTRICTED',
  PRIVATE_CONTENT = 'PRIVATE_CONTENT',
  DELETED_CONTENT = 'DELETED_CONTENT',
  LOGIN_REQUIRED = 'LOGIN_REQUIRED',
  STORY_EXPIRED = 'STORY_EXPIRED',
  
  // Extraction
  NO_MEDIA_FOUND = 'NO_MEDIA_FOUND',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT'
}

/**
 * Error messages mapping
 */
export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.UNSUPPORTED_PLATFORM]: 'Platform not supported',
  [ErrorCode.INVALID_URL]: 'Invalid URL format',
  [ErrorCode.PLATFORM_UNAVAILABLE_ON_DEPLOYMENT]: 'Platform is unavailable on this deployment',
  [ErrorCode.FETCH_FAILED]: 'Failed to fetch page',
  [ErrorCode.TIMEOUT]: 'Request timed out',
  [ErrorCode.RATE_LIMITED]: 'Too many requests, please try again later',
  [ErrorCode.AGE_RESTRICTED]: 'Content is age-restricted (18+)',
  [ErrorCode.PRIVATE_CONTENT]: 'Content is private or unavailable',
  [ErrorCode.DELETED_CONTENT]: 'Content has been deleted',
  [ErrorCode.LOGIN_REQUIRED]: 'Login required to access this content',
  [ErrorCode.STORY_EXPIRED]: 'Story has expired or been deleted',
  [ErrorCode.NO_MEDIA_FOUND]: 'No media found',
  [ErrorCode.EXTRACTION_FAILED]: 'Failed to extract media',
  [ErrorCode.UNSUPPORTED_FORMAT]: 'Media format not supported'
};

/**
 * Error details interface
 */
export interface ErrorDetails {
  [key: string]: unknown;
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
}

/**
 * Base extractor error
 */
export class ExtractorError extends Error {
  public readonly code: ErrorCode;
  public readonly details: ErrorDetails;

  constructor(code: ErrorCode, message?: string, details: ErrorDetails = {}) {
    super(message || ErrorMessage[code] || 'Unknown error');
    this.name = 'ExtractorError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: Object.keys(this.details).length > 0 ? this.details : undefined
      }
    };
  }
}

/**
 * Network-related error
 */
export class NetworkError extends ExtractorError {
  constructor(message?: string, details: ErrorDetails = {}) {
    super(ErrorCode.FETCH_FAILED, message, details);
    this.name = 'NetworkError';
  }
}

/**
 * Content issue error
 */
export class ContentError extends ExtractorError {
  constructor(code: ErrorCode, message?: string, details: ErrorDetails = {}) {
    super(code, message, details);
    this.name = 'ContentError';
  }
}

/**
 * Helper to create error response
 */
export function createErrorResponse(
  code: ErrorCode | string,
  message?: string,
  details: ErrorDetails = {}
): ErrorResponse {
  const errorCode = code as ErrorCode;
  return {
    success: false,
    error: {
      code,
      message: message || ErrorMessage[errorCode] || 'Unknown error',
      details: Object.keys(details).length > 0 ? details : undefined
    }
  };
}
