"""Format processing helpers independent from legacy monolith."""

from __future__ import annotations

import re


MIME_TO_EXTENSION = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "audio/aac": "aac",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}

EXTENSION_TO_MIME = {v: k for k, v in MIME_TO_EXTENSION.items()}

# Video codec priority (lower = better compatibility)
CODEC_PRIORITY = {"H.264": 0, "VP9": 1, "AV1": 2, "HEVC": 3}

# Target resolutions to include
TARGET_HEIGHTS = (1080, 720, 480, 360, 240, 144)


def normalize_codec_name(codec: str) -> str:
    """Normalize video codec name to standard format."""
    value = (codec or "").lower()
    if any(x in value for x in ("avc1", "h264", "avc")):
        return "H.264"
    if "vp9" in value:
        return "VP9"
    if "av01" in value or "av1" in value:
        return "AV1"
    if any(x in value for x in ("hevc", "h265", "hev1", "hvc1")):
        return "HEVC"
    return codec or "Unknown"


def normalize_audio_codec_name(codec: str) -> str:
    """Normalize audio codec name to standard format."""
    value = (codec or "").lower()
    if any(x in value for x in ("mp4a", "aac")):
        return "AAC"
    if "opus" in value:
        return "Opus"
    if "mp3" in value:
        return "MP3"
    if "vorbis" in value:
        return "Vorbis"
    if "flac" in value:
        return "FLAC"
    return codec or "Unknown"


def get_extension_from_mime(mime: str) -> str | None:
    return MIME_TO_EXTENSION.get((mime or "").lower())


def get_mime_from_extension(ext: str, media_type: str = "video") -> str:
    normalized = (ext or "").lower().lstrip(".")
    mapped = EXTENSION_TO_MIME.get(normalized)
    if mapped:
        return mapped
    return f"{media_type}/{normalized}" if normalized else f"{media_type}/octet-stream"


def sanitize_filename(name: str, max_length: int = 50) -> str:
    if not name:
        return "media"
    sanitized = re.sub(r'[<>:"/\|?*\x00-\x1F]', "", name).strip().rstrip(".")
    sanitized = re.sub(r"\s+", " ", sanitized)
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length].rstrip()
    return sanitized or "media"


def generate_filename(info: dict, fmt: dict, media_type: str) -> str:
    title = sanitize_filename((info or {}).get("title") or "media")
    ext = (fmt or {}).get("ext") or get_extension_from_mime((fmt or {}).get("mime") or "") or "bin"
    quality = (fmt or {}).get("quality") or (fmt or {}).get("format_note") or media_type
    quality = sanitize_filename(str(quality), 20)
    return f"{title}_{quality}.{ext}"


def _is_audio_only(fmt: dict) -> bool:
    """Check if format is audio-only (no video)."""
    vc = fmt.get("vcodec", "none")
    ac = fmt.get("acodec", "none")
    # yt-dlp uses "none" string for missing codecs
    return vc == "none" and ac not in (None, "none", "")


def _is_video(fmt: dict) -> bool:
    """Check if format has video."""
    vc = fmt.get("vcodec", "none")
    return vc not in (None, "none", "")


def _is_progressive(fmt: dict) -> bool:
    """Check if format has both video and audio (progressive/combined)."""
    vc = fmt.get("vcodec", "none")
    ac = fmt.get("acodec", "none")
    return vc not in (None, "none", "") and ac not in (None, "none", "")


def is_hls_format(fmt: dict) -> bool:
    """Check if format is HLS (m3u8 manifest)."""
    url = (fmt.get("url") or "").lower()
    proto = (fmt.get("protocol") or "").lower()
    ext = (fmt.get("ext") or "").lower()
    return (
        ".m3u8" in url
        or "m3u8" in proto
        or ext == "m3u8"
        or "/manifest/" in url
        or "index.m3u8" in url
        or proto == "hls"
    )


def _format_source(fmt: dict, media_type: str, is_progressive: bool = False) -> dict:
    """Build a source dict from yt-dlp format."""
    ext = fmt.get("ext")
    mime = fmt.get("mime_type") or get_mime_from_extension(ext or "", media_type)
    height = fmt.get("height")
    width = fmt.get("width")
    resolution = f"{width}x{height}" if width and height else None
    
    # Build quality string
    quality = fmt.get("format_note") or ""
    if not quality and height:
        quality = f"{height}p"
    if not quality:
        quality = "source"
    
    # Add FPS if > 30
    fps = fmt.get("fps")
    if fps and fps > 30:
        quality = f"{quality}{int(fps)}" if quality.endswith("p") else f"{quality} {fps}fps"
    
    # Get codec
    if _is_video(fmt):
        codec = normalize_codec_name(fmt.get("vcodec") or "")
    else:
        codec = normalize_audio_codec_name(fmt.get("acodec") or "")
    
    return {
        "quality": str(quality),
        "url": fmt.get("url") or "",
        "resolution": resolution,
        "mime": mime,
        "extension": ext,
        "bitrate": fmt.get("abr"),
        "codec": codec,
        "hasAudio": fmt.get("acodec") not in (None, "none", ""),
        "needsMerge": _is_video(fmt) and fmt.get("acodec") in (None, "none", ""),
        "format": "progressive" if is_progressive else ("hls" if is_hls_format(fmt) else "dash"),
        "formatId": fmt.get("format_id"),
        "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
    }


