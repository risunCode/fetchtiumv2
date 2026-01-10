/**
 * Response Builder - Standardize API response format
 * 
 * Handles:
 * - Stats/Engagement (views, likes, comments, shares) - for all platforms
 * - Meta (responseTime, accessMode, publicContent)
 */

/**
 * Standard engagement/stats fields
 * Supported by: YouTube, Facebook, Instagram, Twitter/X
 */
const ENGAGEMENT_FIELDS = ['views', 'likes', 'comments', 'shares', 'reposts', 'quotes', 'bookmarks'];

/**
 * Normalize engagement stats from raw extractor output
 * @param {object} rawStats - Raw stats from extractor
 * @returns {object} Normalized stats
 */
export function normalizeStats(rawStats) {
  if (!rawStats || typeof rawStats !== 'object') return null;
  
  const stats = {};
  
  for (const field of ENGAGEMENT_FIELDS) {
    if (rawStats[field] !== undefined && rawStats[field] !== null) {
      // Ensure it's a number
      const value = typeof rawStats[field] === 'number' 
        ? rawStats[field] 
        : parseInt(rawStats[field], 10);
      
      if (!isNaN(value) && value >= 0) {
        stats[field] = value;
      }
    }
  }
  
  // Platform-specific mappings
  // Twitter: retweets -> shares
  if (rawStats.retweets && !stats.shares) {
    stats.shares = rawStats.retweets;
  }
  // Twitter: replies -> comments
  if (rawStats.replies && !stats.comments) {
    stats.comments = rawStats.replies;
  }
  
  return Object.keys(stats).length > 0 ? stats : null;
}

/**
 * Build meta object for response
 * @param {object} options
 * @param {number} options.responseTime - Time taken in ms
 * @param {string} options.accessMode - 'public' or 'api-key'
 * @param {boolean} options.usedCookie - Whether cookie was used for extraction
 * @returns {object} Meta object
 */
export function buildMeta(options = {}) {
  const { responseTime, accessMode, usedCookie } = options;
  
  return {
    responseTime: responseTime || 0,
    accessMode: accessMode || 'public',
    publicContent: !usedCookie
  };
}

/**
 * Build standardized API response
 * @param {object} extractResult - Raw result from extractor
 * @param {object} options - Additional options
 * @param {number} options.responseTime - Time taken in ms
 * @param {string} options.accessMode - Access mode used
 * @param {boolean} options.usedCookie - Whether cookie was used
 * @returns {object} Standardized response
 */
export function buildResponse(extractResult, options = {}) {
  if (!extractResult) {
    return {
      success: false,
      error: { code: 'EXTRACTION_FAILED', message: 'No result' },
      meta: buildMeta(options)
    };
  }
  
  // If error response, just add meta
  if (!extractResult.success) {
    return {
      ...extractResult,
      meta: buildMeta(options)
    };
  }
  
  // Build successful response
  const response = {
    success: true,
    platform: extractResult.platform,
    contentType: extractResult.contentType
  };
  
  // Basic info
  if (extractResult.title) response.title = extractResult.title;
  if (extractResult.author) response.author = extractResult.author;
  if (extractResult.id) response.id = extractResult.id;
  if (extractResult.description) response.description = extractResult.description;
  if (extractResult.uploadDate) response.uploadDate = extractResult.uploadDate;
  if (extractResult.duration) response.duration = extractResult.duration;
  
  // Normalize stats/engagement
  const stats = normalizeStats(extractResult.stats || extractResult.engagement);
  if (stats) response.stats = stats;
  
  // Items (media)
  if (extractResult.items) response.items = extractResult.items;
  
  // Meta
  response.meta = buildMeta(options);
  
  return response;
}

/**
 * Build error response
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {object} options - Meta options
 * @returns {object} Error response
 */
export function buildErrorResponse(code, message, options = {}) {
  return {
    success: false,
    error: { code, message },
    meta: buildMeta(options)
  };
}
