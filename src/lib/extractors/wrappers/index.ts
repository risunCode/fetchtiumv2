import type { ExtractorFunction } from '@/lib/extractors/types';
import { createPythonExtractor } from './base';
import { WRAPPER_PLATFORM_CONFIG } from './config';

export const WRAPPER_EXTRACTORS: Partial<Record<string, ExtractorFunction>> = Object.keys(
  WRAPPER_PLATFORM_CONFIG
).reduce((acc, platform) => {
  acc[platform] = createPythonExtractor(WRAPPER_PLATFORM_CONFIG[platform].service);
  return acc;
}, {} as Partial<Record<string, ExtractorFunction>>);
