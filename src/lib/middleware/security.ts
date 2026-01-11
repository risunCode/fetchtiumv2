/**
 * Security Helpers
 * 
 * - Input sanitization (XSS protection)
 * - SSRF protection (block internal IPs)
 * - Path traversal protection
 * - Rate limiting
 */

import { logger } from '@/lib/utils/logger';

/**
 * SSRF Protection - Block internal/private IPs
 */
const BLOCKED_HOSTS: RegExp[] = [
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
 * Dangerous patterns that indicate attack attempts
 */
const ATTACK_PATTERNS: RegExp[] = [
  /\.\.[\/\\]/,                 // Path traversal
  /\.\.$/,                      // Ends with ..
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
  />\s*\//,                     // Redirect to root
  /[\r\n]/,                     // CRLF injection
  /%0[aAdD]/i,                  // URL encoded CRLF
];

/**
 * XSS patterns
 */
const XSS_PATTERNS: RegExp[] = [
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
 * SQL injection patterns (defense in depth)
 */
const SQLI_PATTERNS: RegExp[] = [
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

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Check if hostname is blocked (SSRF protection)
 */
export function isBlockedHost(hostname: string): boolean {
  if (!hostname) return true;
  return BLOCKED_HOSTS.some(pattern => pattern.test(hostname));
}

/**
 * Check for attack patterns (path traversal, command injection, CRLF)
 */
export function hasAttackPattern(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return ATTACK_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check for XSS patterns
 */
export function hasXssPattern(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check for SQL injection patterns
 */
export function hasSqliPattern(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQLI_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check all malicious patterns
 */
export function hasMaliciousPattern(input: string): boolean {
  return hasAttackPattern(input) || hasXssPattern(input) || hasSqliPattern(input);
}

/**
 * Decode all URL encodings recursively (catch double/triple encoding)
 */
export function fullyDecode(str: string, maxIterations: number = 5): string {
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
 * Sanitize string input (basic XSS protection without external library)
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Normalize unicode
  str = str.normalize('NFC');
  
  // Basic HTML entity encoding for dangerous characters
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return str;
}

/**
 * Deep sanitize object
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as T;
  }
  
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized as T;
  }
  
  return obj;
}

/**
 * Validate URL input for SSRF and other attacks
 */
export function validateUrlInput(urlString: string): ValidationResult {
  try {
    // Fully decode first
    const decoded = fullyDecode(urlString);
    
    // Check attack patterns
    if (hasMaliciousPattern(decoded)) {
      return { valid: false, reason: 'Malicious pattern detected' };
    }
    
    // Parse URL
    let url: URL;
    try {
      url = new URL(decoded);
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, reason: 'Only HTTP/HTTPS URLs allowed' };
    }
    
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
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/**
 * Rate limit storage (in-memory)
 */
interface RateLimitEntry {
  start: number;
  count: number;
}

const ipRequests = new Map<string, RateLimitEntry>();
const RATE_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100;  // per window

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/**
 * Check rate limit for an IP
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  
  // Get or create entry
  let entry = ipRequests.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    entry = { start: now, count: 0 };
    ipRequests.set(ip, entry);
  }
  
  entry.count++;
  
  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.start + RATE_WINDOW - now) / 1000);
    logger.warn('security', 'Rate limit exceeded', { ip, count: entry.count });
    return { 
      allowed: false, 
      remaining: 0,
      retryAfter 
    };
  }
  
  return { 
    allowed: true, 
    remaining: MAX_REQUESTS - entry.count 
  };
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, entry] of ipRequests.entries()) {
    if (now - entry.start > RATE_WINDOW) {
      ipRequests.delete(ip);
    }
  }
}

// Auto-cleanup every minute (only in non-edge runtime)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 60000);
}

/**
 * Validate request body size
 */
export function isBodySizeValid(contentLength: number, maxSize: number = 1024 * 1024): boolean {
  return contentLength <= maxSize;
}

/**
 * Check if path is safe (no traversal)
 */
export function isPathSafe(inputPath: string): boolean {
  try {
    // Fully decode first
    const decoded = fullyDecode(inputPath);
    
    // Check for attack patterns in decoded string
    if (hasAttackPattern(decoded)) return false;
    
    // Check for path traversal patterns
    if (decoded.includes('..')) return false;
    
    return true;
  } catch {
    return false;
  }
}
