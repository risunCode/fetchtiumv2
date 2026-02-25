"""Extraction endpoint blueprint."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..config import GALLERY_DL_PLATFORMS, NSFW_PLATFORMS, YTDLP_PLATFORMS, detect_platform
from ..errors import ErrorCode, create_error_response
from ..security import sanitize_cookie, sanitize_output, validate_url
from ..services.gallery_dl import extract_with_gallery_dl
from ..services.ytdlp import extract_with_ytdlp

extract_bp = Blueprint("extract", __name__)


def _cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    }


def _status_for_error(code: str) -> int:
    if code == ErrorCode.LOGIN_REQUIRED:
        return 401
    if code in (ErrorCode.PRIVATE_CONTENT, ErrorCode.AGE_RESTRICTED):
        return 403
    if code == ErrorCode.DELETED_CONTENT:
        return 404
    if code == ErrorCode.RATE_LIMITED:
        return 429
    if code == ErrorCode.INTERNAL_ERROR:
        return 500
    return 400


@extract_bp.route("/api/extract", methods=["POST", "OPTIONS"])
def extract_route():
    if request.method == "OPTIONS":
        return ("", 204, _cors_headers())

    if not request.is_json:
        return jsonify(create_error_response(ErrorCode.INVALID_URL, "JSON body required")), 400, _cors_headers()

    body = request.get_json(silent=True) or {}
    url = (body.get("url") or "").strip()
    cookie = body.get("cookie")

    valid, error = validate_url(url)
    if not valid:
        return jsonify(create_error_response(ErrorCode.INVALID_URL, error)), 400, _cors_headers()

    cookie = sanitize_cookie(cookie) if cookie else None

    platform = detect_platform(url)
    if not platform:
        return (
            jsonify(create_error_response(ErrorCode.UNSUPPORTED_PLATFORM, "Platform not supported")),
            400,
            _cors_headers(),
        )

    try:
        if platform in YTDLP_PLATFORMS:
            result = extract_with_ytdlp(url, cookie)
        elif platform in GALLERY_DL_PLATFORMS:
            result = extract_with_gallery_dl(url, cookie)
        else:
            result = create_error_response(ErrorCode.UNSUPPORTED_PLATFORM, "No extractor for platform")

        result = sanitize_output(result)
        if isinstance(result, dict) and result.get("success"):
            result["isNsfw"] = platform in NSFW_PLATFORMS

        status = 200
        if not result.get("success"):
            status = _status_for_error((result.get("error") or {}).get("code", ErrorCode.EXTRACTION_FAILED))
        return jsonify(result), status, _cors_headers()
    except Exception as exc:
        return jsonify(create_error_response(ErrorCode.INTERNAL_ERROR, str(exc))), 500, _cors_headers()
