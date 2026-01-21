'use client';

import { useState, useCallback } from 'react';
import type { ExtractResult, ExtractError } from '@/types/extract';
import type { ExtractRequest } from '@/types/api';
import { getSavedCookie, getSavedApiKey, detectPlatformFromUrl } from '@/components/CookieModal';
import { fetchWithCSRF } from '@/lib/utils/csrf';

/**
 * Extraction state
 */
export interface ExtractState {
  isLoading: boolean;
  result: ExtractResult | null;
  error: ExtractError | null;
}

/**
 * useExtract hook return type
 */
export interface UseExtractReturn extends ExtractState {
  extract: (url: string) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for handling media extraction
 * Manages extraction state and API calls to /api/v1/extract
 * 
 * Cookie Strategy (3-tier, handled by backend):
 * 1. Guest Mode - No cookie (for public content)
 * 2. Server Cookie - From server file/env (auto-retry on auth error)
 * 3. Client Cookie - From user localStorage (last resort)
 * 
 * Frontend always sends client cookie if available, but backend decides when to use it.
 * 
 * @returns {UseExtractReturn} Extraction state and handlers
 */
export function useExtract(): UseExtractReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<ExtractError | null>(null);

  /**
   * Reset extraction state
   */
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  /**
   * Extract media from URL
   * Automatically includes client cookie from localStorage if available.
   * Backend handles 3-tier cookie strategy (guest → server → client).
   * 
   * Cookie is sent for platforms that support it:
   * - Facebook: Uses cookie for private content
   * - Instagram: Uses cookie for private content (GraphQL → Internal API)
   * - Twitter: Uses cookie for private content (Syndication → GraphQL)
   * - TikTok: No cookie needed (uses TikWM API)
   * 
   * Per Requirement 4.3: Frontend sends client cookie to backend if available for the platform.
   * 
   * @param url - URL to extract media from
   */
  const extract = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Get client cookie from localStorage
      let clientCookie: string | undefined;
      const platform = detectPlatformFromUrl(url);
      if (platform) {
        clientCookie = getSavedCookie(platform) || undefined;
      }

      const requestBody: ExtractRequest = {
        url,
        // Always send client cookie if available - backend decides when to use
        ...(clientCookie && { cookie: clientCookie }),
      };

      // Get API key from localStorage
      const apiKey = getSavedApiKey();

      const response = await fetchWithCSRF('/api/v1/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include API key if configured
          ...(apiKey && { 'x-api-key': apiKey }),
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data as ExtractResult);
      } else {
        setError(data as ExtractError);
      }
    } catch (err) {
      // Network or unexpected error
      setError({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
        meta: {
          responseTime: 0,
          accessMode: 'public',
          publicContent: true,
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    result,
    error,
    extract,
    reset,
  };
}

export default useExtract;
