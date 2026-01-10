/**
 * Cookie Parser - Parse Netscape and JSON cookie formats
 * 
 * Priority:
 * 1. Client cookie (user uploaded)
 * 2. Server cookie (from Supabase - future)
 * 3. File cookie (local files)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../../utils/logger.js';

/**
 * Parse Netscape cookie file format
 * @param {string} content - File content
 * @returns {string} Cookie header string
 */
function parseNetscape(content) {
  const cookies = [];
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
 * @param {string} content - File content
 * @returns {string} Cookie header string
 */
function parseJSON(content) {
  try {
    let data = JSON.parse(content);
    // Handle single object or array
    if (!Array.isArray(data)) data = [data];
    
    const cookies = data
      .filter(c => c.name && c.value)
      .map(c => `${c.name}=${c.value}`);
    return cookies.join('; ');
  } catch (e) {
    logger.error('cookies', 'Failed to parse JSON cookies', e);
    return '';
  }
}

/**
 * Parse cookie string (any format) to cookie header string
 * Supports: Netscape, JSON array, JSON object, raw cookie string
 * 
 * @param {string} input - Cookie input (any format)
 * @returns {string} Cookie header string (name=value; name2=value2)
 */
export function parseCookies(input) {
  if (!input || typeof input !== 'string') return '';
  
  const trimmed = input.trim();
  
  // Already a cookie string (name=value; name2=value2)
  if (trimmed.includes('=') && !trimmed.startsWith('[') && !trimmed.startsWith('{') && !trimmed.includes('\t')) {
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
 * @param {string} filePath - Path to cookie file
 * @returns {Promise<string>} Cookie header string
 */
export async function loadCookies(filePath) {
  try {
    if (!existsSync(filePath)) {
      return '';
    }
    
    const content = await readFile(filePath, 'utf-8');
    return parseCookies(content);
  } catch (error) {
    logger.error('cookies', 'Failed to load cookies', error);
    return '';
  }
}

/**
 * Get Facebook cookies
 * Priority: clientCookie > serverCookie > fileCookie
 * 
 * @param {object} options
 * @param {string} options.clientCookie - Cookie from client (any format)
 * @param {string} options.serverCookie - Cookie from server/Supabase (future)
 * @returns {Promise<string>} Cookie header string
 */
export async function getFacebookCookies(options = {}) {
  const { clientCookie, serverCookie } = options;
  
  // Priority 1: Client cookie (user uploaded)
  if (clientCookie) {
    const parsed = parseCookies(clientCookie);
    if (parsed && hasValidAuthCookies(parsed)) {
      logger.debug('cookies', 'Using client cookie');
      return parsed;
    }
  }
  
  // Priority 2: Server cookie (Supabase - future)
  if (serverCookie) {
    const parsed = parseCookies(serverCookie);
    if (parsed && hasValidAuthCookies(parsed)) {
      logger.debug('cookies', 'Using server cookie');
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
    'cookies/fb.txt'
  ];
  
  for (const path of paths) {
    const cookies = await loadCookies(path);
    if (cookies && hasValidAuthCookies(cookies)) {
      logger.debug('cookies', 'Using file cookie', { path });
      return cookies;
    }
  }
  
  return '';
}

/**
 * Check if cookies are valid (have required auth cookies)
 * @param {string} cookieStr - Cookie header string
 * @returns {boolean}
 */
export function hasValidAuthCookies(cookieStr) {
  if (!cookieStr) return false;
  // Facebook requires c_user and xs for authenticated requests
  return cookieStr.includes('c_user=') && cookieStr.includes('xs=');
}
