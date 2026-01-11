/**
 * HTTP/2 Client with environment-based detection
 * 
 * Uses native Node.js http2 module when available (Vercel Functions, Railway)
 * Falls back to undici for Edge runtime or when http2 is unavailable
 */

import * as http2 from 'http2';
import { URL } from 'url';
import type { Readable } from 'stream';

// Declare EdgeRuntime global (exists in Vercel Edge Runtime)
declare const EdgeRuntime: string | undefined;

/**
 * HTTP/2 session cache for connection reuse
 * Key: origin (e.g., "https://example.com")
 */
const sessionCache = new Map<string, {
  session: http2.ClientHttp2Session;
  lastUsed: number;
}>();

// Session keepalive: 5 minutes
const SESSION_KEEPALIVE = 300000;

// Cleanup interval: 1 minute
const CLEANUP_INTERVAL = 60000;

/**
 * Detect if HTTP/2 is available in current environment
 */
export function isHttp2Available(): boolean {
  // Edge runtime doesn't support http2
  if (typeof EdgeRuntime !== 'undefined') {
    return false;
  }
  
  // Check if http2 module is available
  try {
    return typeof http2.connect === 'function';
  } catch {
    return false;
  }
}

/**
 * Environment detection for logging/debugging
 */
export function getEnvironmentInfo(): {
  isVercel: boolean;
  isRailway: boolean;
  isEdge: boolean;
  http2Available: boolean;
} {
  const isVercel = process.env.VERCEL === '1';
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
  const isEdge = typeof EdgeRuntime !== 'undefined';
  
  return {
    isVercel,
    isRailway,
    isEdge,
    http2Available: isHttp2Available(),
  };
}

/**
 * Get or create HTTP/2 session for origin
 */
function getSession(origin: string): http2.ClientHttp2Session {
  const cached = sessionCache.get(origin);
  
  if (cached && !cached.session.destroyed && !cached.session.closed) {
    cached.lastUsed = Date.now();
    return cached.session;
  }
  
  // Create new session
  const session = http2.connect(origin, {
    // Allow session to be reused
    peerMaxConcurrentStreams: 100,
  });
  
  // Handle session errors gracefully
  session.on('error', () => {
    sessionCache.delete(origin);
  });
  
  session.on('close', () => {
    sessionCache.delete(origin);
  });
  
  sessionCache.set(origin, {
    session,
    lastUsed: Date.now(),
  });
  
  return session;
}

/**
 * Cleanup expired sessions
 */
function cleanupSessions(): void {
  const now = Date.now();
  
  for (const [origin, { session, lastUsed }] of sessionCache.entries()) {
    if (now - lastUsed > SESSION_KEEPALIVE || session.destroyed || session.closed) {
      if (!session.destroyed && !session.closed) {
        session.close();
      }
      sessionCache.delete(origin);
    }
  }
}

// Start cleanup interval (only in Node.js environment)
if (typeof setInterval !== 'undefined' && isHttp2Available()) {
  setInterval(cleanupSessions, CLEANUP_INTERVAL).unref();
}

/**
 * HTTP/2 fetch options
 */
export interface Http2FetchOptions {
  method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  followRedirects?: boolean;
  maxRedirects?: number;
}

/**
 * HTTP/2 fetch result
 */
export interface Http2FetchResult {
  status: number;
  headers: Record<string, string>;
  stream: Readable;
  finalUrl: string;
}

/**
 * Fetch using HTTP/2
 */
export async function http2Fetch(
  url: string,
  options: Http2FetchOptions = {}
): Promise<Http2FetchResult> {
  const {
    method = 'GET',
    headers = {},
    timeout = 30000,
    followRedirects = true,
    maxRedirects = 5,
  } = options;
  
  let currentUrl = url;
  let redirectCount = 0;
  
  while (true) {
    const parsed = new URL(currentUrl);
    const origin = parsed.origin;
    const path = parsed.pathname + parsed.search;
    
    // Only HTTPS supports HTTP/2
    if (parsed.protocol !== 'https:') {
      throw new Error('HTTP/2 requires HTTPS');
    }
    
    const session = getSession(origin);
    
    const result = await new Promise<Http2FetchResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);
      
      const req = session.request({
        ':method': method,
        ':path': path,
        ...headers,
      });
      
      req.on('response', (responseHeaders) => {
        clearTimeout(timeoutId);
        
        const status = responseHeaders[':status'] as number;
        
        // Convert headers to plain object
        const headersObj: Record<string, string> = {};
        for (const [key, value] of Object.entries(responseHeaders)) {
          if (!key.startsWith(':') && value !== undefined) {
            headersObj[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
          }
        }
        
        // Handle redirects
        if (followRedirects && status >= 300 && status < 400 && headersObj.location) {
          req.close();
          
          redirectCount++;
          if (redirectCount > maxRedirects) {
            reject(new Error('Too many redirects'));
            return;
          }
          
          // Resolve relative URL
          currentUrl = new URL(headersObj.location, currentUrl).href;
          
          // Signal to continue redirect loop
          resolve({
            status: -1, // Special marker for redirect
            headers: headersObj,
            stream: req as unknown as Readable,
            finalUrl: currentUrl,
          });
          return;
        }
        
        resolve({
          status,
          headers: headersObj,
          stream: req as unknown as Readable,
          finalUrl: currentUrl,
        });
      });
      
      req.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
      
      req.end();
    });
    
    // Check if we need to follow redirect
    if (result.status === -1) {
      continue;
    }
    
    return result;
  }
}

/**
 * Close all HTTP/2 sessions
 */
export function closeAllSessions(): void {
  for (const [, { session }] of sessionCache.entries()) {
    if (!session.destroyed && !session.closed) {
      session.close();
    }
  }
  sessionCache.clear();
}

/**
 * Get session cache stats
 */
export function getSessionStats(): {
  activeSessions: number;
  origins: string[];
} {
  return {
    activeSessions: sessionCache.size,
    origins: Array.from(sessionCache.keys()),
  };
}