def process_audio_formats(audio_formats: list[dict], target_bitrate: int = 128) -> list[dict]:
    """Process audio-only formats, return best options per codec."""
    if not audio_formats:
        return []
    
    # Group by codec
    by_codec: dict[str, list[dict]] = {}
    for fmt in audio_formats:
        codec = normalize_audio_codec_name(fmt.get("acodec") or "")
        if codec not in by_codec:
            by_codec[codec] = []
        by_codec[codec].append(fmt)
    
    # Pick best from each codec (closest to target bitrate)
    result: list[dict] = []
    codec_order = ["AAC", "Opus", "MP3", "Vorbis", "FLAC"]  # Preference order
    
    for codec in codec_order:
        if codec not in by_codec:
            continue
        
        candidates = by_codec[codec]
        # Sort by distance from target bitrate
        candidates.sort(key=lambda f: abs((f.get("abr") or 0) - target_bitrate))
        
        # Pick the best one
        best = candidates[0]
        result.append(_format_source(best, "audio"))
    
    return result


def process_video_formats(
    formats: list[dict],
    info: dict,
    target_heights: tuple[int, ...] = TARGET_HEIGHTS,
    codec_priority: dict[str, int] = CODEC_PRIORITY,
) -> tuple[list[dict], list[dict]]:
    """Process formats for non-YouTube platforms."""
    videos: list[dict] = []
    audios: list[dict] = []
    
    for fmt in formats or []:
        if not fmt.get("url"):
            continue
        if is_hls_format(fmt):
            continue
        if _is_audio_only(fmt):
            audios.append(fmt)
        elif _is_video(fmt):
            videos.append(fmt)
    
    # Group by height
    by_height: dict[int, list[dict]] = {}
    for fmt in videos:
        h = fmt.get("height") or 0
        if h <= 0:
            continue
        if h not in by_height:
            by_height[h] = []
        by_height[h].append(fmt)
    
    # Select best codec per height
    selected: list[dict] = []
    for h in sorted(by_height.keys(), reverse=True):
        if h not in target_heights:
            continue
        candidates = by_height[h]
        # Sort by codec priority
        candidates.sort(key=lambda f: codec_priority.get(normalize_codec_name(f.get("vcodec") or ""), 99))
        best = candidates[0]
        selected.append(_format_source(best, "video", is_progressive=_is_progressive(best)))
    
    if not selected:
        # Fallback: return top 6
        for fmt in videos[:6]:
            selected.append(_format_source(fmt, "video", is_progressive=_is_progressive(fmt)))
    
    return selected, process_audio_formats(audios)


def process_youtube_formats(
    formats: list[dict],
    info: dict,
    target_heights: tuple[int, ...] = TARGET_HEIGHTS,
    codec_priority: dict[str, int] = CODEC_PRIORITY,
    include_hls: bool = False,
) -> tuple[list[dict], list[dict], list[dict]]:
    videos: list[dict] = []
    audios: list[dict] = []
    progressive: list[dict] = []
    hls_formats: list[dict] = []
    
    for fmt in formats or []:
        if not fmt.get("url"):
            continue
        if is_hls_format(fmt):
            if include_hls:
                hls_formats.append(fmt)
            continue
        if _is_audio_only(fmt):
            audios.append(fmt)
        elif _is_video(fmt):
            if _is_progressive(fmt):
                progressive.append(fmt)
            else:
                videos.append(fmt)
    
    result: list[dict] = []
    
    progressive_heights: set[int] = set()
    for fmt in progressive:
        h = fmt.get("height") or 0
        if h > 0:
            progressive_heights.add(h)
        result.append(_format_source(fmt, "video", is_progressive=True))
    
    by_height_codec: dict[tuple[int, str], list[dict]] = {}
    for fmt in videos:
        h = fmt.get("height") or 0
        if h <= 0:
            continue
        codec = normalize_codec_name(fmt.get("vcodec") or "")
        key = (h, codec)
        if key not in by_height_codec:
            by_height_codec[key] = []
        by_height_codec[key].append(fmt)
    
    unique_heights = sorted(set(h for h, _ in by_height_codec.keys()), reverse=True)
    
    for h in unique_heights:
        codecs_at_height = []
        for codec in ["H.264", "VP9", "AV1", "HEVC"]:
            if codec == "H.264" and h in progressive_heights:
                continue
            key = (h, codec)
            if key in by_height_codec:
                candidates = by_height_codec[key]
                candidates.sort(key=lambda f: codec_priority.get(normalize_codec_name(f.get("vcodec") or ""), 99))
                codecs_at_height.append(candidates[0])
        
        for fmt in codecs_at_height:
            result.append(_format_source(fmt, "video", is_progressive=False))
    
    hls_sources = [_format_source(fmt, "video", is_progressive=False) for fmt in hls_formats]
    
    return result, process_audio_formats(audios), hls_sources 
