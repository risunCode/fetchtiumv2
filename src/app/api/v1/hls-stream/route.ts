/**
 * GET /api/v1/hls-stream
 * Server-side media stream conversion via FFmpeg
 * 
 * Supports:
 * - HLS playlists (.m3u8) - YouTube, SoundCloud
 * - DASH segments (.m4s) - BiliBili (video + audio merge)
 * 
 * Returns a single streamable audio/video file
 * 
 * Query parameters:
 * - url: string - Media URL (m3u8 or m4s)
 * - audioUrl: string - Separate audio URL for BiliBili video+audio merge
 * - h: string - Hash from extraction result
 * - type: 'audio' | 'video' - Output type (default: audio)
 * 
 * Works on Vercel via ffmpeg-static package
 */

import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { isValidUrl as isStoredUrl, getUrlByHash } from '@/lib/utils/url-store';
import { logger } from '@/lib/utils/logger';
import { 
  isBiliBiliUrl, 
  isYouTubeUrl, 
  getPlatformHeaders, 
  buildFFmpegHeadersString,
  COMMON_USER_AGENT 
} from '@/lib/utils/platform-headers';
import path from 'path';
import fs from 'fs';

/**
 * Get FFmpeg binary path
 * Priority: System ffmpeg (Railway) > ffmpeg-static (Vercel/local)
 */
