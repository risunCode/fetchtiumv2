/**
 * GET /api/v1/hls-proxy
 * HLS Proxy for CORS-restricted streams (YouTube, etc.)
 * 
 * Instead of transcoding the entire stream (slow, downloads full),
 * this proxies the HLS manifest and segments on-demand.
 * 
 * Flow:
 * 1. Client requests manifest: /api/v1/hls-proxy?url=<m3u8_url>
 * 2. We fetch manifest, rewrite segment URLs to go through this proxy
 * 3. Client (HLS.js) requests segments through this proxy
 * 4. We fetch and forward segments on-demand
 * 
 * This allows true streaming - play while downloading segments.
 * 
 * Query parameters:
 * - url: string - HLS manifest URL (.m3u8) or segment URL
 * - type: 'manifest' | 'segment' - What to fetch (default: auto-detect)
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Common headers for YouTube requests
const YOUTUBE_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.youtube.com',
  'Referer': 'https://www.youtube.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

/**
 * Rewrite segment URLs in HLS manifest to go through our proxy
 */
function rewriteManifest(manifest: string, baseUrl: string, proxyBase: string): string {
  const lines = manifest.split('\n');
  const rewritten: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments (except EXT tags)
    if (!trimmed) {
      rewritten.push(line);
      continue;
    }
    
    // If it's a URL (segment or sub-playlist)
    if (!trimmed.startsWith('#')) {
      let segmentUrl: string;
      
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        // Absolute URL
        segmentUrl = trimmed;
      } else if (trimmed.startsWith('/')) {
        // Root-relative URL
        const urlObj = new URL(baseUrl);
        segmentUrl = `${urlObj.protocol}//${urlObj.host}${trimmed}`;
      } else {
        // Relative URL
        const lastSlash = baseUrl.lastIndexOf('/');
        const base = lastSlash > 8 ? baseUrl.substring(0, lastSlash + 1) : baseUrl + '/';
        segmentUrl = base + trimmed;
      }
      
      // Rewrite to go through our proxy
      const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(segmentUrl)}&type=segment`;
      rewritten.push(proxiedUrl);
    } else {
      // Keep EXT tags as-is
      rewritten.push(line);
    }
  }
  
  return rewritten.join('\n');
}

/**
 * GET handler - proxy HLS manifest or segment
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl.searchParams.get('url');
  const type = request.nextUrl.searchParams.get('type');
  
  if (!url) {
    return new Response(JSON.stringify({ 
      error: { code: 'MISSING_URL', message: 'URL parameter required' } 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Auto-detect type if not specified
  const isManifest = type === 'manifest' || (!type && (url.includes('.m3u8') || url.includes('playlist')));
  
  try {
    logger.info('hls-proxy', `Fetching ${isManifest ? 'manifest' : 'segment'}`, { 
      url: url.substring(0, 150),
      type: type || 'auto',
    });
    
    const response = await fetch(url, {
      headers: YOUTUBE_HEADERS,
    });
    
    if (!response.ok) {
      logger.warn('hls-proxy', 'Upstream error', { 
        status: response.status, 
        statusText: response.statusText,
        url: url.substring(0, 150) 
      });
      return new Response(JSON.stringify({ 
        error: { code: 'UPSTREAM_ERROR', message: `Upstream returned ${response.status}` } 
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (isManifest) {
      // Fetch and rewrite manifest
      const manifest = await response.text();
      
      // Build proxy base URL - use request headers to determine correct protocol/host
      // In development, use localhost; in production, use the actual host
      const host = request.headers.get('host') || request.nextUrl.host;
      const protocol = request.headers.get('x-forwarded-proto') || 
                       (host.includes('localhost') ? 'http' : 'https');
      const proxyBase = `${protocol}://${host}/api/v1/hls-proxy`;
      
      logger.debug('hls-proxy', 'Building proxy URLs', { protocol, host, proxyBase });
      
      // Rewrite URLs in manifest
      const rewritten = rewriteManifest(manifest, url, proxyBase);
      
      logger.debug('hls-proxy', 'Manifest rewritten', { 
        originalLines: manifest.split('\n').length,
        rewrittenLines: rewritten.split('\n').length,
      });
      
      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      // Stream segment directly
      const contentType = response.headers.get('Content-Type') || 'video/mp2t';
      const contentLength = response.headers.get('Content-Length');
      
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600', // Cache segments for 1 hour
      };
      
      if (contentLength) {
        headers['Content-Length'] = contentLength;
      }
      
      return new Response(response.body, {
        status: 200,
        headers,
      });
    }
  } catch (error) {
    logger.error('hls-proxy', 'Proxy failed', {
      error: error instanceof Error ? error.message : String(error),
      url: url.substring(0, 100),
    });
    
    return new Response(JSON.stringify({ 
      error: { code: 'PROXY_FAILED', message: 'Failed to proxy HLS stream' } 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
