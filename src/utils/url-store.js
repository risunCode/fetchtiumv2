/**
 * URL Store - Temporary storage for extracted URLs
 * 
 * Prevents open proxy abuse by only allowing download of URLs
 * that were previously extracted through /v1/extract
 * 
 * URLs expire after TTL (default 5 minutes)
 * Stores base URL (without volatile query params) for flexible matching
 */

const store = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract base URL for storage (remove volatile params but keep essential ones)
 */
function getBaseUrl(url) {
  try {
    const parsed = new URL(url);
    // Keep just origin + pathname for matching
    // This allows slight param variations
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

/**
 * Add URL to store
 * @param {string} url - URL to store
 */
export function addUrl(url) {
  const baseUrl = getBaseUrl(url);
  store.set(baseUrl, Date.now());
  // Also store full URL for exact matches
  store.set(url, Date.now());
}

/**
 * Add multiple URLs to store
 * @param {string[]} urls - URLs to store
 */
export function addUrls(urls) {
  const now = Date.now();
  for (const url of urls) {
    const baseUrl = getBaseUrl(url);
    store.set(baseUrl, now);
    store.set(url, now);
  }
}

/**
 * Check if URL is in store and not expired
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is valid
 */
export function isValidUrl(url) {
  // Try exact match first
  let timestamp = store.get(url);
  
  // Try base URL match
  if (!timestamp) {
    const baseUrl = getBaseUrl(url);
    timestamp = store.get(baseUrl);
  }
  
  if (!timestamp) return false;
  
  const age = Date.now() - timestamp;
  if (age > TTL) {
    return false;
  }
  
  return true;
}

/**
 * Clean up expired URLs
 */
export function cleanup() {
  const now = Date.now();
  for (const [url, timestamp] of store.entries()) {
    if (now - timestamp > TTL) {
      store.delete(url);
    }
  }
}

/**
 * Get store stats
 * @returns {object} Store stats
 */
export function getStats() {
  cleanup();
  return {
    size: store.size,
    ttl: TTL
  };
}

// Cleanup every minute
setInterval(cleanup, 60 * 1000);
