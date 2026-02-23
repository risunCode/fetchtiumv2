import { getPythonAPIClient } from '@/lib/api/client';
import type { ExtractorFunction, ExtractionRequest, ExtractionResult } from '@/lib/extractors/types';

export function createPythonExtractor(_service?: string): ExtractorFunction {
  return async (request: ExtractionRequest): Promise<ExtractionResult> => {
    try {
      const client = getPythonAPIClient();
      return await client.extract(request);
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: error instanceof Error ? error.message : 'Python API unreachable',
        },
      };
    }
  };
}
