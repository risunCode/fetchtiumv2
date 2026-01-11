'use client';

import { ExtractResult, EngagementStats } from '@/types/extract';

interface ResultCardProps {
  result: ExtractResult;
}

/**
 * Format large numbers with K, M, B suffixes
 */
function formatNumber(n: number): string {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

/**
 * Platforms that need thumbnail proxy (hotlink protection or CORS)
 */
const PROXY_THUMBNAIL_PLATFORMS = ['instagram', 'bilibili', 'youtube', 'pixiv'];

/**
 * Get thumbnail URL - use stream proxy for platforms with hotlink protection
 */
function getThumbnailUrl(result: ExtractResult): string | undefined {
  const item = result.items?.[0];
  if (!item?.thumbnail) return undefined;
  
  // Use stream proxy for platforms with hotlink protection or CORS issues
  if (PROXY_THUMBNAIL_PLATFORMS.includes(result.platform)) {
    return `/api/v1/stream?url=${encodeURIComponent(item.thumbnail)}`;
  }
  
  return item.thumbnail;
}

/**
 * Stat icons mapping
 */
const statIcons: Record<keyof EngagementStats, string> = {
  views: '👁️',
  likes: '❤️',
  comments: '💬',
  shares: '🔄',
};

const statLabels: Record<keyof EngagementStats, string> = {
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
};

export function ResultCard({ result }: ResultCardProps) {
  const thumbnail = getThumbnailUrl(result);
  const hasStats = result.stats && Object.values(result.stats).some(v => v !== undefined && v > 0);

  // Build meta string
  let meta = result.platform.toUpperCase();
  if (result.contentType) meta += ' • ' + result.contentType;
  if (result.author) meta += ' • ' + result.author;
  if (result.items?.length > 1) meta += ' • ' + result.items.length + ' items';
  if (result.meta) {
    meta += ' • ' + (result.meta.publicContent ? '🌐 Public' : '🔒 Private');
    if (result.meta.responseTime) {
      meta += ' • ' + (result.meta.responseTime / 1000).toFixed(1) + 's';
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Thumbnail / Placeholder */}
      <div className="aspect-video bg-zinc-950 flex items-center justify-center">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={result.title || 'Media thumbnail'}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-16 h-16 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-semibold mb-1 line-clamp-2">
          {result.title || 'Untitled'}
        </h2>
        <p className="text-zinc-400 text-xs sm:text-sm">{meta}</p>

        {/* Description/Caption */}
        {result.description && (
          <p className="text-zinc-300 text-sm mt-2 line-clamp-3 whitespace-pre-wrap">
            {result.description}
          </p>
        )}

        {/* Stats Row */}
        {hasStats && (
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 pt-3 border-t border-zinc-800 text-xs sm:text-sm">
            {(Object.entries(result.stats!) as [keyof EngagementStats, number | undefined][]).map(
              ([key, value]) =>
                value !== undefined && value > 0 && (
                  <span key={key} className="text-zinc-400">
                    {statIcons[key]} {formatNumber(value)} {statLabels[key]}
                  </span>
                )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultCard;
