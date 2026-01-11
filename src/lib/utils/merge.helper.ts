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
  videoUrl: string;
  audioUrl: string;
  filename?: string;
}

/**
 * Build URL to the merge endpoint
 * 
 * @param options - Video URL, audio URL, and optional filename
 * @returns Properly encoded URL to /api/v1/merge endpoint
 */
export function buildMergeUrl(options: MergeUrlOptions): string {
  const params = new URLSearchParams();
  params.set('videoUrl', options.videoUrl);
  params.set('audioUrl', options.audioUrl);
  
  if (options.filename) {
    params.set('filename', options.filename);
  }
  
  return `/api/v1/merge?${params.toString()}`;
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
  
  // Find all audio items
  const audioItems = items.filter(item => item.type === 'audio');
  
  if (audioItems.length === 0) {
    return null;
  }
  
  // Collect all audio sources
  const audioSources: MediaSource[] = [];
  for (const item of audioItems) {
    if (item.sources && item.sources.length > 0) {
      audioSources.push(...item.sources);
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
