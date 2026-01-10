/**
 * Access Control Middleware
 * 
 * Implements public/private access modes:
 * - Public mode: Origin/Referer check (website only, curl blocked)
 * - Private mode: API key via ?key=xxx or X-API-Key header
 */

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Check if origin is in allowed list
 * @param {string} origin - Origin or Referer header value
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  return config.allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * Check if API key is valid
 * @param {string} key - API key to validate
 * @returns {boolean}
 */
function isValidKey(key) {
  if (!key) return false;
  return config.apiKeys.includes(key);
}

/**
 * Access control middleware for v1 routes
 * 
 * Flow:
 * 1. Check for API key (private mode)
 * 2. If no key, check Origin header (public mode)
 * 3. If neither, return 403
 * 
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 * @param {Function} done
 */
export function accessControl(request, reply, done) {
  const apiKey = request.query.key || request.headers['x-api-key'];
  
  // Private mode: validate API key
  if (apiKey) {
    if (isValidKey(apiKey)) {
      request.accessMode = 'private';
      request.apiKey = apiKey;
      logger.debug('access', 'Private mode access granted', { 
        keyPrefix: apiKey.substring(0, 4) + '...' 
      });
      return done();
    }
    
    logger.warn('access', 'Invalid API key attempt', { 
      keyPrefix: apiKey.substring(0, 4) + '...',
      ip: request.ip
    });
    
    return reply.code(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key'
      }
    });
  }
  
  // Public mode: check origin
  const origin = request.headers.origin || request.headers.referer;
  
  if (origin && isAllowedOrigin(origin)) {
    request.accessMode = 'public';
    logger.debug('access', 'Public mode access granted', { origin });
    return done();
  }
  
  // No key, no valid origin - block access
  logger.warn('access', 'Access denied - no key or valid origin', {
    origin: origin || 'none',
    ip: request.ip,
    userAgent: request.headers['user-agent']?.substring(0, 50)
  });
  
  return reply.code(403).send({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'API key required for external access'
    }
  });
}

export default accessControl;
