"""URL resolver service."""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from ..config import HTTP_CLIENT, SHORT_URL_PATTERNS, TRACKING_PARAMS


def resolve_short_url(url: str, platform: str | None = None) -> str:
    del platform
    is_short = any(re.search(pattern, url, re.IGNORECASE) for pattern in SHORT_URL_PATTERNS.values())
    if not is_short:
        return url

    try:
        response = HTTP_CLIENT.head(url)
        parsed = urlparse(str(response.url))
        query = parse_qs(parsed.query, keep_blank_values=True)
        cleaned = {
            key: value
            for key, value in query.items()
            if key.lower() not in [tracked.lower() for tracked in TRACKING_PARAMS]
        }
        query_str = urlencode({k: v[0] if len(v) == 1 else v for k, v in cleaned.items()}, doseq=True)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, query_str, ""))
    except Exception:
        return url


def resolve_media_url(url: str) -> str:
    wrapper_patterns = [r"rule34video\.com/get_file/", r"eporner\.com/.*redirect"]
    if not any(re.search(pattern, url, re.IGNORECASE) for pattern in wrapper_patterns):
        return url

    try:
        response = HTTP_CLIENT.head(url)
        final_url = str(response.url)
        if "youtube.com" in final_url or "youtu.be" in final_url:
            return url

        parsed = urlparse(final_url)
        query = parse_qs(parsed.query, keep_blank_values=True)
        cleaned = {
            key: value for key, value in query.items() if key.lower() not in ["download", "download_filename"]
        }
        query_str = urlencode({k: v[0] if len(v) == 1 else v for k, v in cleaned.items()}, doseq=True)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, query_str, ""))
    except Exception:
        return url


def resolve_media_urls_parallel(urls: list[str]) -> list[str]:
    wrapper_patterns = [r"rule34video\.com/get_file/", r"eporner\.com/.*redirect"]
    to_resolve: list[tuple[int, str]] = []
    for index, url in enumerate(urls):
        if any(re.search(pattern, url, re.IGNORECASE) for pattern in wrapper_patterns):
            to_resolve.append((index, url))

    if not to_resolve:
        return urls

    result = list(urls)
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_map = {executor.submit(resolve_media_url, url): idx for idx, url in to_resolve}
        for future in as_completed(future_map):
            idx = future_map[future]
            try:
                result[idx] = future.result()
            except Exception:
                result[idx] = urls[idx]
    return result
