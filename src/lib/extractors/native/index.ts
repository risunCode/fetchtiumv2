import type { ExtractorFunction } from '@/lib/extractors/types';
import { extractPixiv } from './pixiv';

export const NATIVE_EXTRACTORS: Partial<Record<string, ExtractorFunction>> = {
  pixiv: extractPixiv,
};
