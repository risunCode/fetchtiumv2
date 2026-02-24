'use client';

import { useState, useCallback } from 'react';
import { MediaItem, MediaSource, ExtractResult } from '@/types/extract';
import { needsMerge, findBestAudio, buildMergeUrl, shouldCopyAudioStream } from '@/lib/utils/merge.helper';

interface CodecGroup {
  codec: string;
  label: string;
  sources: Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }>;
}

interface GroupedFormats {
  progressive: Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }>;
  codecGroups: CodecGroup[];
  audioItems: Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }>;
  imageItems: Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }>;
}

function getCodecInfo(codec: string | undefined): { key: string; label: string } {
  if (!codec) return { key: 'unknown', label: 'Unknown' };
  const normalized = codec.toUpperCase();
  switch (normalized) {
    case 'H.264':
    case 'H264':
    case 'AVC':
      return { key: 'h264', label: 'H.264 (MP4)' };
    case 'VP9':
      return { key: 'vp9', label: 'VP9 (WebM)' };
    case 'AV1':
      return { key: 'av1', label: 'AV1' };
    default:
      return { key: normalized.toLowerCase(), label: codec };
  }
}

function groupByCodec(items: MediaItem[]): GroupedFormats {
  const progressive: Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }> = [];
  const codecMap = new Map<string, Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }>>();
  const audioItems: Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }> = [];
  const imageItems: Array<{ item: MediaItem; source: MediaSource; sourceIdx: number }> = [];

  for (const item of items) {
    for (let sourceIdx = 0; sourceIdx < item.sources.length; sourceIdx++) {
      const source = item.sources[sourceIdx];
      const entry = { item, source, sourceIdx };

      if (item.type === 'image') {
        imageItems.push(entry);
        continue;
      }

      if (item.type === 'audio') {
        audioItems.push(entry);
        continue;
      }

      if (source.format === 'progressive') {
        progressive.push(entry);
        continue;
      }

      const codecInfo = getCodecInfo(source.codec);
      if (!codecMap.has(codecInfo.key)) {
        codecMap.set(codecInfo.key, []);
      }
      codecMap.get(codecInfo.key)!.push(entry);
    }
  }

  const codecOrder = ['h264', 'vp9', 'av1'];
  const codecGroups: CodecGroup[] = [];

  for (const key of codecOrder) {
    const sources = codecMap.get(key);
    if (sources && sources.length > 0) {
      const codecInfo = getCodecInfo(sources[0].source.codec);
      codecGroups.push({ codec: key, label: codecInfo.label, sources });
    }
  }

  for (const [key, sources] of codecMap) {
    if (!codecOrder.includes(key)) {
      const codecInfo = getCodecInfo(sources[0].source.codec);
      codecGroups.push({ codec: key, label: codecInfo.label, sources });
    }
  }

  return { progressive, codecGroups, audioItems, imageItems };
}

