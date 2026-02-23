"""yt-dlp extraction service."""

from __future__ import annotations

import os
import tempfile
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

import yt_dlp

from ..config import DEFAULT_USER_AGENT, detect_platform
from ..errors import ErrorCode, create_error_response, detect_error_code
from ..security import convert_cookie_to_netscape
from .transforms import (
    transform_bandcamp_result,
    transform_eporner_result,
    transform_nsfw_video_result,
    transform_twitch_result,
    transform_ytdlp_result,
)


def _get_transformer(platform: str):
    if platform == "twitch":
        return transform_twitch_result
    if platform == "bandcamp":
        return transform_bandcamp_result
    if platform == "eporner":
        return transform_eporner_result
    if platform == "rule34video":
        return transform_nsfw_video_result
    return transform_ytdlp_result


def _canonicalize_youtube_watch_url(url: str) -> str:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    is_youtube_watch = host.endswith("youtube.com") and parts.path == "/watch"
    if not is_youtube_watch:
        return url

    query = parse_qs(parts.query, keep_blank_values=False)
    video_id = next((value for value in (query.get("v") or []) if value), None)
    if not video_id:
        return url

    canonical_query = [("v", video_id)]
    timestamp = next((value for value in (query.get("t") or []) if value), None)
    if timestamp:
        canonical_query.append(("t", timestamp))

    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(canonical_query), ""))


def extract_with_ytdlp(url: str, cookie: str | None = None) -> dict:
    platform = detect_platform(url) or "unknown"
    extraction_url = _canonicalize_youtube_watch_url(url) if platform == "youtube" else url

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "skip_download": True,
        "noplaylist": False,
        "socket_timeout": 15,
        "retries": 3,
        "http_headers": {"User-Agent": DEFAULT_USER_AGENT},
        "youtube_include_hls_manifest": True,
        "youtube_include_dash_manifest": True,
    }
    if platform == "youtube":
        ydl_opts["noplaylist"] = True

    cookie_file: str | None = None
    try:
        if cookie:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as handle:
                handle.write(convert_cookie_to_netscape(cookie))
                cookie_file = handle.name
            ydl_opts["cookiefile"] = cookie_file

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(extraction_url, download=False)

        transformer = _get_transformer(platform)
        return transformer(info or {}, url)
    except yt_dlp.DownloadError as exc:
        code = detect_error_code(str(exc))
        return create_error_response(code, str(exc))
    except Exception as exc:
        message = str(exc)
        code = detect_error_code(message) if message else ErrorCode.EXTRACTION_FAILED
        return create_error_response(code, message or "yt-dlp extraction failed")
    finally:
        if cookie_file and os.path.exists(cookie_file):
            try:
                os.unlink(cookie_file)
            except OSError:
                pass
