import type { ExtractionRequest, ExtractionResult } from '@/lib/extractors/types';

const DEFAULT_PYTHON_API_URL = 'http://127.0.0.1:5000';

export class PythonAPIClient {
  constructor(private readonly baseUrl: string = process.env.NEXT_PUBLIC_PYTHON_API_URL || process.env.PYTHON_API_URL || DEFAULT_PYTHON_API_URL) {}

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store',
    });

    const data = await response.json();
    if (!response.ok && data?.success !== false) {
      return {
        success: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: `Python API error: ${response.status}`,
        },
      };
    }

    return data as ExtractionResult;
  }

  async health(): Promise<{ status: string; runtime?: string }> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Python health check failed: ${response.status}`);
    }
    return (await response.json()) as { status: string; runtime?: string };
  }
}

let singleton: PythonAPIClient | null = null;

export function getPythonAPIClient(): PythonAPIClient {
  if (!singleton) singleton = new PythonAPIClient();
  return singleton;
}
