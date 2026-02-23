"""gallery-dl extraction service."""

from __future__ import annotations

from typing import Any

from ..config import DEFAULT_USER_AGENT, detect_platform
from ..errors import ErrorCode, create_error_response, detect_error_code
from .transforms import transform_gallery_dl_result, transform_pinterest_result, transform_weibo_result


def _get_transformer(platform: str):
    if platform == "pinterest":
        return transform_pinterest_result
    if platform == "weibo":
        return transform_weibo_result
    return transform_gallery_dl_result


def _normalize_gallery_results(data: Any) -> list[dict]:
    if isinstance(data, list):
        return [entry for entry in data if isinstance(entry, dict)]
    if isinstance(data, dict):
        if isinstance(data.get("items"), list):
            return [entry for entry in data.get("items") if isinstance(entry, dict)]
        return [data]
    return []


def extract_with_gallery_dl(url: str, cookie: str | None = None) -> dict:
    platform = detect_platform(url) or "unknown"

    try:
        from gallery_dl import config as gdl_config
        from gallery_dl import job

        gdl_config.clear()
        gdl_config.set(("extractor",), "timeout", 30)
        gdl_config.set(("extractor",), "user-agent", DEFAULT_USER_AGENT)
        if cookie:
            gdl_config.set(("extractor",), "cookies", cookie)

        class MetadataJob(job.Job):
            def __init__(self, target_url: str):
                super().__init__(target_url)
                self.results = []

            def dispatch(self, msg):
                if isinstance(msg, tuple) and len(msg) >= 3 and msg[0] == 3:
                    payload = msg[2]
                    if isinstance(payload, dict):
                        self.results.append(payload)

        collector = MetadataJob(url)
        collector.run()

        results = _normalize_gallery_results(collector.results)
        if not results:
            return create_error_response(ErrorCode.NO_MEDIA_FOUND, "No media found from gallery-dl")

        transformer = _get_transformer(platform)
        return transformer(results, url)
    except Exception as exc:
        code = detect_error_code(str(exc))
        return create_error_response(code, str(exc))
