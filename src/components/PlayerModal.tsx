'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { buildMergeUrl, shouldCopyAudioStream } from '@/lib/utils/merge.helper';

interface PlayerModalProps {
  isOpen: boolean;
  url: string | null;
  type: 'video' | 'audio' | null;
  mime?: string | null;
  thumbnail?: string | null;
  /** Separate audio URL for video-only streams (YouTube, BiliBili) */
  audioUrl?: string | null;
  audioMime?: string | null;
  audioExtension?: string | null;
  /** Whether the URL needs proxy (YouTube HLS) */
  needsProxy?: boolean;
  onClose: () => void;
}

/**
 * Check if URL is HLS format
 */
function isHlsFormat(url: string | null): boolean {
  if (!url) return false;
  return url.includes('.m3u8') || url.includes('playlist') || url.includes('/index.m3u8');
}

/**
 * Check if source needs video-audio merge for playback
 * FormatList only passes audioUrl for split video streams.
 */
function needsMergeForPlayback(url: string | null, audioUrl: string | null | undefined): boolean {
  return Boolean(url && audioUrl);
}

export function PlayerModal({
  isOpen,
  url,
  type,
  mime,
  thumbnail,
  audioUrl,
  audioMime,
  audioExtension,
  needsProxy,
  onClose,
}: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  // Determine stream URL based on content type and platform
  const isOpus = url?.includes('.opus') || mime?.includes('opus');
  const isHlsUrl = isHlsFormat(url);
  
  // Check if we need merge endpoint for video+audio playback
  const useMergeEndpoint = type === 'video' && needsMergeForPlayback(url, audioUrl);
  
  // HLS stream via FFmpeg needed for:
  // - SoundCloud HLS Opus (convert to MP3) - needs transcoding
  // Note: YouTube HLS with needsProxy now uses hls-proxy for true streaming
  const needsHlsTranscode = !useMergeEndpoint && isHlsUrl && isOpus;
  
  // HLS proxy needed for CORS-restricted HLS (YouTube)
  // This allows true streaming via HLS.js instead of full download
  const needsHlsProxy = !useMergeEndpoint && needsProxy && isHlsUrl && !isOpus;
  
  // Build stream URL
  const streamUrl = url 
    ? useMergeEndpoint && audioUrl
      ? buildMergeUrl({
          videoUrl: url,
          audioUrl,
          copyAudio: shouldCopyAudioStream({
            mime: audioMime || undefined,
            extension: audioExtension || undefined,
          }),
        })
      : needsHlsTranscode
        ? `/api/v1/hls-stream?url=${encodeURIComponent(url)}&type=${type}`
        : needsHlsProxy
          ? `/api/v1/hls-proxy?url=${encodeURIComponent(url)}&type=manifest`
          : `/api/v1/stream?url=${encodeURIComponent(url)}`
    : '';

  // Check if URL is HLS that can be played via HLS.js
  // Includes: direct HLS URLs, or proxied HLS (needsProxy)
  const isHls = !isOpus && (
    mime?.includes('mpegurl') || 
    mime?.includes('m3u8') || 
    url?.includes('.m3u8') ||
    needsHlsProxy  // Proxied HLS should also use HLS.js
  );

  // Cleanup HLS instance
  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Handle playback errors
  const handleError = useCallback((e: React.SyntheticEvent<HTMLMediaElement>) => {
    const media = e.currentTarget;
    const mediaError = media.error;
    
    let errorMsg = 'Playback failed. ';
    if (mediaError) {
      switch (mediaError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMsg += 'Playback was aborted.';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg += 'Network error occurred.';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg += 'Media decoding failed.';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg += 'Format not supported by browser.';
          break;
        default:
          errorMsg += 'Unknown error.';
      }
    }
    setError(errorMsg);
    setIsLoading(false);
  }, []);

  // Open URL directly in new tab
  const handleOpenDirectly = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [url]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset when closing - properly cleanup all media
  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => {
        setError(null);
        setIsLoading(false);
        setLoadingStatus('');
      });
      cleanupHls();
      
      // Properly stop and cleanup video
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load(); // Force browser to release resources
      }
      
      // Properly stop and cleanup audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load(); // Force browser to release resources
      }
    }
  }, [isOpen, cleanupHls]);

  // Setup playback when opening
  useEffect(() => {
    if (!isOpen || !streamUrl) return;

    queueMicrotask(() => {
      setError(null);
      setIsLoading(true);
      setLoadingStatus('');
    });
    cleanupHls();

    const video = videoRef.current;
    const audio = audioRef.current;
    const mediaElement = type === 'video' ? video : audio;
    
    if (!mediaElement) {
      queueMicrotask(() => {
        setIsLoading(false);
      });
      return;
    }

    // For HLS streams via HLS.js
    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(mediaElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          mediaElement.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setError(`HLS Error: ${data.type} - ${data.details}`);
            setIsLoading(false);
            hls.destroy();
          }
        });
      }
      return;
    }

    // Progressive streams (merged video+audio, or regular streams)
    // Show loading status for merge endpoint or HLS transcode (FFmpeg processing)
    if (useMergeEndpoint) {
      queueMicrotask(() => {
        setLoadingStatus('Merging video and audio for playback... please wait');
      });
    } else if (needsHlsTranscode) {
      queueMicrotask(() => {
        setLoadingStatus('Processing stream... please wait');
      });
    }
    
    mediaElement.src = streamUrl;
    
    // Buffer threshold for merge endpoint - wait for enough buffer before playing
    // This prevents audio/video desync when FFmpeg is still processing
    const BUFFER_THRESHOLD = 3; // seconds
    
    const handlePlaying = () => setIsLoading(false);
    
    if (useMergeEndpoint) {
      // For merge streams, wait for buffer threshold before playing
      let hasStartedPlaying = false;
      
      const checkBuffer = () => {
        if (hasStartedPlaying) return;
        
        const buffered = mediaElement.buffered;
        if (buffered.length > 0) {
          const bufferedSeconds = buffered.end(0) - buffered.start(0);
          setLoadingStatus(`Buffering... ${bufferedSeconds.toFixed(1)}s`);
          
          if (bufferedSeconds >= BUFFER_THRESHOLD) {
            hasStartedPlaying = true;
            setIsLoading(false);
            mediaElement.play().catch(() => {});
          }
        }
      };
      
      // Check buffer on progress events
      mediaElement.addEventListener('progress', checkBuffer);
      mediaElement.addEventListener('playing', handlePlaying, { once: true });
      
      // Fallback: if canplaythrough fires, we have enough buffer
      mediaElement.addEventListener('canplaythrough', () => {
        if (!hasStartedPlaying) {
          hasStartedPlaying = true;
          setIsLoading(false);
          mediaElement.play().catch(() => {});
        }
      }, { once: true });
      
      return () => {
        mediaElement.removeEventListener('progress', checkBuffer);
        mediaElement.removeEventListener('playing', handlePlaying);
      };
    } else {
      // Regular streams - play as soon as ready
      mediaElement.addEventListener('playing', handlePlaying, { once: true });
      mediaElement.addEventListener('canplay', handlePlaying, { once: true });
      mediaElement.addEventListener('loadeddata', () => {
        setIsLoading(false);
        mediaElement.play().catch(() => {});
      }, { once: true });

      return () => {
        mediaElement.removeEventListener('playing', handlePlaying);
      };
    }
  }, [isOpen, streamUrl, type, isHls, useMergeEndpoint, needsHlsTranscode, cleanupHls]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)' }}
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10"
        aria-label="Close player"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Player container */}
      <div className="w-full max-w-4xl">
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="mt-3 text-white/70">{loadingStatus || 'Loading...'}</span>
          </div>
        )}

        {type === 'video' && (
          <video
            ref={videoRef}
            className={`w-full max-h-[80vh] rounded-xl object-contain ${isLoading ? 'hidden' : ''}`}
            controls
            playsInline
            onError={handleError}
          />
        )}
        
        {type === 'audio' && (
          <div className={`bg-zinc-900 rounded-xl overflow-hidden ${isLoading ? 'hidden' : ''}`}>
            {thumbnail && (
              <div className="relative">
                <img 
                  src={`/api/v1/stream?url=${encodeURIComponent(thumbnail)}`}
                  alt="Audio thumbnail"
                  className="w-full h-64 object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                  <span className="text-white text-sm font-medium">Audio Only</span>
                </div>
              </div>
            )}
            <div className="p-4">
              <audio ref={audioRef} className="w-full" controls onError={handleError} />
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-center">
            <p className="text-red-300 mb-3">{error}</p>
            <button
              onClick={handleOpenDirectly}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Open directly
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerModal;
