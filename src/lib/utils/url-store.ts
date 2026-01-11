/**
 * URL Store - Encrypted URL handling for stream/download
 * 
 * Two modes:
 * 1. Encrypted (stateless): URL encrypted with AES, no memory store, no expiry
 * 2. Memory (fallback): If encryption not configured, use memory store with TTL
 * 
 * Encrypted mode is preferred - URLs can be decrypted anytime without server state.
 */

import { encryptUrl, decryptUrl, isEncryptionEnabled } from './crypto.utils';

/**
 * Store statistics interface
 */
export interface UrlStoreStats {
  mode: 'encrypted' | 'memory';
  memorySize?: number;
  ttl?: number;
}

// Fallback memory store (only used if encryption not configured)
const memoryStore = new Map<string, number>();
const TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Add URL and return hash/token
 * - Encrypted mode: Returns encrypted URL (stateless)
 * - Memory mode: Returns URL itself, stores in memory
 * 
 * @param url - URL to store/encrypt
 * @returns Hash/token for the URL
 */
export function addUrl(url: string): string {
  if (isEncryptionEnabled()) {
    return encryptUrl(url);
  }
  
  // Fallback: memory store
  memoryStore.set(url, Date.now());
  return url;
}

/**
 * Add multiple URLs and return hash map
 * 
 * @param urls - URLs to store/encrypt
 * @returns Map of URL to hash
 */
export function addUrls(urls: string[]): Map<string, string> {
  const hashes = new Map<string, string>();
  
  for (const url of urls) {
    hashes.set(url, addUrl(url));
  }
  
  return hashes;
}

/**
 * Get URL by hash/token
 * - Encrypted mode: Decrypts the hash
 * - Memory mode: Returns hash if valid in store
 * 
 * @param hash - Hash/token to lookup
 * @returns URL if valid, null otherwise
 */
export function getUrlByHash(hash: string): string | null {
  if (isEncryptionEnabled()) {
    return decryptUrl(hash);
  }
  
  // Fallback: check memory store
  const timestamp = memoryStore.get(hash);
  if (!timestamp) return null;
  
  if (Date.now() - timestamp > TTL) {
    memoryStore.delete(hash);
    return null;
  }
  
  return hash;
}

/**
 * Check if URL is valid (for backward compatibility)
 * In encrypted mode, always returns true (validation happens in getUrlByHash)
 * In memory mode, checks if URL exists and not expired
 * 
 * @param url - URL to check
 * @returns True if valid
 */
export function isValidUrl(url: string): boolean {
  if (isEncryptionEnabled()) {
    // In encrypted mode, we don't store URLs
    // Validation happens when decrypting the hash
    return true;
  }
  
  const timestamp = memoryStore.get(url);
  if (!timestamp) return false;
  
  if (Date.now() - timestamp > TTL) {
    memoryStore.delete(url);
    return false;
  }
  
  return true;
}

/**
 * Clean up expired URLs (memory mode only)
 */
export function cleanup(): void {
  if (isEncryptionEnabled()) return;
  
  const now = Date.now();
  for (const [url, timestamp] of memoryStore.entries()) {
    if (now - timestamp > TTL) {
      memoryStore.delete(url);
    }
  }
}

/**
 * Get store stats
 */
export function getStats(): UrlStoreStats {
  if (isEncryptionEnabled()) {
    return { mode: 'encrypted' };
  }
  
  cleanup();
  return {
    mode: 'memory',
    memorySize: memoryStore.size,
    ttl: TTL
  };
}

/**
 * Clear memory store (for testing)
 */
export function clear(): void {
  memoryStore.clear();
}

// Auto cleanup for memory mode
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCleanupInterval(): void {
  if (!cleanupInterval && !isEncryptionEnabled()) {
    cleanupInterval = setInterval(cleanup, 60 * 1000);
  }
}

export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  startCleanupInterval();
}
