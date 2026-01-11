/**
 * Crypto Utils - URL encryption/decryption
 * 
 * Encrypts URLs to short-ish hashes for stream/download endpoints.
 * Stateless - no memory store needed, URLs can be decrypted anytime.
 * 
 * Uses AES-128-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-128-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from env
 * Must be 32 hex chars (16 bytes)
 */
function getKey(): Buffer {
  const key = process.env.URL_ENCRYPT_KEY;
  if (!key || key.length !== 32) {
    throw new Error('URL_ENCRYPT_KEY must be 32 hex characters');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt URL to base64url string
 * Format: base64url(iv + authTag + ciphertext)
 * 
 * @param url - URL to encrypt
 * @returns Encrypted string (base64url)
 */
export function encryptUrl(url: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(url, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  
  // Combine: iv (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  // Use base64url (URL-safe)
  return combined.toString('base64url');
}

/**
 * Decrypt base64url string back to URL
 * 
 * @param encrypted - Encrypted string (base64url)
 * @returns Original URL or null if invalid
 */
export function decryptUrl(encrypted: string): string | null {
  try {
    const key = getKey();
    const combined = Buffer.from(encrypted, 'base64url');
    
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return null;
    }
    
    // Extract parts
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Check if encryption is configured
 */
export function isEncryptionEnabled(): boolean {
  const key = process.env.URL_ENCRYPT_KEY;
  return !!key && key.length === 32;
}
