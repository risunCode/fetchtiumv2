export const WRAPPER_PLATFORM_CONFIG: Record<string, { service: 'yt-dlp' | 'gallery-dl' }> = {
  youtube: { service: 'yt-dlp' },
  bilibili: { service: 'yt-dlp' },
  soundcloud: { service: 'yt-dlp' },
  twitch: { service: 'yt-dlp' },
  bandcamp: { service: 'yt-dlp' },
  eporner: { service: 'yt-dlp' },
  rule34video: { service: 'yt-dlp' },
  reddit: { service: 'gallery-dl' },
  pinterest: { service: 'gallery-dl' },
  weibo: { service: 'gallery-dl' },
};
