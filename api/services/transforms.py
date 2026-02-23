"""Platform result transformers independent from legacy module."""

from __future__ import annotations

from ..config import detect_platform
from .formats import process_audio_formats, process_video_formats, process_youtube_formats
from .resolver import resolve_media_urls_parallel


def _stats(info: dict) -> dict:
    return {
        "views": info.get("view_count"),
        "likes": info.get("like_count"),
        "comments": info.get("comment_count"),
    }


def _base_success(platform: str, content_type: str, info: dict, items: list[dict]) -> dict:
    return {
        "success": True,
        "platform": platform,
        "contentType": content_type,
        "title": info.get("title"),
        "author": info.get("uploader") or info.get("channel") or info.get("artist") or info.get("uploader_id"),
        "id": info.get("id"),
        "description": info.get("description"),
        "uploadDate": info.get("upload_date"),
        "duration": info.get("duration"),
        "stats": _stats(info),
        "items": items,
    }


def _unwrap_playlist_entry_for_youtube(info: dict) -> dict:
    if info.get("formats"):
        return info

    entries = info.get("entries") or []
    for entry in entries:
        if isinstance(entry, dict) and entry.get("formats"):
            return entry

    return info


def transform_ytdlp_result(info: dict, original_url: str) -> dict:
    platform = detect_platform(original_url) or "unknown"
    transform_info = _unwrap_playlist_entry_for_youtube(info) if platform == "youtube" else info
    formats = transform_info.get("formats") or []

    if platform == "youtube":
        videos, audios, hls = process_youtube_formats(formats, transform_info)
    else:
        videos, audios = process_video_formats(formats, transform_info)
        hls = []

    if platform == "soundcloud" and audios:
        items = [{"index": 0, "type": "audio", "sources": process_audio_formats(audios)}]
        return _base_success(platform, "audio", transform_info, items)

    video_sources = list(videos or [])
    if hls:
        video_sources.extend(hls)

    if not video_sources and transform_info.get("url"):
        video_sources = [
            {
                "quality": "source",
                "url": transform_info.get("url"),
                "mime": "video/mp4",
                "extension": "mp4",
            }
        ]

    items = [{"index": 0, "type": "video", "thumbnail": transform_info.get("thumbnail"), "sources": video_sources}]
    if audios:
        items.append(
            {
                "index": 1,
                "type": "audio",
                "thumbnail": transform_info.get("thumbnail"),
                "sources": audios,
            }
        )

    return _base_success(platform, "video", transform_info, items)


def transform_twitch_result(info: dict, original_url: str) -> dict:
    return transform_ytdlp_result(info, original_url)


def _extract_bandcamp_audio_sources(track_info: dict) -> list[dict]:
    audio = (track_info.get("formats") or [])
    _, audio_sources = process_video_formats(audio, track_info)
    return process_audio_formats(audio_sources)


def transform_bandcamp_result(info: dict, original_url: str) -> dict:
    entries = info.get("entries")
    if entries:
        items = []
        for idx, entry in enumerate(entries):
            items.append(
                {
                    "index": idx,
                    "type": "audio",
                    "title": entry.get("title"),
                    "sources": _extract_bandcamp_audio_sources(entry),
                }
            )
        return _base_success("bandcamp", "audio", info, items)

    return transform_ytdlp_result(info, original_url)


def transform_eporner_result(info: dict, original_url: str) -> dict:
    return transform_nsfw_video_result(info, original_url)


def transform_nsfw_video_result(info: dict, original_url: str) -> dict:
    result = transform_ytdlp_result(info, original_url)
    if not result.get("success"):
        return result

    items = result.get("items") or []
    urls_to_resolve: list[str] = []
    for item in items:
        for src in item.get("sources") or []:
            urls_to_resolve.append(src.get("url"))

    resolved = resolve_media_urls_parallel(urls_to_resolve)
    cursor = 0
    for item in items:
        for src in item.get("sources") or []:
            src["url"] = resolved[cursor]
            cursor += 1

    result["items"] = items
    return result


def _get_valid_thumbnail(metadata: dict, media_url: str) -> str | None:
    thumb = metadata.get("thumbnail") or metadata.get("thumb")
    if thumb:
        return thumb
    if media_url.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        return media_url
    return None


def transform_gallery_dl_result(results: list[dict], original_url: str) -> dict:
    platform = detect_platform(original_url) or "unknown"
    items: list[dict] = []

    for idx, result in enumerate(results or []):
        url = result.get("url") or result.get("file_url") or result.get("source")
        if not url:
            continue
        is_video = str(url).lower().endswith((".mp4", ".webm", ".m3u8"))
        items.append(
            {
                "index": idx,
                "type": "video" if is_video else "image",
                "thumbnail": _get_valid_thumbnail(result, str(url)),
                "sources": [
                    {
                        "quality": "original",
                        "url": str(url),
                        "mime": "video/mp4" if is_video else "image/jpeg",
                    }
                ],
            }
        )

    if not items:
        return {"success": False, "error": {"code": "NO_MEDIA_FOUND", "message": "No media found"}}

    return {
        "success": True,
        "platform": platform,
        "contentType": "gallery" if len(items) > 1 else items[0]["type"],
        "items": items,
    }


def transform_pinterest_result(results: list[dict], original_url: str) -> dict:
    return transform_gallery_dl_result(results, original_url)


def transform_weibo_result(results: list[dict], original_url: str) -> dict:
    return transform_gallery_dl_result(results, original_url)
