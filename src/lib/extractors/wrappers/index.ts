import type { PlatformExtractor, SupportedPlatform } from '../types';

type WrapperExtractorMap = Partial<Record<SupportedPlatform, PlatformExtractor>>;

// NOTE: Python wrapper extractors are resolved by profile/runtime path, not this legacy map.
// Keep this module to satisfy stable imports in extractor index.
export const WRAPPER_EXTRACTORS: WrapperExtractorMap = {};