interface FormatListProps {
  result: ExtractResult;
  onPlay: (
    url: string,
    type: 'video' | 'audio',
    mime?: string,
    thumbnail?: string,
    audioUrl?: string,
    needsProxy?: boolean,
    audioMime?: string,
    audioExtension?: string,
  ) => void;
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
 * Includes: SoundCloud HLS Opus, BiliBili DASH, YouTube HLS (needsProxy for video/audio)
 * Note: Images with needsProxy should use regular download endpoint, not HLS
 */
function needsHlsStream(source: MediaSource): boolean {
  // YouTube HLS with needsProxy flag (but not images - they use regular proxy)
  if (source.needsProxy) {
    // Check if it's HLS/DASH (video/audio) vs regular file (image)
    const isHls = source.url?.includes('.m3u8') || source.url?.includes('playlist') || source.mime?.includes('mpegurl');
    const isDash = source.url?.includes('.m4s');
    return isHls || isDash;
  }
  
  return isHlsOpus(source) || isBiliBiliDash(source);
}

/**
 * Check if source is experimental (HLS, Opus, DASH segments, needs proxy, or needs merge)
 */
function isExperimental(source: MediaSource): boolean {
  if (source.needsProxy) return true;
  if (source.needsMerge) return true;
  const isOpus = source.mime?.includes('opus') || source.url?.includes('.opus');
  const isHls = source.url?.includes('.m3u8') || source.url?.includes('playlist') || source.mime?.includes('mpegurl');
  const isDash = source.url?.includes('.m4s');
  return isOpus || isHls || isDash;
}

/**
 * Get format badge with codec info
 * Format: [HLS-H.264], [DASH-VP9], [Opus], [MP4-AV1], etc
 */
function getFormatBadge(source: MediaSource): string | null {
  const url = source.url?.toLowerCase() || '';
  const mime = source.mime?.toLowerCase() || '';
  const ext = source.extension?.toLowerCase() || '';
  const codec = source.codec || '';
  
  // HLS formats - append codec if available
  if (url.includes('.m3u8') || mime.includes('mpegurl')) {
    return codec ? `HLS-${codec}` : 'HLS';
  }
  
  // DASH segments (BiliBili, etc) - append codec if available
  if (url.includes('.m4s')) {
    return codec ? `DASH-${codec}` : 'DASH';
  }
  
  // Audio codecs/containers
  if (mime.includes('opus') || url.includes('.opus') || ext === 'opus') {
    return 'Opus';
  }
  if (ext === 'm4a' || (mime.includes('audio') && url.includes('.m4a'))) {
    return 'M4A';
  }
  if (mime.includes('aac') || ext === 'aac') {
    return 'AAC';
  }
  if (mime.includes('mpeg') || ext === 'mp3' || url.includes('.mp3')) {
    return 'MP3';
  }
  if (mime.includes('ogg') || ext === 'ogg') {
    return 'OGG';
  }
  if (mime.includes('flac') || ext === 'flac') {
    return 'FLAC';
  }
  if (mime.includes('wav') || ext === 'wav') {
    return 'WAV';
  }
  
  // Video containers - append codec if available
  if (ext === 'webm' || mime.includes('webm')) {
    return codec ? `WebM-${codec}` : 'WebM';
  }
  if (ext === 'mkv' || mime.includes('matroska')) {
    return codec ? `MKV-${codec}` : 'MKV';
  }
  if (ext === 'flv' || mime.includes('flv')) {
    return 'FLV';
  }
  if (ext === 'mov' || mime.includes('quicktime')) {
    return codec ? `MOV-${codec}` : 'MOV';
  }
  if (ext === 'avi' || mime.includes('avi')) {
    return 'AVI';
  }
  
  // MP4 - append codec if available
  if (ext === 'mp4' || (mime.includes('video/mp4') && !url.includes('.m3u8'))) {
    return codec ? `MP4-${codec}` : 'MP4';
  }
  
  // Image formats
  if (ext === 'webp' || mime.includes('webp')) {
    return 'WebP';
  }
  if (ext === 'png' || mime.includes('png')) {
    return 'PNG';
  }
  if (ext === 'gif' || mime.includes('gif')) {
    return 'GIF';
  }
  if (ext === 'jpg' || ext === 'jpeg' || mime.includes('jpeg')) {
    return 'JPG';
  }
  
  return null;
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

function inferAudioOutputFormat(source: MediaSource): 'mp3' | 'm4a' {
  const extension = source.extension?.toLowerCase();
  const mime = source.mime?.toLowerCase() || '';

  if (extension === 'm4a' || extension === 'aac' || mime.includes('audio/mp4') || mime.includes('audio/aac')) {
    return 'm4a';
  }

  if (extension === 'mp3' || mime.includes('audio/mpeg')) {
    return 'mp3';
  }

  // Default transcode target for opus/webm/unknown audio
  return 'mp3';
}

function replaceFileExtension(filename: string, extension: string): string {
  const normalizedExt = extension.replace(/^\./, '');
  if (!normalizedExt) {
    return filename;
  }

  if (filename.toLowerCase().endsWith(`.${normalizedExt.toLowerCase()}`)) {
    return filename;
  }

  if (filename.includes('.')) {
    return filename.replace(/\.[^.]+$/, `.${normalizedExt}`);
  }

  return `${filename}.${normalizedExt}`;
}

function buildYouTubeAudioDownloadUrl(sourceUrlRaw: string | undefined, source: MediaSource, filename: string): string {
  const sourceUrl = sourceUrlRaw?.trim();
  if (!sourceUrl) {
    return buildDownloadUrl(source, filename, 'audio');
  }

  const audioFormat = inferAudioOutputFormat(source);
  const params = new URLSearchParams();
  params.set('url', sourceUrl);
  params.set('type', 'audio');
  params.set('format', audioFormat);
  params.set('quality', source.quality || 'audio');
  params.set('filename', replaceFileExtension(filename, audioFormat));
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

function formatDownloadSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return '0 KB/s';
  }

  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  }

