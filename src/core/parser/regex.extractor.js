/**
 * Regex Extractor - Scoped regex extraction utilities
 * 
 * RULES:
 * - Extract from FRAGMENT, NOT full HTML
 * - Scoped extraction only
 * - Helper functions for common patterns
 */

import { logger } from '../../utils/logger.js';

/**
 * Decode URL-encoded string
 * @param {string} str - Encoded string
 * @returns {string} Decoded string
 */
export function decodeUrl(str) {
  try {
    return decodeURIComponent(str.replace(/\\\//g, '/'));
  } catch (error) {
    return str.replace(/\\\//g, '/');
  }
}

/**
 * Clean JSON string (remove escapes)
 * @param {string} str - JSON string
 * @returns {string} Cleaned string
 */
export function cleanJsonString(str) {
  return str
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&');
}

/**
 * Extract all matches for a regex pattern
 * @param {string} text - Text to search
 * @param {RegExp} pattern - Regex pattern (must have 'g' flag)
 * @param {number} limit - Max matches to return
 * @returns {Array} Array of matches
 */
export function extractAll(text, pattern, limit = 100) {
  const matches = [];
  let match;
  let count = 0;

  while ((match = pattern.exec(text)) !== null && count < limit) {
    matches.push(match);
    count++;
  }

  return matches;
}

/**
 * Extract first match for a regex pattern
 * @param {string} text - Text to search
 * @param {RegExp} pattern - Regex pattern
 * @returns {Array|null} Match array or null
 */
export function extractFirst(text, pattern) {
  return text.match(pattern);
}

/**
 * Extract JSON from text
 * Handles common JSON extraction patterns
 * @param {string} text - Text containing JSON
 * @param {string} startMarker - Start marker (optional)
 * @returns {object|null} Parsed JSON or null
 */
export function extractJson(text, startMarker = null) {
  try {
    let jsonText = text;

    if (startMarker) {
      const startIdx = text.indexOf(startMarker);
      if (startIdx === -1) return null;
      jsonText = text.substring(startIdx);
    }

    // Try to find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return null;
  }
}

/**
 * Extract URLs from text
 * @param {string} text - Text to search
 * @param {object} options - Options
 * @param {string} options.protocol - Filter by protocol (http/https)
 * @param {string} options.domain - Filter by domain pattern
 * @returns {string[]} Array of URLs
 */
export function extractUrls(text, options = {}) {
  const { protocol, domain } = options;
  
  // URL pattern
  const urlPattern = /https?:\/\/[^\s"'<>\\]+/gi;
  const matches = extractAll(text, urlPattern);
  
  let urls = matches.map(m => m[0]);

  // Filter by protocol
  if (protocol) {
    urls = urls.filter(url => url.startsWith(protocol + '://'));
  }

  // Filter by domain
  if (domain) {
    const domainPattern = new RegExp(domain, 'i');
    urls = urls.filter(url => domainPattern.test(url));
  }

  // Deduplicate
  return [...new Set(urls)];
}

/**
 * Extract video URLs from fragment
 * Common patterns for video URLs
 * @param {string} fragment - HTML/JSON fragment
 * @param {object} options - Options
 * @returns {string[]} Array of video URLs
 */
export function extractVideoUrls(fragment, options = {}) {
  const videoExtensions = /\.(mp4|webm|m4v|mov|avi|mkv|flv)/i;
  const urls = extractUrls(fragment, options);
  
  return urls.filter(url => {
    // Check extension
    if (videoExtensions.test(url)) return true;
    
    // Check common video CDN patterns
    if (/video|stream|cdn|fbcdn|scontent/i.test(url)) return true;
    
    return false;
  });
}

/**
 * Extract image URLs from fragment
 * Common patterns for image URLs
 * @param {string} fragment - HTML/JSON fragment
 * @param {object} options - Options
 * @returns {string[]} Array of image URLs
 */
export function extractImageUrls(fragment, options = {}) {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)/i;
  const urls = extractUrls(fragment, options);
  
  return urls.filter(url => {
    // Check extension
    if (imageExtensions.test(url)) return true;
    
    // Check common image CDN patterns
    if (/image|photo|img|cdn|fbcdn|scontent/i.test(url)) return true;
    
    return false;
  });
}

/**
 * Extract value by key from JSON-like text
 * Handles cases where text is not valid JSON but contains key-value pairs
 * @param {string} text - Text to search
 * @param {string} key - Key to find
 * @returns {string|null} Value or null
 */
export function extractValueByKey(text, key) {
  // Try exact key match with quotes
  const quotedPattern = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
  const quotedMatch = text.match(quotedPattern);
  if (quotedMatch) return quotedMatch[1];

  // Try key match with number value
  const numberPattern = new RegExp(`"${key}"\\s*:\\s*(\\d+)`, 'i');
  const numberMatch = text.match(numberPattern);
  if (numberMatch) return numberMatch[1];

  // Try key match with boolean value
  const boolPattern = new RegExp(`"${key}"\\s*:\\s*(true|false)`, 'i');
  const boolMatch = text.match(boolPattern);
  if (boolMatch) return boolMatch[1];

  return null;
}

/**
 * Check if text contains any of the patterns
 * @param {string} text - Text to search
 * @param {Array<string|RegExp>} patterns - Patterns to check
 * @returns {boolean} True if any pattern matches
 */
export function containsAny(text, patterns) {
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return text.includes(pattern);
    }
    if (pattern instanceof RegExp) {
      return pattern.test(text);
    }
    return false;
  });
}

/**
 * Find position of first occurrence of any pattern
 * @param {string} text - Text to search
 * @param {Array<string|RegExp>} patterns - Patterns to find
 * @returns {number} Position or -1 if not found
 */
export function findFirst(text, patterns) {
  let minPos = -1;

  for (const pattern of patterns) {
    let pos = -1;
    
    if (typeof pattern === 'string') {
      pos = text.indexOf(pattern);
    } else if (pattern instanceof RegExp) {
      const match = text.match(pattern);
      if (match) pos = match.index;
    }

    if (pos !== -1 && (minPos === -1 || pos < minPos)) {
      minPos = pos;
    }
  }

  return minPos;
}
