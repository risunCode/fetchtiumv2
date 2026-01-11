/**
 * Cookie Parser - Parse Netscape and JSON cookie formats
 *
 * Priority:
 * 1. Client cookie (user uploaded)
 * 2. Server cookie (from database - future)
 * 3. File cookie (local files)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Cookie object from JSON export
 */
interface CookieObject {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

/**
 * Options for getting platform-specific cookies
 */
export interface GetCookiesOptions {
  /** Cookie from client (any format) */
  clientCookie?: string;
  /** Cookie from server/database (future) */
  serverCookie?: string;
}

/**
 * Parse Netscape cookie file format
 */
function parseNetscape(content: string): string {
  const cookies: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length >= 7) {
      const name = parts[5]?.trim();
      const value = parts[6]?.trim();
      if (name && value) {
        cookies.push(`${name}=${value}`);
      }
    }
  }

  return cookies.join('; ');
}

/**
 * Parse JSON cookie format (browser export)
 */
function parseJSON(content: string): string {
  try {
    let data: CookieObject | CookieObject[] = JSON.parse(content);
    // Handle single object or array
    if (!Array.isArray(data)) data = [data];

    const cookies = data
      .filter((c) => c.name && c.value)
      .map((c) => `${c.name}=${c.value}`);
    return cookies.join('; ');
  } catch {
    return '';
  }
}


/**
 * Parse cookie string (any format) to cookie header string
 * Supports: Netscape, JSON array, JSON object, raw cookie string
 *
 * @param input - Cookie input (any format)
 * @returns Cookie header string (name=value; name2=value2)
 */
export function parseCookies(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';

  const trimmed = input.trim();

  // Already a cookie string (name=value; name2=value2)
  if (
    trimmed.includes('=') &&
    !trimmed.startsWith('[') &&
    !trimmed.startsWith('{') &&
    !trimmed.includes('\t')
  ) {
    return trimmed;
  }

  // JSON format
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJSON(trimmed);
  }

  // Netscape format (has tabs)
  if (trimmed.includes('\t')) {
    return parseNetscape(trimmed);
  }

  // Unknown format, return as-is
  return trimmed;
}

/**
 * Load cookies from file
 * @param filePath - Path to cookie file
 * @returns Cookie header string
 */
export async function loadCookies(filePath: string): Promise<string> {
  try {
    if (!existsSync(filePath)) {
      return '';
    }

    const content = await readFile(filePath, 'utf-8');
    return parseCookies(content);
  } catch {
    return '';
  }
}

/**
 * Check if cookies are valid (have required auth cookies for Facebook)
 * @param cookieStr - Cookie header string
 * @returns true if cookies contain required auth tokens
 */
export function hasValidAuthCookies(cookieStr: string | undefined | null): boolean {
  if (!cookieStr) return false;
  // Facebook requires c_user and xs for authenticated requests
  return cookieStr.includes('c_user=') && cookieStr.includes('xs=');
}

/**
 * Get Facebook cookies
 * Priority: clientCookie > serverCookie > fileCookie
 *
 * @param options - Cookie options
 * @returns Cookie header string
 */
export async function getFacebookCookies(options: GetCookiesOptions = {}): Promise<string> {
  const { clientCookie, serverCookie } = options;

  // Priority 1: Client cookie (user uploaded)
  if (clientCookie) {
    const parsed = parseCookies(clientCookie);
    if (parsed && hasValidAuthCookies(parsed)) {
      return parsed;
    }
  }

  // Priority 2: Server cookie (database - future)
  if (serverCookie) {
    const parsed = parseCookies(serverCookie);
    if (parsed && hasValidAuthCookies(parsed)) {
      return parsed;
    }
  }

  // Priority 3: File cookie (local files)
  const paths = [
    'fb_netscape.txt',
    'fb_json.txt',
    'tests/cookies_fb/fb_netscape.txt',
    'tests/cookies_fb/fb_json.txt',
    'cookies/facebook.txt',
    'cookies/fb.txt',
  ];

  for (const path of paths) {
    const cookies = await loadCookies(path);
    if (cookies && hasValidAuthCookies(cookies)) {
      return cookies;
    }
  }

  return '';
}

/**
 * Generic function to get cookies for any platform
 * Priority: clientCookie > serverCookie > fileCookie
 *
 * @param platform - Platform name (facebook, instagram, tiktok, etc.)
 * @param options - Cookie options
 * @param filePaths - Optional custom file paths to check
 * @param validator - Optional custom validator function
 * @returns Cookie header string
 */
