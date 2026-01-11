'use client';

import { useState, useCallback } from 'react';
import { MediaItem, MediaSource, ExtractResult } from '@/types/extract';
import { needsMerge, findBestAudio, buildMergeUrl } from '@/lib/utils/merge.helper';

interface FormatListProps {
  result: ExtractResult;
  onPlay: (url: string, type: 'video' | 'audio', mime?: string, thumbnail?: string, audioUrl?: string, needsProxy?: boolean) => void;
}

/**
 * Format file size in human readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

/**
 * Check if source is HLS Opus (needs server-side transcoding)
 */
function isHlsOpus(source: MediaSource): boolean {
  const isOpus = source.url?.includes('.opus') || source.mime?.includes('opus') || false;
  const isHls = source.url?.includes('.m3u8') || source.url?.includes('playlist') || false;
  return isOpus && isHls;
}

/**
 * Check if source is BiliBili DASH segment (needs server-side transcoding)
 */
function isBiliBiliDash(source: MediaSource): boolean {
  const isBiliBili = source.url?.includes('bilivideo.') || source.url?.includes('bilibili.') || source.url?.includes('akamaized.net');
  const isDash = source.url?.includes('.m4s');
  return isBiliBili && isDash;
}

/**
 * Check if source needs HLS stream endpoint (FFmpeg transcoding)
 * Includes: SoundCloud HLS Opus, BiliBili DASH, YouTube HLS (needsProxy)
 */
function needsHlsStream(source: MediaSource): boolean {
  // YouTube HLS with needsProxy flag
  if (source.needsProxy) return true;
  
  return isHlsOpus(source) || isBiliBiliDash(source);
}

/**
 * Check if source is experimental (HLS, Opus, DASH segments, or needs proxy)
 */
function isExperimental(source: MediaSource): boolean {
  if (source.needsProxy) return true;
  const isOpus = source.mime?.includes('opus') || source.url?.includes('.opus');
  const isHls = source.url?.includes('.m3u8') || source.url?.includes('playlist') || source.mime?.includes('mpegurl');
  const isDash = source.url?.includes('.m4s');
  return isOpus || isHls || isDash;
}

/**
 * Build stream URL for opening media in new tab
 * Routes through /api/v1/stream to handle expired URLs (Eporner, Rule34Video, etc)
 * @param source - Media source with optional hash
 * @returns Stream URL with h= or url= parameter
 */
export function buildStreamUrl(source: MediaSource): string {
  const params = new URLSearchParams();
  
  // Prefer hash over raw URL for security
  if (source.hash) {
    params.set('h', source.hash);
  } else {
    params.set('url', source.url);
  }
  
  return `/api/v1/stream?${params.toString()}`;
}

/**
 * Build download URL using hash-first approach
 * For HLS/DASH/needsProxy sources, uses hls-stream endpoint for server-side transcoding
 * @param source - Media source with optional hash
 * @param filename - Filename for download
 * @param mediaType - 'video' or 'audio' for transcoding type
 * @returns Download URL with h= or url= parameter
 */
export function buildDownloadUrl(source: MediaSource, filename: string, mediaType: 'video' | 'audio' = 'audio'): string {
  const params = new URLSearchParams();
  
  // For HLS/DASH/needsProxy that needs transcoding (but not merge - that's handled separately)
  if (needsHlsStream(source)) {
    params.set('url', source.url);
    params.set('type', mediaType);
    return `/api/v1/hls-stream?${params.toString()}`;
  }
  
  // Prefer hash over raw URL for security
  if (source.hash) {
    params.set('h', source.hash);
  } else {
    params.set('url', source.url);
  }
  
  params.set('filename', filename);
  
  return `/api/v1/download?${params.toString()}`;
}

/**
 * Trigger file download
 */
function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

interface FormatRowProps {
  item: MediaItem;
  source: MediaSource;
  result: ExtractResult;
  onPlay: (url: string, type: 'video' | 'audio', mime?: string, thumbnail?: string, audioUrl?: string, needsProxy?: boolean) => void;
}

