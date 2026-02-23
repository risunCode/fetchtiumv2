/**
 * Merge Helper Utilities
 * 
 * Client-side helpers for building merge URLs and detecting when
 * video-audio merge is needed for platforms like YouTube and BiliBili.
 */

import { MediaSource, MediaItem } from '@/types/extract';

/**
 * Options for building a merge URL
 */
export interface MergeUrlOptions {
  videoUrl?: string;
  audioUrl?: string;
  videoHash?: string;
  audioHash?: string;
  filename?: string;
  copyAudio?: boolean;
}

/**
 * Build URL to the merge endpoint
 * 
 * @param options - Video URL, audio URL, and optional filename
 * @returns Properly encoded URL to /api/v1/merge endpoint
 */
export function buildMergeUrl(options: MergeUrlOptions): string {
  const params = new URLSearchParams();

  if (options.videoHash) {
    params.set('videoH', options.videoHash);
  } else if (options.videoUrl) {
    params.set('videoUrl', options.videoUrl);
  }

  if (options.audioHash) {
    params.set('audioH', options.audioHash);
  } else if (options.audioUrl) {
    params.set('audioUrl', options.audioUrl);
  }
  
  if (options.filename) {
    params.set('filename', options.filename);
  }

  if (options.copyAudio) {
    params.set('copyAudio', '1');
  }
  
  return `/api/v1/merge?${params.toString()}`;
}

/**
 * Check if audio stream can be copied safely in merge endpoint.
 *
 * Safe candidates:
 * - extension: m4a, aac
 * - mime: audio/mp4, audio/aac
 */
export function shouldCopyAudioStream(source: Pick<MediaSource, 'extension' | 'mime'> | null | undefined): boolean {
  if (!source) {
    return false;
  }

  const extension = (source.extension || '').toLowerCase();
  const mime = (source.mime || '').toLowerCase();

  if (extension === 'm4a' || extension === 'aac') {
    return true;
  }

  return mime.includes('audio/mp4') || mime.includes('audio/aac');
}

/**
 * Check if a media source needs video-audio merge
 * 
 * Returns true when:
 * - hasAudio is explicitly false (video-only stream)
 * - URL contains .m4s (BiliBili DASH segment, always video-only)
 * 
 * @param source - Media source to check
 * @returns true if source needs merge with separate audio
 */
export function needsMerge(source: MediaSource): boolean {
  if (!source || !source.url) {
    return false;
  }
  
  // BiliBili DASH segments (.m4s) are always video-only
  if (source.url.includes('.m4s')) {
    return true;
  }
  
  // Explicit video-only flag (YouTube, etc.)
  if (source.hasAudio === false) {
    return true;
  }
  
  return false;
}

/**
 * Find the best audio source from a list of media items
 * 
 * Priority:
 * 1. AAC/M4A format (best compatibility)
 * 2. Highest bitrate available
 * 3. First available audio source
 * 
 * @param items - Array of media items to search
 * @returns Best audio source, or null if none found
 */
export function findBestAudio(items: MediaItem[]): MediaSource | null {
  if (!items || items.length === 0) {
    return null;
  }
  
  // Find all explicit audio items first
  let audioItems = items.filter(item => item.type === 'audio');

  // Backward-safe fallback for older payloads that mixed audio-like sources
  // into non-audio items.
  if (audioItems.length === 0) {
    audioItems = items.filter(item =>
      (item.sources || []).some(source => (source.mime || '').toLowerCase().startsWith('audio/'))
    );
  }

  if (audioItems.length === 0) {
    return null;
  }
  
  // Collect all audio sources
  const audioSources: MediaSource[] = [];
  for (const item of audioItems) {
    if (item.sources && item.sources.length > 0) {
      audioSources.push(
        ...item.sources.filter(source => {
          if (item.type === 'audio') {
            return true;
          }
          return (source.mime || '').toLowerCase().startsWith('audio/');
        })
      );
    }
  }
  
  if (audioSources.length === 0) {
    return null;
  }
  
  // Priority 1: Find AAC/M4A sources
  const aacSources = audioSources.filter(source => 
    source.extension === 'm4a' || 
    source.mime?.includes('mp4') ||
    source.mime?.includes('m4a')
  );
  
  if (aacSources.length > 0) {
    // Return highest bitrate AAC source
    return aacSources.reduce((best, current) => {
      const bestBitrate = best.bitrate ?? 0;
      const currentBitrate = current.bitrate ?? 0;
      return currentBitrate > bestBitrate ? current : best;
    });
  }
  
  // Priority 2: Return highest bitrate from all sources
  return audioSources.reduce((best, current) => {
    const bestBitrate = best.bitrate ?? 0;
    const currentBitrate = current.bitrate ?? 0;
    return currentBitrate > bestBitrate ? current : best;
  });
}
