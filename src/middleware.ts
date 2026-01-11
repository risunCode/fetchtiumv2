/**
 * Next.js Middleware
 * 
 * Applies security checks to API routes:
 * - Input validation and sanitization
 * - SSRF protection
 * - Path traversal protection
 * - Rate limiting
 * - Access control (origin/API key validation)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * SSRF Protection - Block internal/private IPs
 */
const BLOCKED_HOSTS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[::1\]/,
  /^\[fc/i,
  /^\[fd/i,
  /^\[fe80:/i,
  /^metadata\./i,
  /^169\.254\.169\.254/,
  /\.internal$/i,
  /\.local$/i,
];

/**
 * Attack patterns
 */
const ATTACK_PATTERNS: RegExp[] = [
  /\.\.[\/\\]/,
  /\.\.$/,
  /%2e%2e/i,
  /%252e/i,
  /%c0%ae/i,
  /%c0%2f/i,
  /%c1%1c/i,
  /%c1%9c/i,
  /%e0%80%ae/i,
  /%ef%bc%8f/i,
  /\x00/,
  /%00/,
  /[`]/,
  /\$\{/,
  /\$\(/,
  /;\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)/i,
  /\|\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)/i,
  />\s*\//,
  /[\r\n]/,
  /%0[aAdD]/i,
];

/**
 * XSS patterns
 */
const XSS_PATTERNS: RegExp[] = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<svg.*?onload/i,
  /expression\s*\(/i,
  /url\s*\(\s*['"]?\s*data:/i,
];

/**
 * Routes that allow public access without origin check
 */
const PUBLIC_ROUTES = [
  '/api/v1/stream',
  '/api/v1/download',
  '/api/v1/thumbnail', // Thumbnail proxy for Instagram
  '/api/v1/hls-stream',  // HLS to progressive conversion
  '/api/v1/hls-proxy',   // HLS proxy for CORS-restricted streams
  '/api/v1/merge',       // Video-audio merge endpoint
  '/api/v1/events',
  '/api/changelog',      // Changelog markdown
  '/api/extract',  // Python extractor (internal calls)
  '/api/yt-stream', // Python YouTube stream (internal calls)
  '/api/health',
];

/**
 * Default allowed origins
 */
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://fetchtiumv2.vercel.app',
  'https://fetchtiumv2.up.railway.app',
];

/**
 * Rate limit storage (edge-compatible)
 */
const rateLimitMap = new Map<string, { start: number; count: number }>();
const RATE_WINDOW = 60000;
const MAX_REQUESTS = 100;

function fullyDecode(str: string, maxIterations: number = 5): string {
  if (!str) return str;
  let decoded = str;
  let prev = '';
  let iterations = 0;
  while (decoded !== prev && iterations < maxIterations) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
    iterations++;
  }
  return decoded;
}

function hasMaliciousPattern(input: string): boolean {
  if (!input) return false;
  const decoded = fullyDecode(input);
  return ATTACK_PATTERNS.some(p => p.test(decoded)) || 
         XSS_PATTERNS.some(p => p.test(decoded));
}

function isBlockedHost(hostname: string): boolean {
  if (!hostname) return true;
  return BLOCKED_HOSTS.some(pattern => pattern.test(hostname));
}


function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (!envOrigins) return DEFAULT_ORIGINS;
  return envOrigins.split(',').map(s => s.trim()).filter(Boolean);
}

function getApiKeys(): string[] {
  const envKeys = process.env.API_KEYS;
  if (!envKeys) return [];
  return envKeys.split(',').map(s => s.trim()).filter(Boolean);
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

function isValidApiKey(key: string | null): boolean {
  if (!key) return false;
  const apiKeys = getApiKeys();
  return apiKeys.includes(key);
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  
  if (!entry || now - entry.start > RATE_WINDOW) {
    entry = { start: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  
  entry.count++;
  
  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.start + RATE_WINDOW - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  return { allowed: true };
}

function createErrorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message }
    },
    { status }
  );
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Only apply to API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // Get client IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Rate limiting
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return createErrorResponse(
      'RATE_LIMITED',
      'Too many requests',
      429
    );
  }
  
  // Check URL for malicious patterns
  const decodedPath = fullyDecode(pathname);
  if (hasMaliciousPattern(decodedPath)) {
    return createErrorResponse('FORBIDDEN', 'Access denied', 403);
  }
  
  // Check query params for malicious patterns
  // Skip for streaming endpoints - they have complex URLs that may trigger false positives
  const isStreamingEndpoint = pathname.includes('/hls-stream') || pathname.includes('/hls-proxy') || pathname.includes('/stream') || pathname.includes('/download') || pathname.includes('/merge');
  
  if (!isStreamingEndpoint) {
    for (const [key, value] of searchParams.entries()) {
      if (hasMaliciousPattern(key) || hasMaliciousPattern(value)) {
        return createErrorResponse('FORBIDDEN', 'Invalid request', 403);
      }
    }
  }
  
  // Validate URL parameter if present (SSRF protection)
  const urlParam = searchParams.get('url');
  if (urlParam) {
    try {
      const decoded = fullyDecode(urlParam);
      
      // Skip malicious pattern check for known streaming endpoints
      // BiliBili and YouTube URLs have complex query strings that may trigger false positives
      const isStreamingEndpoint = pathname.includes('/hls-stream') || pathname.includes('/hls-proxy') || pathname.includes('/stream') || pathname.includes('/download') || pathname.includes('/merge');
      
      if (!isStreamingEndpoint && hasMaliciousPattern(decoded)) {
        return createErrorResponse('INVALID_URL', 'Malicious pattern detected', 400);
      }
      
      const url = new URL(decoded);
      
      if (!['http:', 'https:'].includes(url.protocol)) {
        return createErrorResponse('INVALID_URL', 'Only HTTP/HTTPS URLs allowed', 400);
      }
      
      if (isBlockedHost(url.hostname)) {
        return createErrorResponse('INVALID_URL', 'Internal hosts not allowed', 400);
      }
    } catch {
      return createErrorResponse('INVALID_URL', 'Invalid URL format', 400);
    }
  }
  
  // Skip access control for public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Access control for protected routes
  const apiKey = searchParams.get('key') || request.headers.get('x-api-key');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const isInternalCall = request.headers.get('x-internal-call') === 'true';
  
  // Allow internal calls (e.g., Next.js calling Python function on Vercel)
  if (isInternalCall) {
    return NextResponse.next();
  }
  
  // Private mode: validate API key
  if (apiKey) {
    if (isValidApiKey(apiKey)) {
      return NextResponse.next();
    }
    return createErrorResponse('UNAUTHORIZED', 'Invalid API key', 401);
  }
  
  // Public mode: check origin
  const originToCheck = origin || referer;
  if (originToCheck && isAllowedOrigin(originToCheck)) {
    return NextResponse.next();
  }
  
  // No key, no valid origin - deny access
  return createErrorResponse(
    'FORBIDDEN',
    'API key required for external access',
    403
  );
}

// Configure which routes the middleware applies to
export const config = {
  matcher: [
    '/api/:path*',
  ],
};
