/**
 * Security Middleware
 * 
 * - Path traversal protection (canonical path validation)
 * - SSRF protection
 * - XSS sanitization (using xss library)
 * - Input validation (using validator library)
 * - Rate limiting
 */

import { logger } from '../utils/logger.js';
import { resolve, normalize } from 'path';
import xss from 'xss';
import validator from 'validator';

/**
 * SSRF Protection - Block internal/private IPs
 * These should NEVER be accessed via user input
 */
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,                     // 127.0.0.0/8
  /^10\./,                      // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,                // 192.168.0.0/16
  /^169\.254\./,                // Link-local
  /^0\./,                       // 0.0.0.0/8
  /^\[::1\]/,                   // IPv6 localhost
  /^\[fc/i,                     // IPv6 private
  /^\[fd/i,                     // IPv6 private
  /^\[fe80:/i,                  // IPv6 link-local
  /^metadata\./i,               // Cloud metadata
  /^169\.254\.169\.254/,        // AWS/GCP metadata
  /\.internal$/i,               // Internal domains
  /\.local$/i,                  // Local domains
];

/**
 * Blocked URL schemes
 */
const BLOCKED_SCHEMES = ['file:', 'ftp:', 'gopher:', 'data:', 'javascript:'];

/**
 * Dangerous patterns that indicate attack attempts
 */
const ATTACK_PATTERNS = [
  /\.\.[\/\\]/,                 // Path traversal
  /\.\.$/, // Ends with ..
  /%2e%2e/i,                    // URL encoded ..
  /%252e/i,                     // Double encoded
  /%c0%ae/i,                    // Overlong UTF-8
  /%c0%2f/i,                    // Overlong UTF-8
  /%c1%1c/i,                    // Overlong UTF-8
  /%c1%9c/i,                    // Overlong UTF-8
  /%e0%80%ae/i,                 // 3-byte overlong
  /%ef%bc%8f/i,                 // Fullwidth solidus
  /\x00/,                       // Null byte
  /%00/,                        // URL encoded null
  /[`]/,                        // Backticks (command injection)
  /\$\{/,                       // Template literal
  /\$\(/,                       // Command substitution
  /;\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)/i, // Command chaining
  /\|\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)/i, // Pipe to command
  />\s*\//, // Redirect to root
  /[\r\n]/,                     // CRLF injection (header injection)
  /%0[aAdD]/i,                  // URL encoded CRLF
];

/**
 * XSS patterns (for any user input that might be reflected)
 */
const XSS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,                 // onclick=, onerror=, etc
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<svg.*?onload/i,
  /expression\s*\(/i,           // CSS expression
  /url\s*\(\s*['"]?\s*data:/i,  // CSS data URI
];

/**
 * SQL injection patterns (defense in depth, even without DB)
 */
const SQLI_PATTERNS = [
  /'\s*(or|and)\s*'?\d*'?\s*=\s*'?\d*'?/i,  // ' or '1'='1
  /'\s*(or|and)\s+[\w\s]*--/i,              // ' or 1=1--
  /union\s+(all\s+)?select/i,               // UNION SELECT
  /;\s*drop\s+table/i,                      // ; DROP TABLE
  /;\s*delete\s+from/i,                     // ; DELETE FROM
  /;\s*insert\s+into/i,                     // ; INSERT INTO
  /;\s*update\s+\w+\s+set/i,                // ; UPDATE x SET
  /exec\s*\(/i,                             // EXEC()
  /xp_cmdshell/i,                           // SQL Server cmd
];

/**
 * Check if hostname is blocked (SSRF protection)
 */
function isBlockedHost(hostname) {
  if (!hostname) return true;
  return BLOCKED_HOSTS.some(pattern => pattern.test(hostname));
}

/**
 * Check for attack patterns (path traversal, command injection, CRLF)
 */
function hasAttackPattern(input) {
  if (!input || typeof input !== 'string') return false;
  return ATTACK_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check for XSS patterns
 */
function hasXssPattern(input) {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check for SQL injection patterns
 */
function hasSqliPattern(input) {
  if (!input || typeof input !== 'string') return false;
  return SQLI_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check all malicious patterns
 */
function hasMaliciousPattern(input) {
  return hasAttackPattern(input) || hasXssPattern(input) || hasSqliPattern(input);
}

/**
 * Decode all URL encodings recursively (catch double/triple encoding)
 */
function fullyDecode(str, maxIterations = 5) {
  if (!str || typeof str !== 'string') return str;
  
  let decoded = str;
  let prev = '';
  let iterations = 0;
  
  while (decoded !== prev && iterations < maxIterations) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break; // Invalid encoding, stop
    }
    iterations++;
  }
  
  return decoded;
}

/**
 * Normalize and validate path (canonical path check)
 */
function isPathSafe(inputPath, basePath = process.cwd()) {
  try {
    // Fully decode first
    const decoded = fullyDecode(inputPath);
    
    // Check for attack patterns in decoded string
    if (hasAttackPattern(decoded)) return false;
    
    // Resolve to absolute path
    const resolved = resolve(basePath, decoded);
    
    // Normalize (removes .., ., etc)
    const normalized = normalize(resolved);
    
    // Must start with base path (canonical check)
    return normalized.startsWith(normalize(basePath));
  } catch {
    return false;
  }
}

/**
 * Sanitize string input using xss library
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Normalize unicode
  str = str.normalize('NFC');
  
  // XSS sanitization
  str = xss(str, {
    whiteList: {},          // No HTML tags allowed
    stripIgnoreTag: true,   // Strip all unknown tags
    stripIgnoreTagBody: ['script', 'style'] // Remove script/style completely
  });
  
  return str;
}

/**
 * Deep sanitize object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate URL using validator library + custom checks
 */
function validateUrlInput(urlString) {
  try {
    // Fully decode first
    const decoded = fullyDecode(urlString);
    
    // Check attack patterns
    if (hasMaliciousPattern(decoded)) {
      return { valid: false, reason: 'Malicious pattern detected' };
    }
    
    // Use validator for basic URL check
    if (!validator.isURL(decoded, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: true
    })) {
      return { valid: false, reason: 'Invalid URL format' };
    }
    
    const url = new URL(decoded);
    
    // Check for SSRF (internal IPs)
    if (isBlockedHost(url.hostname)) {
      return { valid: false, reason: 'Internal hosts not allowed' };
    }
    
    // Check for IP bypass attempts
    if (/^\d+$/.test(url.hostname)) {
      return { valid: false, reason: 'Numeric IP not allowed' };
    }
    if (/^0\d+\./.test(url.hostname)) {
      return { valid: false, reason: 'Octal IP not allowed' };
    }
    if (/0x[0-9a-f]+/i.test(url.hostname)) {
      return { valid: false, reason: 'Hex IP not allowed' };
    }
    
    return { valid: true, url };
  } catch (e) {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/**
 * Security middleware - validates and sanitizes requests
 */
export function securityMiddleware(request, reply, done) {
  const { url, body, query, headers } = request;
  
  // Check request body size (prevent DoS)
  const contentLength = parseInt(headers['content-length'] || '0', 10);
  if (contentLength > 1024 * 1024) { // 1MB max
    logger.warn('security', 'Request too large', { size: contentLength, ip: request.ip });
    return reply.code(413).send({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' }
    });
  }
  
  // Check request URL for attack patterns
  const decodedUrl = fullyDecode(url);
  if (hasMaliciousPattern(decodedUrl)) {
    logger.warn('security', 'Malicious pattern in URL', { url, ip: request.ip });
    return reply.code(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' }
    });
  }
  
  // Check query params
  for (const [key, value] of Object.entries(query || {})) {
    const decodedKey = fullyDecode(key);
    const decodedValue = fullyDecode(String(value));
    
    if (hasMaliciousPattern(decodedKey) || hasMaliciousPattern(decodedValue)) {
      logger.warn('security', 'Malicious pattern in query', { key, ip: request.ip });
      return reply.code(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Invalid request' }
      });
    }
  }
  
  // Check body for malicious patterns
  if (body) {
    const bodyStr = JSON.stringify(body);
    if (hasMaliciousPattern(fullyDecode(bodyStr))) {
      logger.warn('security', 'Malicious pattern in body', { ip: request.ip });
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input detected' }
      });
    }
  }
  
  // Validate body URL field (main attack vector for SSRF)
  if (body?.url) {
    const validation = validateUrlInput(body.url);
    if (!validation.valid) {
      logger.warn('security', 'URL validation failed', { 
        reason: validation.reason,
        url: body.url.substring(0, 100), 
        ip: request.ip 
      });
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_URL', message: validation.reason }
      });
    }
  }
  
  // Validate query URL param (for download/stream endpoints)
  if (query?.url) {
    const validation = validateUrlInput(query.url);
    if (!validation.valid) {
      logger.warn('security', 'Query URL validation failed', { 
        reason: validation.reason,
        ip: request.ip 
      });
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_URL', message: validation.reason }
      });
    }
  }
  
  // Sanitize inputs
  if (body) request.body = sanitizeObject(body);
  if (query) request.query = sanitizeObject(query);
  
  done();
}

/**
 * Rate limit by IP (simple in-memory)
 */
const ipRequests = new Map();
const RATE_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100;  // per window

export function rateLimitMiddleware(request, reply, done) {
  const ip = request.ip;
  const now = Date.now();
  
  // Get or create entry
  let entry = ipRequests.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    entry = { start: now, count: 0 };
    ipRequests.set(ip, entry);
  }
  
  entry.count++;
  
  if (entry.count > MAX_REQUESTS) {
    logger.warn('security', 'Rate limit exceeded', { ip, count: entry.count });
    return reply.code(429).send({
      success: false,
      error: { 
        code: 'RATE_LIMITED', 
        message: 'Too many requests',
        retryAfter: Math.ceil((entry.start + RATE_WINDOW - now) / 1000)
      }
    });
  }
  
  done();
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRequests.entries()) {
    if (now - entry.start > RATE_WINDOW) {
      ipRequests.delete(ip);
    }
  }
}, 60000);

export default { securityMiddleware, rateLimitMiddleware };