export async function getPlatformCookies(
  platform: string,
  options: GetCookiesOptions = {},
  filePaths?: string[],
  validator?: (cookies: string) => boolean
): Promise<string> {
  const { clientCookie, serverCookie } = options;
  const validate = validator || ((cookies: string) => cookies.length > 0);

  // Priority 1: Client cookie (user uploaded)
  if (clientCookie) {
    const parsed = parseCookies(clientCookie);
    if (parsed && validate(parsed)) {
      return parsed;
    }
  }

  // Priority 2: Server cookie (database - future)
  if (serverCookie) {
    const parsed = parseCookies(serverCookie);
    if (parsed && validate(parsed)) {
      return parsed;
    }
  }

  // Priority 3: File cookie (local files)
  const defaultPaths = [
    `${platform}_netscape.txt`,
    `${platform}_json.txt`,
    `cookies/${platform}.txt`,
  ];

  const paths = filePaths || defaultPaths;

  for (const path of paths) {
    const cookies = await loadCookies(path);
    if (cookies && validate(cookies)) {
      return cookies;
    }
  }

  return '';
}

// ============================================================
// INSTAGRAM COOKIE HELPERS
// ============================================================

/**
 * Extract CSRF token from Instagram cookie string
 * Required for X-CSRFToken header in authenticated requests
 * 
 * @param cookie - Cookie header string
 * @returns CSRF token or null if not found
 */
export function extractInstagramCsrfToken(cookie: string): string | null {
  if (!cookie) return null;
  const match = cookie.match(/csrftoken=([^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Extract session ID from Instagram cookie string
 * 
 * @param cookie - Cookie header string
 * @returns Session ID or null if not found
 */
export function extractInstagramSessionId(cookie: string): string | null {
  if (!cookie) return null;
  const match = cookie.match(/sessionid=([^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Check if Instagram cookies are valid (have required auth cookies)
 * 
 * @param cookieStr - Cookie header string
 * @returns true if cookies contain required auth tokens
 */
export function hasValidInstagramCookies(cookieStr: string | undefined | null): boolean {
  if (!cookieStr) return false;
  // Instagram requires sessionid and csrftoken for authenticated requests
  return cookieStr.includes('sessionid=') && cookieStr.includes('csrftoken=');
}

/**
 * Instagram App ID for API requests
 */
export const INSTAGRAM_APP_ID = '936619743392459';

/**
 * Build Instagram headers with authentication
 * 
 * @param cookie - Cookie header string
 * @returns Headers object with Instagram-specific headers
 */
export function buildInstagramHeaders(cookie: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': INSTAGRAM_APP_ID,
    'X-ASBD-ID': '129477',
    'X-IG-WWW-Claim': '0',
  };

  if (cookie) {
    headers['Cookie'] = cookie;
    
    const csrfToken = extractInstagramCsrfToken(cookie);
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }
  }

  return headers;
}

// ============================================================
// TWITTER COOKIE HELPERS
// ============================================================

/**
 * Extract ct0 CSRF token from Twitter cookie string
 * Required for X-Csrf-Token header in authenticated requests
 * 
 * @param cookie - Cookie header string
 * @returns ct0 token or null if not found
 */
export function extractTwitterCt0(cookie: string): string | null {
  if (!cookie) return null;
  const match = cookie.match(/ct0=([^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Extract auth_token from Twitter cookie string
 * 
 * @param cookie - Cookie header string
 * @returns auth_token or null if not found
 */
export function extractTwitterAuthToken(cookie: string): string | null {
  if (!cookie) return null;
  const match = cookie.match(/auth_token=([^;]+)/i);
  return match ? match[1] : null;
}

/**
 * Check if Twitter cookies are valid (have required auth cookies)
 * 
 * @param cookieStr - Cookie header string
 * @returns true if cookies contain required auth tokens
 */
export function hasValidTwitterCookies(cookieStr: string | undefined | null): boolean {
  if (!cookieStr) return false;
  // Twitter requires ct0 and auth_token for authenticated requests
  return cookieStr.includes('ct0=') && cookieStr.includes('auth_token=');
}

/**
 * Twitter Bearer token for API requests
 * This is a public token used by the Twitter web client
 */
export const TWITTER_BEARER_TOKEN = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

/**
 * Build Twitter headers with authentication
 * 
 * @param cookie - Cookie header string
 * @returns Headers object with Twitter-specific headers
 */
export function buildTwitterHeaders(cookie: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Authorization': TWITTER_BEARER_TOKEN,
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Client-Language': 'en',
  };

  if (cookie) {
    headers['Cookie'] = cookie;
    
    const ct0 = extractTwitterCt0(cookie);
    if (ct0) {
      headers['X-Csrf-Token'] = ct0;
    }
  }

  return headers;
}
