/**
 * GET /api/v1/merge
 * Merge separate video and audio streams into a single MP4 file via FFmpeg
 * 
 * Query parameters:
 * - videoUrl: string (required) - Video stream URL
 * - audioUrl: string (required) - Audio stream URL
 * - filename: string (optional) - Output filename for Content-Disposition
 * - copyAudio: 1 (optional) - Copy audio codec instead of AAC transcode when safe
 * 
 * Supports:
 * - BiliBili DASH segments (video + audio merge)
 * - YouTube video-only streams
 * - Any platform with separate video/audio streams
 * 
 * Returns a streamable MP4 file with video and audio combined
 */

import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { isValidUrl as isStoredUrl, getUrlByHash } from '@/lib/utils/url-store';
import { 
  getPlatformHeaders, 
  buildFFmpegHeadersString,
  COMMON_USER_AGENT 
} from '@/lib/utils/platform-headers';
import { logger } from '@/lib/utils/logger';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max for merge operations

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

/**
 * Resolve URL from hash or direct parameter
 * Returns the resolved URL or null if invalid
 */
function resolveUrl(
  urlParam: string | null, 
  hashParam: string | null
): { url: string | null; fromHash: boolean } {
  if (hashParam) {
    const url = getUrlByHash(hashParam);
    return { url, fromHash: true };
  }
  return { url: urlParam, fromHash: false };
}

/**
 * GET handler - merges video and audio streams via FFmpeg
 */
