/**
 * Facebook Scanner - Patterns + Streaming buffer handler + Boundary detection
 * TypeScript conversion of facebook/scanner.js
 */

import { containsAny } from '@/lib/core/parser/regex.extractor';
import { ErrorCode } from '@/lib/utils/error.utils';
import { logger } from '@/lib/utils/logger';

// ============================================================
// URL PATTERNS
// ============================================================

export const KNOWN_PATTERNS: RegExp[] = [
  /\/stories\//, /\/reel\//, /\/reels\//, /\/videos\//, /\/watch/,
  /\/video\.php/, /\/posts\//, /\/photos\//, /\/photo\.php/,
  /\/permalink\.php/, /\/story\.php/,
  /\/groups\/[^/]+\/posts\//, /\/groups\/[^/]+\/permalink\//
];

export const NEEDS_RESOLVE: RegExp[] = [
  /fb\.watch\//, /fb\.me\//, /\/share\/[vrp]\//, /l\.facebook\.com\/l\.php/
];

export const CONTENT_TYPE_PATTERNS: Record<string, RegExp> = {
  story: /\/stories\//,
  reel: /\/reel\/|\/share\/r\//,
  video: /\/videos\/|\/watch\/|\/share\/v\//,
  post: /\/posts\/|\/photos\/|\/permalink(?:\.php)?|\/share\/p\//,
  group: /\/groups\//
};

// ============================================================
// VIDEO PATTERNS (5 priority levels)
// ============================================================

export const VIDEO_PATTERNS = {
  nativeHD: /"browser_native_hd_url":"(https:[^"]+)"/,
  nativeSD: /"browser_native_sd_url":"(https:[^"]+)"/,
  playableHD: /"playable_url_quality_hd":"(https:[^"]+)"/,
  playableSD: /"playable_url":"(https:[^"]+)"/,
  hdSrc: /"hd_src(?:_no_ratelimit)?":"(https:[^"]+)"/,
  sdSrc: /"sd_src(?:_no_ratelimit)?":"(https:[^"]+)"/,
  dash: /"height":(\d+)[^}]*?"base_url":"(https:[^"]+\.mp4[^"]*)"/g,
  progressive: /"progressive_url":"(https:[^"]+)"/g
};

// ============================================================
// IMAGE PATTERNS
// ============================================================

export const IMAGE_PATTERNS = {
  subattachments: /"all_subattachments":\{"count":(\d+)/,
  viewerImage: /"viewer_image":\{"height":(\d+),"width":(\d+),"uri":"(https:[^"]+)"\}/g,
  photoImage: /"photo_image":\{"uri":"(https:[^"]+)"/g,
  imageUri: /"image":\{"uri":"(https:[^"]+t39\.30808[^"]+)"\}/g,
  preload: /<link[^>]+rel="preload"[^>]+href="(https:\/\/scontent[^"]+_nc_sid=127cfc[^"]+)"/i,
  t39: /https:\/\/scontent[^"'\s<>\\]+t39\.30808-6[^"'\s<>\\]+/gi
};

// ============================================================
// STORY PATTERNS
// ============================================================

export const STORY_PATTERNS = {
  video: /"progressive_url":"(https:[^"]+\.mp4[^"]*)","failure_reason":null,"metadata":\{"quality":"(HD|SD)"\}/g,
  videoFallback: /"progressive_url":"(https:[^"]+\.mp4[^"]*)"/g,
  thumbnail: /"(?:previewImage|story_thumbnail|poster_image)":\{"uri":"(https:[^"]+)"/g,
  image: /https:\/\/scontent[^"'\s<>\\]+t51\.82787[^"'\s<>\\]+\.jpg[^"'\s<>\\]*/gi
};

// ============================================================
// METADATA PATTERNS
// ============================================================

