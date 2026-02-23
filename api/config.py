"""Centralized configuration and platform registry."""

from __future__ import annotations

import httpx
import re

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}

try:
    HTTP_CLIENT = httpx.Client(
        http2=True,
        timeout=10.0,
        follow_redirects=True,
        headers={"User-Agent": DEFAULT_USER_AGENT},
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20, keepalive_expiry=300),
    )
except ImportError:
    HTTP_CLIENT = httpx.Client(
        timeout=10.0,
        follow_redirects=True,
        headers={"User-Agent": DEFAULT_USER_AGENT},
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20, keepalive_expiry=300),
    )

PLATFORM_CONFIG = {
    "youtube": {
        "extractor": "yt-dlp",
        "patterns": [r"youtube\.com", r"youtu\.be", r"youtube-nocookie\.com"],
        "nsfw": False,
    },
    "bilibili": {
        "extractor": "yt-dlp",
        "patterns": [r"bilibili\.com", r"bilibili\.tv", r"b23\.tv"],
        "nsfw": False,
    },
    "reddit": {
        "extractor": "gallery-dl",
        "patterns": [r"reddit\.com", r"redd\.it", r"v\.redd\.it"],
        "nsfw": False,
    },
    "soundcloud": {
        "extractor": "yt-dlp",
        "patterns": [r"soundcloud\.com"],
        "nsfw": False,
    },
    "eporner": {
        "extractor": "yt-dlp",
        "patterns": [r"eporner\.com"],
        "nsfw": True,
    },
    "rule34video": {
        "extractor": "yt-dlp",
        "patterns": [r"rule34video\.com"],
        "nsfw": True,
    },
    "twitch": {
        "extractor": "yt-dlp",
        "patterns": [r"twitch\.tv/\w+/clip", r"clips\.twitch\.tv"],
        "nsfw": False,
    },
    "bandcamp": {
        "extractor": "yt-dlp",
        "patterns": [r"bandcamp\.com", r"\w+\.bandcamp\.com"],
        "nsfw": False,
    },
    "weibo": {
        "extractor": "gallery-dl",
        "patterns": [r"weibo\.com", r"weibo\.cn"],
        "nsfw": False,
    },
    "pinterest": {
        "extractor": "gallery-dl",
        "patterns": [r"pinterest\.com", r"pin\.it"],
        "nsfw": False,
    },
    "pixiv": {
        "extractor": "native",
        "patterns": [r"pixiv\.net"],
        "nsfw": False,
    },
}

PLATFORMS = {name: cfg["patterns"] for name, cfg in PLATFORM_CONFIG.items()}
YTDLP_PLATFORMS = [name for name, cfg in PLATFORM_CONFIG.items() if cfg["extractor"] == "yt-dlp"]
GALLERY_DL_PLATFORMS = [name for name, cfg in PLATFORM_CONFIG.items() if cfg["extractor"] == "gallery-dl"]
NSFW_PLATFORMS = [name for name, cfg in PLATFORM_CONFIG.items() if cfg["nsfw"]]

SHORT_URL_PATTERNS = {
    "pin.it": r"pin\.it",
    "b23.tv": r"b23\.tv",
    "redd.it": r"redd\.it",
}

TRACKING_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "ref",
    "ref_src",
    "ref_url",
    "share_id",
    "sent",
    "spm_id_from",
    "vd_source",
    "from",
    "seid",
]


def detect_platform(url: str) -> str | None:
    for platform, patterns in PLATFORMS.items():
        if any(re.search(pattern, url, re.IGNORECASE) for pattern in patterns):
            return platform
    return None
