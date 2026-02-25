import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { PythonAPIClient } from './client';

describe('PythonAPIClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls extract endpoint', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, items: [] }),
    });

    const client = new PythonAPIClient('http://localhost:5000');
    const result = await client.extract({ url: 'https://youtube.com/watch?v=abc' });
    expect(result.success).toBe(true);
  });

  it('calls health endpoint', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const client = new PythonAPIClient('http://localhost:5000');
    const result = await client.health();
    expect(result.status).toBe('ok');
  });
});
