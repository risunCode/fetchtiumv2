/**
 * CSRF Token Utility
 * 
 * Provides functions to retrieve and manage CSRF tokens for API requests.
 * The CSRF token is automatically set by the backend in a cookie on GET requests
 * and must be included in the X-CSRF-Token header for state-changing requests.
 */

/**
 * Get CSRF token from cookie
 * 
 * The backend sets a cookie named 'csrf_token' on GET requests.
 * This function retrieves that token to include in POST/PUT/DELETE/PATCH requests.
 * 
 * @returns CSRF token string or null if not found
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') {
    // Server-side rendering - no cookies available
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Add CSRF token to fetch headers
 * 
 * Convenience function to add the CSRF token to request headers.
 * Should be used for all POST/PUT/DELETE/PATCH requests.
 * 
 * @param headers - Existing headers object (optional)
 * @returns Headers object with CSRF token added
 */
export function addCSRFToken(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken();
  
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token,
    };
  }

  return headers;
}

/**
 * Fetch with CSRF token
 * 
 * Wrapper around fetch that automatically includes CSRF token for state-changing requests.
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Fetch promise
 */
export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (isStateChanging) {
    // Add CSRF token to headers for state-changing requests
    const headers = addCSRFToken(options.headers);
    return fetch(url, { ...options, headers });
  }

  // For GET/HEAD/OPTIONS, no CSRF token needed
  return fetch(url, options);
}