function getFFmpegPath(): string | null {
  // In production (Railway), prefer system ffmpeg which has full codec support
  const systemPaths = [
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ];
  
  for (const p of systemPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  // Fallback: Try ffmpeg-static (for Vercel/local dev)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {
    // Ignore
  }
  
  // Last resort: look in node_modules directly
  const nodePaths = [
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  ];
  
  for (const p of nodePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max (Vercel Pro), 10s on free tier

/**
 * GET handler - converts HLS to progressive stream via FFmpeg
 */
export async function GET(request: NextRequest): Promise<Response> {
  const urlParam = request.nextUrl.searchParams.get('url');
  const audioUrlParam = request.nextUrl.searchParams.get('audioUrl'); // For BiliBili video+audio merge
  const hashParam = request.nextUrl.searchParams.get('h');
  const outputType = request.nextUrl.searchParams.get('type') || 'audio'; // 'audio' or 'video'

  // Resolve URL from hash or direct param
  let url: string | null = null;
  
  if (hashParam) {
    url = getUrlByHash(hashParam);
    if (!url) {
      return new Response(JSON.stringify({ 
        error: { code: 'INVALID_HASH', message: 'Invalid or expired hash' } 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else if (urlParam) {
    url = urlParam;
  }

  if (!url) {
    return new Response(JSON.stringify({ 
      error: { code: 'MISSING_PARAMETER', message: 'URL or hash parameter required' } 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Detect stream type using platform header utilities
  const isHls = url.includes('.m3u8') || url.includes('playlist') || url.includes('/index.m3u8');
  const isBiliBiliDash = url.includes('.m4s') && isBiliBiliUrl(url);
  const isYouTube = isYouTubeUrl(url);

  // Validate URL is from previous extraction
  // Skip validation for YouTube/BiliBili - they have their own expiry mechanism
  if (!hashParam && !isYouTube && !isBiliBiliDash && !isStoredUrl(url)) {
    logger.warn('hls-stream', 'URL not authorized', { url: url.substring(0, 100) });
    return new Response(JSON.stringify({ 
      error: { code: 'UNAUTHORIZED_URL', message: 'URL not authorized' } 
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // For BiliBili video, check if we have separate audio URL for merging
  const hasSeparateAudio = isBiliBiliDash && audioUrlParam && outputType === 'video';
  
  logger.info('hls-stream', 'Stream type detection', { isHls, isBiliBiliDash, isYouTube, hasSeparateAudio, urlStart: url.substring(0, 80) });
  
  if (!isHls && !isBiliBiliDash) {
    logger.warn('hls-stream', 'Unsupported format', { url: url.substring(0, 100) });
    return new Response(JSON.stringify({ 
      error: { code: 'UNSUPPORTED_FORMAT', message: 'URL must be HLS (.m3u8) or BiliBili DASH (.m4s)' } 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  logger.info('hls-stream', 'Converting stream to progressive', { 
    url: url.substring(0, 80),
    type: outputType,
    format: isBiliBiliDash ? 'bilibili-dash' : 'hls'
  });

  try {
    // Get FFmpeg path
    const ffmpegBinary = getFFmpegPath();
    
    // Check if ffmpeg is available
    if (!ffmpegBinary) {
      logger.error('hls-stream', 'FFmpeg not found');
      return new Response(JSON.stringify({ 
        error: { code: 'FFMPEG_NOT_AVAILABLE', message: 'FFmpeg not available' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info('hls-stream', 'Starting FFmpeg', { 
      ffmpegPath: ffmpegBinary,
      url: url.substring(0, 100), 
      type: outputType,
      isHls,
      isYouTube,
    });

    // Build FFmpeg args based on source and output type
    let ffmpegArgs: string[];
    let contentType: string;
    
    if (isBiliBiliDash) {
      // BiliBili DASH segment - use platform headers utility
      const platformHeaders = getPlatformHeaders(url);
      const headersString = buildFFmpegHeadersString(platformHeaders);
      
      if (outputType === 'video') {
        // Check if we have separate audio to merge
        if (hasSeparateAudio && audioUrlParam) {
          // Two inputs: video + audio, merge them
          ffmpegArgs = [
            '-hide_banner',
            '-loglevel', 'error',
            '-user_agent', platformHeaders.userAgent,
            '-headers', headersString,
            '-i', url,                // Input 0: video
            '-user_agent', platformHeaders.userAgent,
            '-headers', headersString,
            '-i', audioUrlParam,      // Input 1: audio
            '-c:v', 'copy',           // Copy video codec
            '-c:a', 'aac',            // Transcode audio to AAC
            '-b:a', '128k',
            '-map', '0:v:0',          // Map video from input 0
            '-map', '1:a:0',          // Map audio from input 1
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-f', 'mp4',
            '-',
          ];
        } else {
          // Single input video (may be video-only)
          ffmpegArgs = [
            '-hide_banner',
            '-loglevel', 'error',
            '-user_agent', platformHeaders.userAgent,
            '-headers', headersString,
            '-i', url,
            '-c:v', 'copy',           // Copy video codec
            '-c:a', 'aac',            // Transcode audio to AAC (if present)
            '-b:a', '128k',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-f', 'mp4',
            '-',
          ];
        }
        contentType = 'video/mp4';
      } else {
        ffmpegArgs = [
          '-hide_banner',
          '-loglevel', 'error',
          '-user_agent', platformHeaders.userAgent,
          '-headers', headersString,
          '-i', url,
          '-vn',
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-f', 'mp3',
          '-',
        ];
        contentType = 'audio/mpeg';
      }
    } else if (outputType === 'video') {
      // YouTube/other HLS video - use platform headers utility
      const platformHeaders = getPlatformHeaders(url);
      const headersString = buildFFmpegHeadersString(platformHeaders);
      
      ffmpegArgs = [
        '-hide_banner',
        '-loglevel', 'warning',   // Show warnings to debug issues
        '-reconnect', '1',        // Reconnect on errors
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,hls', // Enable HLS protocol
        '-user_agent', platformHeaders.userAgent,
        ...(headersString ? ['-headers', headersString] : []),
        '-i', url,
        '-c:v', 'copy',           // Copy video codec (no re-encode)
        '-c:a', 'aac',            // Transcode audio to AAC (widely supported)
        '-b:a', '128k',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof', // Fragmented MP4 for streaming
        '-f', 'mp4',
        '-',
      ];
      contentType = 'video/mp4';
    } else {
      // HLS audio (SoundCloud, etc.) - use common user agent
      ffmpegArgs = [
        '-hide_banner',
        '-loglevel', 'error',
        '-user_agent', COMMON_USER_AGENT,
        '-headers', 'Referer: https://soundcloud.com/\r\n',
        '-i', url,
        '-vn',                    // No video
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-f', 'mp3',
        '-',
      ];
      contentType = 'audio/mpeg';
    }

    const ffmpeg = spawn(ffmpegBinary, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let hasData = false;
    let stderrOutput = '';

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      hasData = true;
      writer.write(new Uint8Array(chunk)).catch(() => {});
    });

    ffmpeg.stdout.on('end', () => {
      writer.close().catch(() => {});
    });

    ffmpeg.stdout.on('error', (err) => {
      logger.error('hls-stream', 'Stream error', { error: err.message });
      writer.abort(err).catch(() => {});
    });

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
    });

    ffmpeg.on('error', (err) => {
      logger.error('hls-stream', 'FFmpeg error', { error: err.message });
      writer.abort(new Error('FFmpeg not available')).catch(() => {});
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0 && !hasData) {
        logger.error('hls-stream', 'FFmpeg failed', { code, stderr: stderrOutput.substring(0, 500) });
        writer.abort(new Error(`FFmpeg failed with code ${code}`)).catch(() => {});
      }
    });

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Accept-Ranges': 'none', // Can't seek in live transcode
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    logger.error('hls-stream', 'Conversion failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(JSON.stringify({ 
      error: { code: 'CONVERSION_FAILED', message: 'HLS conversion failed' } 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
