"""YouTube stream proxy blueprint."""

from __future__ import annotations

from urllib.parse import quote, urljoin

from flask import Blueprint, Response, request

from ..config import HTTP_CLIENT

proxy_bp = Blueprint("proxy", __name__)


def _cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, max-age=60",
    }


@proxy_bp.route("/api/yt-stream", methods=["GET", "OPTIONS"])
def yt_stream():
    if request.method == "OPTIONS":
        return ("", 204, _cors_headers())

    target_url = request.args.get("url", "").strip()
    if not target_url:
        return ({"success": False, "error": {"code": "INVALID_URL", "message": "Missing url"}}, 400, _cors_headers())

    is_chunk = request.args.get("chunk") == "1"

    try:
        upstream = HTTP_CLIENT.get(target_url)
    except Exception as exc:
        return ({"success": False, "error": {"code": "FETCH_FAILED", "message": str(exc)}}, 500, _cors_headers())

    headers = _cors_headers()
    content_type = upstream.headers.get("content-type", "")

    if is_chunk:
        if content_type:
            headers["Content-Type"] = content_type
        headers["Cache-Control"] = "public, max-age=300"
        return Response(upstream.content, status=upstream.status_code, headers=headers)

    playlist_text = upstream.text
    if ".m3u8" in target_url or "mpegurl" in content_type:
        rewritten_lines = []
        for line in playlist_text.splitlines():
            if not line or line.startswith("#"):
                rewritten_lines.append(line)
                continue
            absolute = urljoin(target_url, line)
            rewritten_lines.append(f"/api/yt-stream?url={quote(absolute, safe='')}&chunk=1")

        headers["Content-Type"] = "application/vnd.apple.mpegurl"
        headers["Cache-Control"] = "no-cache"
        return Response("\n".join(rewritten_lines), status=upstream.status_code, headers=headers)

    if content_type:
        headers["Content-Type"] = content_type
    return Response(upstream.content, status=upstream.status_code, headers=headers)
