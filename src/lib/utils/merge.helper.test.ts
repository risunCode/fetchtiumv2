import { describe, expect, it } from 'vitest';

import { buildMergeUrl, findBestAudio, shouldCopyAudioStream } from '@/lib/utils/merge.helper';
import type { MediaItem } from '@/types/extract';

describe('buildMergeUrl', () => {
  it('adds copyAudio query flag when requested', () => {
    const url = buildMergeUrl({
      videoHash: 'vh123',
      audioHash: 'ah123',
      filename: 'video.mp4',
      copyAudio: true,
    });

    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('videoH')).toBe('vh123');
    expect(params.get('audioH')).toBe('ah123');
    expect(params.get('filename')).toBe('video.mp4');
    expect(params.get('copyAudio')).toBe('1');
  });
});

describe('shouldCopyAudioStream', () => {
  it('returns true for m4a/aac extensions and mp4/aac audio mime types', () => {
    expect(shouldCopyAudioStream({ extension: 'm4a', mime: 'audio/webm' })).toBe(true);
    expect(shouldCopyAudioStream({ extension: 'aac', mime: 'audio/webm' })).toBe(true);
    expect(shouldCopyAudioStream({ extension: 'webm', mime: 'audio/mp4; codecs="mp4a.40.2"' })).toBe(true);
    expect(shouldCopyAudioStream({ extension: 'webm', mime: 'audio/aac' })).toBe(true);
  });

  it('returns false for other audio formats', () => {
    expect(shouldCopyAudioStream({ extension: 'webm', mime: 'audio/webm' })).toBe(false);
    expect(shouldCopyAudioStream({ extension: undefined, mime: undefined })).toBe(false);
    expect(shouldCopyAudioStream(null)).toBe(false);
  });
});

describe('findBestAudio', () => {
  it('falls back to audio-like sources when audio item is missing', () => {
    const items: MediaItem[] = [
      {
        index: 0,
        type: 'video',
        sources: [
          {
            quality: '1080p',
            url: 'https://cdn.example/video-only.mp4',
            mime: 'video/mp4',
            hasAudio: false,
            needsMerge: true,
          },
          {
            quality: '128kbps',
            url: 'https://cdn.example/audio-fallback.m4a',
            mime: 'audio/mp4',
            bitrate: 128,
            extension: 'm4a',
          },
        ],
      },
    ];

    const best = findBestAudio(items);

    expect(best).not.toBeNull();
    expect(best?.url).toBe('https://cdn.example/audio-fallback.m4a');
  });
});
