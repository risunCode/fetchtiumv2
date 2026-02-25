import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /api/health', () => {
  it('returns ok runtime', async () => {
    const response = await GET();
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.runtime).toBe('next.js');
  });
});
