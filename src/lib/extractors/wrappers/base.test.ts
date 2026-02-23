import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  getPythonAPIClient: () => ({
    extract: vi.fn(async () => ({ success: true, platform: 'youtube', items: [] })),
  }),
}));

import { createPythonExtractor } from './base';

describe('createPythonExtractor', () => {
  it('returns success response from python client', async () => {
    const extractor = createPythonExtractor('yt-dlp');
    const result = await extractor({ url: 'https://youtube.com/watch?v=abc' });
    expect(result.success).toBe(true);
  });
});