function FormatRow({ item, source, result, onPlay }: FormatRowProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const isVideo = item.type === 'video';
      const hlsTranscode = needsHlsStream(source);
      
      // Determine output extension
      let ext: string;
      if (hlsTranscode || (isVideo && needsMerge(source))) {
        ext = isVideo ? 'mp4' : 'mp3';
      } else {
        ext = item.type === 'video' ? 'mp4' : item.type === 'audio' ? 'mp3' : 'jpg';
      }
      
      // Use filename from source if available, replace extension for transcode/merge
      let filename = source.filename || `download_${source.quality}.${ext}`;
      if ((hlsTranscode || needsMerge(source)) && source.filename) {
        filename = source.filename.replace(/\.[^.]+$/, `.${ext}`);
      }
      
      let downloadUrl: string;
      
      // For video-only sources, use merge endpoint with auto-detected audio
      if (isVideo && needsMerge(source)) {
        const audioSource = findBestAudio(result.items);
        if (audioSource) {
          downloadUrl = buildMergeUrl({
            videoUrl: source.url,
            audioUrl: audioSource.url,
            filename: filename
          });
        } else {
          // Fallback to regular download if no audio found
          downloadUrl = buildDownloadUrl(source, filename, 'video');
        }
      } else {
        // Use regular download URL for non-merge cases
        downloadUrl = buildDownloadUrl(source, filename, isVideo ? 'video' : 'audio');
      }
      
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Download failed');
      
      const blob = await res.blob();
      triggerDownload(blob, filename);
    } catch (e) {
      alert('Download failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }, [item.type, source, result.items]);

  const handleOpen = useCallback(() => {
    // Open direct URL - most platforms work without proxy
    // Rule34Video/Eporner URLs work directly in browser
    window.open(source.url, '_blank');
  }, [source.url]);

  const handlePlay = useCallback(() => {
    if (item.type === 'video' || item.type === 'audio') {
      // For video, check if we need separate audio track
      let audioUrl: string | undefined;
      
      if (item.type === 'video') {
        // Use merge helper to determine if separate audio is needed
        if (needsMerge(source)) {
          // Find best audio from result using helper
          const audioSource = findBestAudio(result.items);
          if (audioSource) {
            audioUrl = audioSource.url;
          }
        }
      }
      
      // Pass needsProxy flag for YouTube HLS sources
      onPlay(source.url, item.type, source.mime, item.thumbnail || undefined, audioUrl, source.needsProxy);
    }
  }, [item.type, item.thumbnail, source.url, source.mime, source, result.items, onPlay]);

  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 hover:bg-zinc-800/70 transition-colors">
      {/* Quality & Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-700 text-xs font-bold uppercase">
            {source.quality}
          </span>
          {source.resolution && (
            <span className="text-zinc-400 text-xs">{source.resolution}</span>
          )}
          {isExperimental(source) && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-400 text-[10px] font-medium">
              ⚡ Experimental
            </span>
          )}
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          {source.mime || item.type}
          {source.size && ` • ${formatSize(source.size)}`}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Play button (video/audio only) */}
        {(item.type === 'video' || item.type === 'audio') && (
          <button
            onClick={handlePlay}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            title="Play"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="hidden sm:inline">Play</span>
          </button>
        )}

        {/* Open in new tab */}
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          title="Open in new tab"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="hidden sm:inline">Open</span>
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          title="Download"
        >
          {downloading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          <span className="hidden sm:inline">{downloading ? 'Wait...' : 'Download'}</span>
        </button>
      </div>
    </div>
  );
}

export function FormatList({ result, onPlay }: FormatListProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  const hasMultipleItems = result.items.length > 1;

  const handleDownloadAll = useCallback(async () => {
    if (!result.items?.length) return;
    
    setDownloadingAll(true);
    setDownloadProgress({ current: 0, total: result.items.length });

    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      const src = item.sources[0];
      if (!src) continue;

      setDownloadProgress({ current: i + 1, total: result.items.length });

      try {
        const isVideo = item.type === 'video';
        const hlsTranscode = needsHlsStream(src);
        
        // Determine extension based on type and transcode/merge
        let ext: string;
        if (hlsTranscode || (isVideo && needsMerge(src))) {
          ext = isVideo ? 'mp4' : 'mp3';
        } else {
          ext = isVideo ? 'mp4' : item.type === 'audio' ? 'mp3' : 'jpg';
        }
        
        let filename = src.filename || `download_${i + 1}.${ext}`;
        if ((hlsTranscode || needsMerge(src)) && src.filename) {
          filename = src.filename.replace(/\.[^.]+$/, `.${ext}`);
        }
        
        let downloadUrl: string;
        
        // For video-only sources, use merge endpoint with auto-detected audio
        if (isVideo && needsMerge(src)) {
          const audioSource = findBestAudio(result.items);
          if (audioSource) {
            downloadUrl = buildMergeUrl({
              videoUrl: src.url,
              audioUrl: audioSource.url,
              filename: filename
            });
          } else {
            // Fallback to regular download if no audio found
            downloadUrl = buildDownloadUrl(src, filename, 'video');
          }
        } else {
          // Use regular download URL for non-merge cases
          downloadUrl = buildDownloadUrl(src, filename, isVideo ? 'video' : 'audio');
        }
        
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error('Download failed');
        
        const blob = await res.blob();
        triggerDownload(blob, filename);

        // Small delay between downloads
        if (i < result.items.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (e) {
        console.error('Download failed for item', i + 1, e);
      }
    }

    setDownloadingAll(false);
  }, [result.items]);

  if (!result.items?.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h3 className="font-semibold mb-4">Formats</h3>
        <p className="text-zinc-500 text-sm">No formats available</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">📦 Formats</h3>
        {hasMultipleItems && (
          <button
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {downloadingAll ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{downloadProgress.current}/{downloadProgress.total}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span>Download All ({result.items.length})</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {result.items.map((item) => (
          <div key={item.index}>
            {hasMultipleItems && (
              <div className="flex items-center gap-2 text-zinc-400 text-sm mt-4 mb-2 first:mt-0">
                <span>{item.type === 'video' ? '🎬' : item.type === 'audio' ? '🎵' : '🖼️'}</span>
                <span>Item {item.index + 1}</span>
              </div>
            )}
            {item.sources.map((source, sourceIdx) => (
              <FormatRow
                key={`${item.index}-${sourceIdx}`}
                item={item}
                source={source}
                result={result}
                onPlay={onPlay}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FormatList;