  return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
}

async function fetchDownloadBlob(
  url: string,
  onSpeed: (speedText: string | null) => void
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed');

  // Fallback for environments that do not expose stream readers
  if (!res.body || typeof res.body.getReader !== 'function') {
    return res.blob();
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  const contentType = res.headers.get('content-type') || 'application/octet-stream';

  let windowBytes = 0;
  let windowStart = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (!value) continue;

    chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    windowBytes += value.byteLength;

    const now = Date.now();
    const elapsedMs = now - windowStart;
    if (elapsedMs >= 500) {
      const speed = windowBytes / (elapsedMs / 1000);
      onSpeed(formatDownloadSpeed(speed));
      windowBytes = 0;
      windowStart = now;
    }
  }

  const finalElapsedMs = Date.now() - windowStart;
  if (windowBytes > 0 && finalElapsedMs > 0) {
    const speed = windowBytes / (finalElapsedMs / 1000);
    onSpeed(formatDownloadSpeed(speed));
  }

  return new Blob(chunks, { type: contentType });
}

interface FormatRowProps {
  item: MediaItem;
  source: MediaSource;
  result: ExtractResult;
  onPlay: (
    url: string,
    type: 'video' | 'audio',
    mime?: string,
    thumbnail?: string,
    audioUrl?: string,
    needsProxy?: boolean,
    audioMime?: string,
    audioExtension?: string,
  ) => void;
  onDownloadWithWarning?: (callback: () => void, type: 'single') => void;
}

function FormatRow({ item, source, result, onPlay, onDownloadWithWarning }: FormatRowProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    const startDownload = async () => {
      setDownloading(true);
      setDownloadSpeed(null);
      try {
        const isVideo = item.type === 'video';
        const isAudio = item.type === 'audio';
        const isYouTubeAudioFastPath = isAudio && result.platform?.toLowerCase() === 'youtube' && Boolean(result.sourceUrl);
        const hlsTranscode = needsHlsStream(source);
        
        // Determine output extension
        let ext: string;
        if (hlsTranscode || (isVideo && needsMerge(source))) {
          ext = isVideo ? 'mp4' : 'mp3';
        } else {
          const sourceExtension = source.extension?.toLowerCase();
          ext = item.type === 'video'
            ? 'mp4'
            : item.type === 'audio'
              ? (sourceExtension || inferAudioOutputFormat(source))
              : 'jpg';
        }

        if (isYouTubeAudioFastPath) {
          ext = inferAudioOutputFormat(source);
        }
        
        // Use filename from source if available, replace extension for transcode/merge
        let filename = source.filename || `download_${source.quality}.${ext}`;
        if ((hlsTranscode || needsMerge(source)) && source.filename) {
          filename = source.filename.replace(/\.[^.]+$/, `.${ext}`);
        }
        if (isYouTubeAudioFastPath) {
          filename = replaceFileExtension(filename, ext);
        }
        
        let downloadUrl: string;
        
        // For video-only sources, use merge endpoint with auto-detected audio
        if (isVideo && needsMerge(source)) {
          const audioSource = findBestAudio(result.items);
          if (audioSource) {
              downloadUrl = buildMergeUrl({
                videoUrl: source.url,
                audioUrl: audioSource.url,
                videoHash: source.hash,
                audioHash: audioSource.hash,
                filename: filename,
                copyAudio: shouldCopyAudioStream(audioSource),
              });
          } else {
            // Fallback to regular download if no audio found
            downloadUrl = buildDownloadUrl(source, filename, 'video');
          }
        } else if (isYouTubeAudioFastPath) {
          downloadUrl = buildYouTubeAudioDownloadUrl(result.sourceUrl, source, filename);
        } else {
          // Use regular download URL for non-merge cases
          downloadUrl = buildDownloadUrl(source, filename, isVideo ? 'video' : 'audio');
        }
        
        const blob = await fetchDownloadBlob(downloadUrl, setDownloadSpeed);
        triggerDownload(blob, filename);
      } catch (e) {
        alert('Download failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
      } finally {
        setDownloadSpeed(null);
        setDownloading(false);
      }
    };

    if (source.needsMerge && onDownloadWithWarning) {
      onDownloadWithWarning(startDownload, 'single');
    } else {
      await startDownload();
    }
  }, [item.type, source, result.items, result.platform, result.sourceUrl, onDownloadWithWarning]);

  const handleOpen = useCallback(() => {
    const shouldOpenViaProxy = source.needsProxy || needsHlsStream(source) || needsMerge(source);

    // For proxy/HLS/DASH split sources, use stream endpoint
    if (shouldOpenViaProxy) {
      window.open(buildStreamUrl(source), '_blank');
    } else {
      // Open direct URL - most platforms work without proxy
      window.open(source.url, '_blank');
    }
  }, [source]);

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
            onPlay(
              source.url,
              item.type,
              source.mime,
              item.thumbnail || undefined,
              audioUrl,
              source.needsProxy,
              audioSource.mime,
              audioSource.extension,
            );
            return;
          }
        }
      }
      
      // Pass needsProxy flag for YouTube HLS sources
      onPlay(source.url, item.type, source.mime, item.thumbnail || undefined, audioUrl, source.needsProxy);
    }
  }, [item.type, item.thumbnail, source, result.items, onPlay]);

  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 hover:bg-zinc-800/70 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-700 text-xs font-bold uppercase">
            {source.quality}
          </span>
          {source.format === 'progressive' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-400 text-[10px] font-medium uppercase">
              Progressive
            </span>
          )}
          {getFormatBadge(source) && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-600/30 text-sky-400 text-[10px] font-medium uppercase">
              {getFormatBadge(source)}
            </span>
          )}
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

      <div className="flex gap-2">
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
          <span className={downloading ? '' : 'hidden sm:inline'}>
            {downloading ? `Wait... ${downloadSpeed || ''}`.trim() : 'Download'}
          </span>
        </button>
      </div>
    </div>
  );
}

