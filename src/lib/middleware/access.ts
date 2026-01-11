/**
 * Access Control Helpers
 * 
 * Implements public/private access modes:
 * - Public mode: Origin/Referer check (website only)
 * - Private mode: API key via ?key=xxx or X-API-Key header
 */

import { logger } from '@/lib/utils/logger';

/**
 * Default allowed origins for development
 */
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

/**
 * Get allowed origins from environment
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (!envOrigins) return DEFAULT_ORIGINS;
  return envOrigins.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Get API keys from environment
 */
function getApiKeys(): string[] {
  const envKeys = process.env.API_KEYS;
  if (!envKeys) return [];
  return envKeys.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Check if origin is in allowed list
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * Check if API key is valid
 */
export function isValidApiKey(key: string | null): boolean {
  if (!key) return false;
  const apiKeys = getApiKeys();
  return apiKeys.includes(key);
}

export type AccessMode = 'public' | 'private' | 'denied';

export interface AccessCheckResult {
  allowed: boolean;
  mode: AccessMode;
  apiKey?: string;
  reason?: string;
}

/**
 * Check access for a request
 * 
 * Flow:
 * 1. Check for API key (private mode)
 * 2. If no key, check Origin header (public mode)
 * 3. If neither, deny access
 */
export function checkAccess(
  origin: string | null,
  referer: string | null,
  apiKey: string | null
): AccessCheckResult {
  // Private mode: validate API key
  if (apiKey) {
    if (isValidApiKey(apiKey)) {
      logger.debug('access', 'Private mode access granted', { 
        keyPrefix: apiKey.substring(0, 4) + '...' 
      });
      return {
        allowed: true,
        mode: 'private',
        apiKey
      };
    }
    
    logger.warn('access', 'Invalid API key attempt', { 
      keyPrefix: apiKey.substring(0, 4) + '...'
    });
    
    return {
      allowed: false,
      mode: 'denied',
      reason: 'Invalid API key'
    };
  }
  
  // Public mode: check origin or referer
  const originToCheck = origin || referer;
  
  if (originToCheck && isAllowedOrigin(originToCheck)) {
    logger.debug('access', 'Public mode access granted', { origin: originToCheck });
    return {
      allowed: true,
      mode: 'public'
    };
  }
  
  // No key, no valid origin - deny access
  logger.warn('access', 'Access denied - no key or valid origin', {
    origin: originToCheck || 'none'
  });
  
  return {
    allowed: false,
    mode: 'denied',
    reason: 'API key required for external access'
  };
}

/**
 * Routes that allow public access without origin check
 * These are typically proxy routes that need to work from any context
 */
const PUBLIC_ROUTES = [
  '/api/v1/stream',
  '/api/v1/download',
  '/api/v1/events',
  '/api/health',
];

/**
 * Check if a route allows public access
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Extract API key from request
 */
export function extractApiKey(
  searchParams: URLSearchParams,
  headers: Headers
): string | null {
  // Check query param first
  const queryKey = searchParams.get('key');
  if (queryKey) return queryKey;
  
  // Check header
  const headerKey = headers.get('x-api-key');
  if (headerKey) return headerKey;
  
  return null;
}
