/**
 * API Types
 * Request and response types for all API endpoints
 */

import type { ExtractResponse, ResponseMeta } from './extract';

/**
 * POST /api/v1/extract request body
 */
export interface ExtractRequest {
  url: string;
  cookie?: string;
}

/**
 * POST /api/v1/extract response
 */
export type ExtractApiResponse = ExtractResponse;

/**
 * GET /api/v1/stream query parameters
 */
export interface StreamRequest {
  url: string;
}

/**
 * GET /api/v1/download query parameters
 */
export interface DownloadRequest {
  url: string;
  filename?: string;
}

/**
 * GET /api/v1/status response
 */
export interface StatusResponse {
  success: true;
  status: 'online' | 'degraded' | 'offline';
  version: string;
  uptime: number;
  extractors: string[];
  meta: ResponseMeta;
}

/**
 * GET /api/health response
 */
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: number;
  runtime?: string;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta: ResponseMeta;
}
