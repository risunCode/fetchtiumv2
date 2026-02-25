import { describe, expect, it } from 'vitest';

import { buildDownloadUrl } from '@/components/FormatList';
import { buildMergeUrl } from '@/lib/utils/merge.helper';
import type { MediaSource } from '@/types/extract';

describe('download and merge url builders', () => {
  it('builds merge URL with hash parameters when available', () => {
    const url = buildMergeUrl({
      videoHash: 'videohash12345678',
      audioHash: 'audiohash12345678',
      filename: 'sample.mp4',
    });

    expect(url).toContain('/api/v1/merge?');
    expect(url).toContain('videoH=videohash12345678');
    expect(url).toContain('audioH=audiohash12345678');
    expect(url).not.toContain('videoUrl=');
    expect(url).not.toContain('audioUrl=');
  });

  it('uses hls-stream for proxied HLS sources', () => {
    const source: MediaSource = {
      quality: 'hls',
      url: 'https://example.com/master.m3u8',
      mime: 'application/vnd.apple.mpegurl',
      needsProxy: true,
    };

    const url = buildDownloadUrl(source, 'sample.mp4', 'video');

    expect(url).toContain('/api/v1/hls-stream?');
    expect(url).toContain('type=video');
  });

  it('uses /download with hash for regular files', () => {
    const source: MediaSource = {
      quality: '720p',
      url: 'https://cdn.example.com/video.mp4',
      hash: 'hash123456789012',
      mime: 'video/mp4',
    };

    const url = buildDownloadUrl(source, 'video.mp4', 'video');

    expect(url).toContain('/api/v1/download?');
    expect(url).toContain('h=hash123456789012');
    expect(url).toContain('filename=video.mp4');
  });
});
