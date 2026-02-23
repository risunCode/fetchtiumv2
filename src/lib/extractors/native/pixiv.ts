import type { ExtractionRequest, ExtractionResult } from '@/lib/extractors/types';
import { PixivExtractor } from '@/lib/extractors/pixiv';

export async function extractPixiv(request: ExtractionRequest): Promise<ExtractionResult> {
  const extractor = new PixivExtractor();
  const result = await extractor.extract(request.url, { cookie: request.cookie });
  return result as unknown as ExtractionResult;
}
