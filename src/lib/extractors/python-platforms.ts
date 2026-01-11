/**
 * Python platform detection for routing to Python extractors
 * 
 * These platforms are handled by yt-dlp and gallery-dl via Vercel Python functions
 */

export interface PythonPlatform {
  platform: string;
  patterns: RegExp[];
  nsfw?: boolean;
  extractor: 'yt-dlp' | 'gallery-dl';
}

/**
 * Platforms supported by Python extractors
 */
export const PYTHON_PLATFORMS: PythonPlatform[] = [
  // yt-dlp platforms
  {
    platform: 'youtube',
    patterns: [/youtube\.com/i, /youtu\.be/i, /youtube-nocookie\.com/i],
    extractor: 'yt-dlp',
  },
  {
    platform: 'soundcloud',
    patterns: [/soundcloud\.com/i],
    extractor: 'yt-dlp',
  },
  {
    platform: 'bilibili',
    patterns: [/bilibili\.com/i, /bilibili\.tv/i, /b23\.tv/i],
    extractor: 'yt-dlp',
  },
  {
    platform: 'twitch',
    patterns: [/twitch\.tv\/\w+\/clip/i, /clips\.twitch\.tv/i],
    extractor: 'yt-dlp',
  },
  {
    platform: 'bandcamp',
    patterns: [/bandcamp\.com/i, /\w+\.bandcamp\.com/i],
    extractor: 'yt-dlp',
  },
  // gallery-dl platforms
  {
    platform: 'reddit',
    patterns: [/reddit\.com/i, /redd\.it/i, /v\.redd\.it/i],
    extractor: 'gallery-dl',
  },
  // Pixiv moved to native TypeScript extractor (src/lib/extractors/pixiv)
  {
    platform: 'eporner',
    patterns: [/eporner\.com/i],
    nsfw: true,
    extractor: 'gallery-dl',
  },
  {
    platform: 'rule34video',
    patterns: [/rule34video\.com/i],
    nsfw: true,
    extractor: 'gallery-dl',
  },
  {
    platform: 'weibo',
    patterns: [/weibo\.com/i, /weibo\.cn/i],
    extractor: 'gallery-dl',
  },
  {
    platform: 'pinterest',
    patterns: [/pinterest\.com/i, /pin\.it/i],
    extractor: 'gallery-dl',
  },
];

/**
 * Check if URL should be handled by Python extractor
 */
export function isPythonPlatform(url: string): boolean {
  return PYTHON_PLATFORMS.some(p => p.patterns.some(r => r.test(url)));
}

/**
 * Get Python platform info from URL
 */
export function getPythonPlatform(url: string): PythonPlatform | null {
  return PYTHON_PLATFORMS.find(p => p.patterns.some(r => r.test(url))) ?? null;
}

/**
 * Check if URL is for NSFW platform
 */
export function isNsfwPlatform(url: string): boolean {
  const platform = getPythonPlatform(url);
  return platform?.nsfw ?? false;
}

/**
 * Get all Python platform names
 */
export function getPythonPlatformNames(): string[] {
  return PYTHON_PLATFORMS.map(p => p.platform);
}
