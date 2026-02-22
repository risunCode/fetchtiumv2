# Supported Platforms

FetchtiumV2 supports two extractor groups.

## Native Extractors (TypeScript)

- Facebook
- Instagram
- Twitter/X
- TikTok
- Pixiv

These run directly in Next.js runtime and are available in all profiles.

## Python Extractors (yt-dlp/gallery-dl)

- YouTube
- SoundCloud
- BiliBili
- Twitch (clips)
- Bandcamp
- Reddit
- Pinterest
- Weibo
- Eporner (NSFW)
- Rule34Video (NSFW)

These require Python-enabled profile (`full`).

## Profile Matrix

| Platform Group | `vercel` | `full` |
| --- | --- | --- |
| Native extractors | Yes | Yes |
| Python extractors | No | Yes |

If Python platform is requested in `vercel` profile:

- API returns `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`.

## URL Pattern Routing

Defined in:

- Native matching: each extractor class under `src/lib/extractors/*`
- Python matching: `src/lib/extractors/python-platforms.ts`

Routing decision is applied in:

- `src/app/api/v1/extract/route.ts`
