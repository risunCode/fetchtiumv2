import type { PlatformExtractor, SupportedPlatform } from '../types';

type NativeExtractorMap = Partial<Record<SupportedPlatform, PlatformExtractor>>;

// NOTE: Legacy native map module retained for compatibility with extractor registry imports.
// Class-based extraction via getExtractor() remains the active path.
export const NATIVE_EXTRACTORS: NativeExtractorMap = {};