export const METADATA_PATTERNS = {
  author: [
    /"name":"([^"]+)","enable_reels_tab_deeplink":true/,
    /"owning_profile":\{"__typename":"(?:User|Page)","name":"([^"]+)"/,
    /"owner":\{"__typename":"(?:User|Page)"[^}]*"name":"([^"]+)"/,
    /"actors":\[\{"__typename":"User","name":"([^"]+)"/
  ],
  storyAuthor: [
    /"story_bucket_owner":\{"__typename":"User"[^}]*"name":"([^"]+)"/,
    /"bucket_owner":\{"__typename":"User"[^}]*"name":"([^"]+)"/,
    /"owner":\{"__typename":"User","id":"[^"]+","name":"([^"]+)"[^}]*\},"story_card_seen_state"/,
    /"unified_stories":\{"edges":\[\{"node":\{"id":"[^"]+","owner":\{"__typename":"User","name":"([^"]+)"/,
    /"story_card_info":[^}]*"owner":\{"name":"([^"]+)"/
  ],
  description: [
    /"message":\{"text":"([^"]+)"/,
    /"content":\{"text":"([^"]+)"/,
    /"caption":"([^"]+)"/,
    /"description":\{"text":"([^"]+)"/,
    /"savable_description":\{"text":"([^"]+)"/,
    /"title":\{"text":"([^"]{10,})"/
  ],
  creationTime: /"(?:creation|created|publish)_time":(\d{10})/,
  thumbnail: /"(?:previewImage|thumbnailImage|poster_image|preferred_thumbnail)"[^}]*?"uri":"(https:[^"]+)"/,
  likes: [
    /"reaction_count":\{"count":(\d+)/,
    /"i18n_reaction_count":"([^"]+)"/,
    /"reactors":\{"count":(\d+)/,
    /"feedback":\{[^}]*"reaction_count":\{"count":(\d+)/,
    /"likecount":(\d+)/i,
    /"like_count":(\d+)/
  ],
  comments: [
    /"comment_count":\{"total_count":(\d+)/,
    /"comments":\{"total_count":(\d+)/,
    /"comments_count_summary_renderer"[^}]*"count":\{"count":(\d+)/,
    /"feedback":\{[^}]*"comment_count":\{"total_count":(\d+)/,
    /"total_comment_count":(\d+)/,
    /"commentcount":(\d+)/i
  ],
  shares: [
    /"share_count":\{"count":(\d+)/,
    /"reshares":\{"count":(\d+)/,
    /"i18n_share_count":"([^"]+)"/,
    /"feedback":\{[^}]*"share_count":\{"count":(\d+)/,
    /"sharecount":(\d+)/i
  ],
  views: [
    /"video_view_count":(\d+)/,
    /"play_count":(\d+)/,
    /"seen_by_count":(\d+)/,
    /"view_count":(\d+)/,
    /"viewCount":(\d+)/,
    /"video_view_count_renderer"[^}]*"count":\{"count":(\d+)/,
    /"short_form_video_context"[^}]*"play_count":(\d+)/,
    /"playCount":(\d+)/,
    /(\d+)\s*(?:views|Views|lượt xem|次观看|回視聴|просмотр)/
  ]
};

// ============================================================
// CONTENT ISSUE PATTERNS
// ============================================================

export const CONTENT_ISSUES: Record<string, RegExp[]> = {
  AGE_RESTRICTED: [
    /You must be 18 years or older/i, /age-restricted/i,
    /"is_adult_content":true/, /"adult_content":true/,
    /AdultContentWarningDialog/i, /AgeGateDialog/i,
    /content is age-restricted/i, /"gating_type":"AGE_GATING"/,
    /You must be at least \d+ years old/i
  ],
  PRIVATE_CONTENT: [
    /This content isn't available/i, /content isn't available right now/i,
    /content isn't available at the moment/i, /Sorry, this content isn't available/i,
    /The link you followed may be broken/i, /This page isn't available/i,
    /page isn't available at the moment/i
  ],
  DELETED: [/This video is no longer available/i, /video may have been removed/i],
  UNAVAILABLE_ATTACHMENT: [/"UnavailableAttachment"/, /"unavailable_attachment_style"/],
  STORY_EXPIRED: [
    /"story_card_attachments":\{"nodes":\[\]\}/,
    /"unified_stories":\{"edges":\[\]\}/,
    /"story_bucket_owner"[^}]+\}[^"]*"attachments":\{"nodes":\[\]\}/,
    /Story unavailable/i, /This story is no longer available/i, /story has expired/i
  ]
};

// ============================================================
// OTHER PATTERNS
// ============================================================

export const BOUNDARY_MARKERS: string[] = [
  '"browser_native_hd_url"', '"browser_native_sd_url"', '"playable_url"',
  '"all_subattachments"', '"viewer_image"', '"photo_image"',
  '"progressive_url"', '"story_bucket_owner"'
];

export const SKIP_IMAGE_SIDS: string[] = [
  'bd9a62', '23dd7b', '50ce42', '9a7156', '1d2534',
  'e99d92', 'a6c039', '72b077', 'ba09c1', 'f4d7c3',
  '0f7a8c', '3c5e9a', 'd41d8c'
];

export const SKIP_IMAGE_PATTERNS: RegExp[] = [
  /emoji/i, /sticker/i, /static/i, /rsrc/i, /profile/i, /avatar/i,
  /\/cp0\//
  // Removed: /\/[ps]\d+x\d+\//, /_s\d+x\d+/, /\.webp\?/
  // These patterns were blocking valid Instagram-style images from Facebook
];

export const VALID_MEDIA_PATTERNS: Record<string, RegExp | number> = {
  video: /fbcdn|scontent/,
  image: /scontent|fbcdn/,
  minLength: 30
};

export const ID_PATTERNS = {
  video: /\/(?:reel|videos?)\/(\d+)/,
  post: [
    /\/groups\/[^/]+\/permalink\/(\d+)/, /\/groups\/[^/]+\/posts\/(\d+)/,
    /\/posts\/(pfbid[a-zA-Z0-9]+)/, /\/posts\/(\d+)/, /\/permalink\/(\d+)/,
    /story_fbid=(pfbid[a-zA-Z0-9]+)/, /story_fbid=(\d+)/,
    /\/photos?\/[^/]+\/(\d+)/, /\/share\/p\/([a-zA-Z0-9]+)/, /fbid=(\d+)/
  ]
};

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type ContentType = 'story' | 'reel' | 'video' | 'post' | 'group' | 'unknown';

export interface ScanStreamOptions {
  signal?: AbortSignal;
  contentType?: ContentType;
}

export interface ScanStreamResult {
  html: string;
  hasIssue: boolean;
  issueCode: ErrorCode | null;
}

// ============================================================
// SCANNER FUNCTIONS
// ============================================================

/**
 * Detect content type from URL
 */
export function detectContentType(url: string): ContentType {
  for (const [type, pattern] of Object.entries(CONTENT_TYPE_PATTERNS)) {
    if (pattern.test(url)) return type as ContentType;
  }
  return 'unknown';
}

/**
 * Detect content issues from HTML chunk
 */
export function detectContentIssues(chunk: string): ErrorCode | null {
  const lower = chunk.toLowerCase();
  
  if (containsAny(chunk, CONTENT_ISSUES.AGE_RESTRICTED) || 
      containsAny(lower, CONTENT_ISSUES.AGE_RESTRICTED)) {
    return ErrorCode.AGE_RESTRICTED;
  }

  const hasMediaPatterns = chunk.includes('browser_native') || 
                          chunk.includes('all_subattachments') || 
                          chunk.includes('viewer_image') || 
                          chunk.includes('playable_url') || 
                          chunk.includes('photo_image');
  
  if (hasMediaPatterns) return null;

  if (containsAny(chunk, CONTENT_ISSUES.PRIVATE_CONTENT)) return ErrorCode.PRIVATE_CONTENT;
  if (containsAny(chunk, CONTENT_ISSUES.DELETED)) return ErrorCode.DELETED_CONTENT;
  if (containsAny(chunk, CONTENT_ISSUES.UNAVAILABLE_ATTACHMENT)) return ErrorCode.PRIVATE_CONTENT;

  return null;
}

/**
 * Find target block in HTML for extraction
 */
export function findTargetBlock(html: string, id: string | null, type: string): string {
  const MAX_SEARCH = type === 'video' ? 80000 : 100000;
  
  if (!id) {
    return html.length > MAX_SEARCH ? html.substring(0, MAX_SEARCH) : html;
  }

  const searchKey = id.startsWith('pfbid') ? id.substring(5, 30) : id;
  let targetPos = -1;

  const postIdPatterns = [
    `"post_id":"${id}"`, `"story_fbid":"${id}"`,
    `/permalink/${id}`, `/posts/${id}`, `"id":"${id}"`
  ];

  for (const pattern of postIdPatterns) {
    const pos = html.indexOf(pattern);
    if (pos > -1) { targetPos = pos; break; }
  }

  if (targetPos === -1 && id.startsWith('pfbid')) targetPos = html.indexOf(searchKey);
  if (targetPos === -1) targetPos = html.indexOf(id);

  if (type === 'video' && targetPos > -1) {
    const searchStart = Math.max(0, targetPos - 5000);
    const searchEnd = Math.min(html.length, targetPos + 50000);
    const searchArea = html.substring(searchStart, searchEnd);

    const videoKeys = [
      '"browser_native_hd_url":', '"browser_native_sd_url":',
      '"playable_url_quality_hd":', '"playable_url":', '"progressive_url":'
    ];

    for (const key of videoKeys) {
      const pos = searchArea.indexOf(key);
      if (pos > -1) {
        const blockStart = Math.max(0, pos - 1000);
        const blockEnd = Math.min(searchArea.length, pos + 15000);
        return searchArea.substring(blockStart, blockEnd);
      }
    }
    return searchArea;
  }

  if (type === 'post') {
    const subKey = '"all_subattachments":{"count":';
    const cometPos = html.indexOf('"comet_sections"');
    const creationPos = html.indexOf('"creation_story"');
    const mainPostPos = Math.min(
      cometPos > -1 ? cometPos : Infinity,
      creationPos > -1 ? creationPos : Infinity
    );

    let bestSubPos = -1;
    if (mainPostPos < Infinity) {
      const searchArea = html.substring(mainPostPos, mainPostPos + 300000);
      const subInArea = searchArea.indexOf(subKey);
      if (subInArea > -1) bestSubPos = mainPostPos + subInArea;
    }
    if (bestSubPos === -1) bestSubPos = html.indexOf(subKey);

    if (bestSubPos > -1) {
      let endPos = html.indexOf('"all_subattachments":', bestSubPos + 30);
      if (endPos === -1 || endPos - bestSubPos > 30000) endPos = bestSubPos + 25000;
      return html.substring(Math.max(0, bestSubPos - 500), Math.min(html.length, endPos));
    }

    if (mainPostPos < Infinity) {
      return html.substring(mainPostPos, Math.min(html.length, mainPostPos + 100000));
    }

    if (targetPos > -1) {
      const viewerKey = '"viewer_image":';
      let viewerPos = html.indexOf(viewerKey, Math.max(0, targetPos - 3000));
      if (viewerPos === -1) viewerPos = html.indexOf(viewerKey);
      if (viewerPos > -1) {
        return html.substring(Math.max(0, viewerPos - 500), Math.min(html.length, viewerPos + 15000));
      }
    }
  }

  if (targetPos > -1) {
    const before = type === 'video' ? 5000 : 5000;
    const after = type === 'video' ? 50000 : 20000;
    return html.substring(Math.max(0, targetPos - before), Math.min(html.length, targetPos + after));
  }

  return html.length > MAX_SEARCH ? html.substring(0, MAX_SEARCH) : html;
}



/**
 * Scan stream for HTML content
 * Processes stream chunks and checks for content issues
 */
export async function scanStream(
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
  options: ScanStreamOptions = {}
): Promise<ScanStreamResult> {
  const { signal } = options;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let earlyIssueChecked = false;

  try {
    // Handle Web ReadableStream
    if ('getReader' in stream) {
      const reader = stream.getReader();
      try {
        while (true) {
          if (signal?.aborted) {
            await reader.cancel();
            throw new Error('Scan aborted');
          }

          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            chunks.push(value);
            totalBytes += value.length;

            if (!earlyIssueChecked && totalBytes >= 50000) {
              earlyIssueChecked = true;
              const earlyHtml = Buffer.concat(chunks).toString('utf-8');
              const issueCode = detectContentIssues(earlyHtml);
              if (issueCode) {
                await reader.cancel();
                return { html: earlyHtml, hasIssue: true, issueCode };
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // Handle Node.js ReadableStream
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        if (signal?.aborted) {
          if ('destroy' in stream && typeof stream.destroy === 'function') {
            stream.destroy();
          }
          throw new Error('Scan aborted');
        }

        const buffer = chunk instanceof Buffer ? chunk : Buffer.from(chunk);
        chunks.push(buffer);
        totalBytes += buffer.length;

        if (!earlyIssueChecked && totalBytes >= 50000) {
          earlyIssueChecked = true;
          const earlyHtml = Buffer.concat(chunks).toString('utf-8');
          const issueCode = detectContentIssues(earlyHtml);
          if (issueCode) {
            if ('destroy' in stream && typeof stream.destroy === 'function') {
              stream.destroy();
            }
            return { html: earlyHtml, hasIssue: true, issueCode };
          }
        }
      }
    }

    const html = Buffer.concat(chunks).toString('utf-8');
    return { html, hasIssue: false, issueCode: null };

  } catch (error) {
    if (error instanceof Error && error.message === 'Scan aborted') throw error;
    logger.error('facebook-scanner', 'Stream scan failed', error as Error);
    throw error;
  }
}

