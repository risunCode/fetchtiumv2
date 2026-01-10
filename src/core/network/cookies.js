/**
 * Cookie Parser - Parse Netscape and JSON cookie formats
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
    const data = JSON.parse(content);
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
    
    // Detect format
    if (content.trim().startsWith('[')) {
      return parseJSON(content);
    } else {
      return parseNetscape(content);
    }
  } catch (error) {
    logger.error('cookies', 'Failed to load cookies', error);
    return '';
  }
}

/**
 * Get Facebook cookies from default locations
 * @returns {Promise<string>} Cookie header string
 */
export async function getFacebookCookies() {
  // Try multiple locations
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
    if (cookies) {
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