export async function GET(request: NextRequest): Promise<Response> {
  // Get parameters
  const videoUrlParam = request.nextUrl.searchParams.get('videoUrl');
  const audioUrlParam = request.nextUrl.searchParams.get('audioUrl');
  const videoHashParam = request.nextUrl.searchParams.get('videoH');
  const audioHashParam = request.nextUrl.searchParams.get('audioH');
  const filename = request.nextUrl.searchParams.get('filename');
  const copyAudioRequested = request.nextUrl.searchParams.get('copyAudio') === '1';

  // Resolve video URL
  const videoResolved = resolveUrl(videoUrlParam, videoHashParam);
  const videoUrl = videoResolved.url;

  // Resolve audio URL
  const audioResolved = resolveUrl(audioUrlParam, audioHashParam);
  const audioUrl = audioResolved.url;

  // Validate required parameters
  if (!videoUrl) {
    return new Response(JSON.stringify({ 
      error: { 
        code: 'MISSING_PARAMETER', 
        message: 'videoUrl parameter is required' 
      } 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!audioUrl) {
    return new Response(JSON.stringify({ 
      error: { 
        code: 'MISSING_PARAMETER', 
        message: 'audioUrl parameter is required' 
      } 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if URLs are from known platforms with their own expiry
  const isYouTubeVideo = videoUrl.includes('googlevideo.com') || videoUrl.includes('youtube.com');
  const isBiliBiliVideo = videoUrl.includes('bilivideo.') || videoUrl.includes('bilibili.') || videoUrl.includes('akamaized.net');
  const isYouTubeAudio = audioUrl.includes('googlevideo.com') || audioUrl.includes('youtube.com');
  const isBiliBiliAudio = audioUrl.includes('bilivideo.') || audioUrl.includes('bilibili.') || audioUrl.includes('akamaized.net');

  // Validate URLs are from previous extraction (security check)
  // Skip validation for YouTube/BiliBili - they have their own expiry mechanism
  if (!videoResolved.fromHash && !isYouTubeVideo && !isBiliBiliVideo && !isStoredUrl(videoUrl)) {
    logger.warn('merge', 'Video URL not authorized', { url: videoUrl.substring(0, 50) });
    return new Response(JSON.stringify({ 
      error: { 
        code: 'UNAUTHORIZED_URL', 
        message: 'Video URL not authorized' 
      } 
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!audioResolved.fromHash && !isYouTubeAudio && !isBiliBiliAudio && !isStoredUrl(audioUrl)) {
    logger.warn('merge', 'Audio URL not authorized', { url: audioUrl.substring(0, 50) });
    return new Response(JSON.stringify({ 
      error: { 
        code: 'UNAUTHORIZED_URL', 
        message: 'Audio URL not authorized' 
      } 
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check FFmpeg availability
  const ffmpegBinary = getFFmpegPath();
  if (!ffmpegBinary) {
    logger.error('merge', 'FFmpeg not found');
    return new Response(JSON.stringify({ 
      error: { 
        code: 'FFMPEG_NOT_AVAILABLE', 
        message: 'FFmpeg is not available on the server' 
      } 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  logger.info('merge', 'Starting video-audio merge', { 
    videoUrl: videoUrl.substring(0, 80),
    audioUrl: audioUrl.substring(0, 80),
    filename: filename || 'none',
    copyAudioRequested,
  });

  try {
    // Get platform-specific headers for each input
    const videoHeaders = getPlatformHeaders(videoUrl);
    const audioHeaders = getPlatformHeaders(audioUrl);

    // Build FFmpeg headers strings
    const videoHeadersStr = buildFFmpegHeadersString(videoHeaders);
    const audioHeadersStr = buildFFmpegHeadersString(audioHeaders);

    // Create transform stream for response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const buildFfmpegArgs = (copyAudio: boolean): string[] => {
      const ffmpegArgs: string[] = [
        '-hide_banner',
        '-loglevel', 'error',
      ];

      // Input 0: Video stream with platform headers
      ffmpegArgs.push(
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-user_agent', COMMON_USER_AGENT,
      );
      if (videoHeadersStr) {
        ffmpegArgs.push('-headers', videoHeadersStr);
      }
      ffmpegArgs.push('-i', videoUrl);

      // Input 1: Audio stream with platform headers
      ffmpegArgs.push(
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-user_agent', COMMON_USER_AGENT,
      );
      if (audioHeadersStr) {
        ffmpegArgs.push('-headers', audioHeadersStr);
      }
      ffmpegArgs.push('-i', audioUrl);

      ffmpegArgs.push(
        '-c:v', 'copy',
      );

      if (copyAudio) {
        ffmpegArgs.push('-c:a', 'copy');
      } else {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
      }

      ffmpegArgs.push(
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4',
        '-',
      );

      return ffmpegArgs;
    };

    let writerClosed = false;
    const closeWriter = () => {
      if (!writerClosed) {
        writerClosed = true;
        writer.close().catch(() => {});
      }
    };
    const abortWriter = (error: Error) => {
      if (!writerClosed) {
        writerClosed = true;
        writer.abort(error).catch(() => {});
      }
    };

    let retriedWithTranscode = false;

    const spawnMerge = (copyAudio: boolean) => {
      const ffmpeg = spawn(ffmpegBinary, buildFfmpegArgs(copyAudio), {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let hasData = false;
      let stderrOutput = '';

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        hasData = true;
        writer.write(new Uint8Array(chunk)).catch(() => {});
      });

      ffmpeg.stdout.on('error', (err) => {
        logger.error('merge', 'Stream error', { error: err.message, copyAudio });
        abortWriter(err instanceof Error ? err : new Error('FFmpeg stdout stream failed'));
      });

      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderrOutput += data.toString();
      });

      ffmpeg.on('error', (err) => {
        logger.error('merge', 'FFmpeg process error', { error: err.message, copyAudio });
        abortWriter(new Error('FFmpeg process failed'));
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          closeWriter();
          return;
        }

        const canRetryWithTranscode = copyAudioRequested && copyAudio && !retriedWithTranscode && !hasData;
        if (canRetryWithTranscode) {
          retriedWithTranscode = true;
          logger.warn('merge', 'Retrying merge with AAC transcode fallback', {
            code,
            stderr: stderrOutput.substring(0, 500),
          });
          spawnMerge(false);
          return;
        }

        logger.error('merge', 'FFmpeg failed', {
          code,
          copyAudio,
          stderr: stderrOutput.substring(0, 500),
        });

        if (!hasData) {
          abortWriter(new Error(`FFmpeg failed with code ${code}`));
        } else {
          closeWriter();
        }
      });
    };

    spawnMerge(copyAudioRequested);

    // Build response headers
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'none', // Can't seek in live transcode
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    };

    // Add Content-Disposition if filename provided
    if (filename) {
      // Sanitize filename and ensure .mp4 extension
      const sanitizedFilename = filename
        .replace(/[^\w\s.-]/g, '_')
        .replace(/\s+/g, '_');
      const finalFilename = sanitizedFilename.endsWith('.mp4') 
        ? sanitizedFilename 
        : sanitizedFilename.replace(/\.[^.]+$/, '.mp4') || `${sanitizedFilename}.mp4`;
      
      responseHeaders['Content-Disposition'] = `attachment; filename="${finalFilename}"`;
    }

    return new Response(readable, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error('merge', 'Merge failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(JSON.stringify({ 
      error: { 
        code: 'MERGE_FAILED', 
        message: 'Video-audio merge failed' 
      } 
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