export function FormatList({ result, onPlay }: FormatListProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [showWarning, setShowWarning] = useState(false);
  const [warningType, setWarningType] = useState<'all' | 'single' | null>(null);
  const [pendingDownload, setPendingDownload] = useState<(() => void) | null>(null);

  const grouped = groupByCodec(result.items);

  const hasYouTubeDashFormats = result.items.some(item => 
    item.sources.some(src => 
      src.format === 'dash' && src.needsMerge === true
    )
  );

  const handleDownloadWithWarning = useCallback((cb: () => void, type: 'all' | 'single') => {
    if (type === 'single') {
      setWarningType('single');
      setShowWarning(true);
      setPendingDownload(() => {
        setShowWarning(false);
        cb();
      });
    } else {
      cb();
    }
  }, []);

  const doDownloadAll = useCallback(async () => {
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
        const isAudio = item.type === 'audio';
        const isYouTubeAudioFastPath = isAudio && result.platform?.toLowerCase() === 'youtube' && Boolean(result.sourceUrl);
        const hlsTranscode = needsHlsStream(src);
        
        let ext: string;
        if (hlsTranscode || (isVideo && needsMerge(src))) {
          ext = isVideo ? 'mp4' : 'mp3';
        } else {
          const sourceExtension = src.extension?.toLowerCase();
          ext = isVideo
            ? 'mp4'
            : item.type === 'audio'
              ? (sourceExtension || inferAudioOutputFormat(src))
              : 'jpg';
        }

        if (isYouTubeAudioFastPath) {
          ext = inferAudioOutputFormat(src);
        }
        
        let filename = src.filename || `download_${i + 1}.${ext}`;
        if ((hlsTranscode || needsMerge(src)) && src.filename) {
          filename = src.filename.replace(/\.[^.]+$/, `.${ext}`);
        }
        if (isYouTubeAudioFastPath) {
          filename = replaceFileExtension(filename, ext);
        }
        
        let downloadUrl: string;
        
        if (isVideo && needsMerge(src)) {
          const audioSource = findBestAudio(result.items);
          if (audioSource) {
              downloadUrl = buildMergeUrl({
                videoUrl: src.url,
                audioUrl: audioSource.url,
                videoHash: src.hash,
                audioHash: audioSource.hash,
                filename: filename,
                copyAudio: shouldCopyAudioStream(audioSource),
              });
          } else {
            downloadUrl = buildDownloadUrl(src, filename, 'video');
          }
        } else if (isYouTubeAudioFastPath) {
          downloadUrl = buildYouTubeAudioDownloadUrl(result.sourceUrl, src, filename);
        } else {
          downloadUrl = buildDownloadUrl(src, filename, isVideo ? 'video' : 'audio');
        }
        
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error('Download failed');
        
        const blob = await res.blob();
        triggerDownload(blob, filename);

        if (i < result.items.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (e) {
        console.error('Download failed for item', i + 1, e);
      }
    }

    setDownloadingAll(false);
  }, [result.items, result.platform, result.sourceUrl]);

  const handleDownloadAll = useCallback(() => {
    if (!result.items?.length) return;

    if (hasYouTubeDashFormats) {
      setWarningType('all');
      setShowWarning(true);
      setPendingDownload(() => async () => {
        setShowWarning(false);
        await doDownloadAll();
      });
    } else {
      doDownloadAll();
    }
  }, [result.items, hasYouTubeDashFormats, doDownloadAll]);

  const handleConfirmWarning = useCallback(() => {
    if (pendingDownload) {
      pendingDownload();
      setPendingDownload(null);
    }
  }, [pendingDownload]);

  const handleCancelWarning = useCallback(() => {
    setShowWarning(false);
    setWarningType(null);
    setPendingDownload(null);
  }, []);

  if (!result.items?.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h3 className="font-semibold mb-4">Formats</h3>
        <p className="text-zinc-500 text-sm">No formats available</p>
      </div>
    );
  }

  const totalFormats = grouped.progressive.length + 
    grouped.codecGroups.reduce((acc, g) => acc + g.sources.length, 0) +
    grouped.audioItems.length +
    grouped.imageItems.length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">📦 Formats</h3>
        {totalFormats > 1 && (
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
                <span>Download All ({totalFormats})</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {grouped.progressive.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎬</span>
              <span className="font-medium text-emerald-400">Progressive</span>
              <span className="text-xs text-zinc-500">(Ready to Download - No Merge Needed)</span>
            </div>
            <div className="space-y-2">
              {grouped.progressive.map(({ item, source, sourceIdx }) => (
                <FormatRow
                  key={`progressive-${item.index}-${sourceIdx}`}
                  item={item}
                  source={source}
                  result={result}
                  onPlay={onPlay}
                  onDownloadWithWarning={handleDownloadWithWarning}
                />
              ))}
            </div>
          </div>
        )}

        {grouped.codecGroups.map((group) => (
          <div key={group.codec}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎬</span>
              <span className="font-medium text-sky-400">{group.label}</span>
            </div>
            <div className="space-y-2">
              {group.sources.map(({ item, source, sourceIdx }) => (
                <FormatRow
                  key={`${group.codec}-${item.index}-${sourceIdx}`}
                  item={item}
                  source={source}
                  result={result}
                  onPlay={onPlay}
                  onDownloadWithWarning={handleDownloadWithWarning}
                />
              ))}
            </div>
          </div>
        ))}

        {grouped.audioItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎵</span>
              <span className="font-medium text-purple-400">Audio</span>
            </div>
            <div className="space-y-2">
              {grouped.audioItems.map(({ item, source, sourceIdx }) => (
                <FormatRow
                  key={`audio-${item.index}-${sourceIdx}`}
                  item={item}
                  source={source}
                  result={result}
                  onPlay={onPlay}
                  onDownloadWithWarning={handleDownloadWithWarning}
                />
              ))}
            </div>
          </div>
        )}

        {grouped.imageItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🖼️</span>
              <span className="font-medium text-orange-400">Images</span>
            </div>
            <div className="space-y-2">
              {grouped.imageItems.map(({ item, source, sourceIdx }) => (
                <FormatRow
                  key={`image-${item.index}-${sourceIdx}`}
                  item={item}
                  source={source}
                  result={result}
                  onPlay={onPlay}
                  onDownloadWithWarning={handleDownloadWithWarning}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {showWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-100">
                {warningType === 'all' ? 'Slow Download Warning' : 'YouTube Format Notice'}
              </h3>
            </div>
            <p className="text-zinc-400 text-sm mb-6">
              {warningType === 'all' 
                ? 'Some formats use HLS/DASH streaming which may be slow. Continue anyway?'
                : 'This format requires audio merging, which may take extra time. Progress will be shown during download.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelWarning}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWarning}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormatList;
