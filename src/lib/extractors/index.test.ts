import { describe, expect, it } from 'vitest';

import { detectPlatformV2 } from './index';

describe('extractor router detectPlatformV2', () => {
  it('detects native platform', () => {
    expect(detectPlatformV2('https://www.pixiv.net/artworks/123')).toBe('pixiv');
  });

  it('detects wrapper platform', () => {
    expect(detectPlatformV2('https://www.youtube.com/watch?v=abc')).toBe('youtube');
  });

  it('returns null for unsupported URL', () => {
    expect(detectPlatformV2('https://example.com')).toBeNull();
  });
});
