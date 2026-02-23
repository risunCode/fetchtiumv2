"""Error code mapping and helpers."""

from __future__ import annotations

import re


class ErrorCode:
    UNSUPPORTED_PLATFORM = "UNSUPPORTED_PLATFORM"
    INVALID_URL = "INVALID_URL"
    FETCH_FAILED = "FETCH_FAILED"
    TIMEOUT = "TIMEOUT"
    RATE_LIMITED = "RATE_LIMITED"
    AGE_RESTRICTED = "AGE_RESTRICTED"
    PRIVATE_CONTENT = "PRIVATE_CONTENT"
    DELETED_CONTENT = "DELETED_CONTENT"
    LOGIN_REQUIRED = "LOGIN_REQUIRED"
    STORY_EXPIRED = "STORY_EXPIRED"
    GEO_RESTRICTED = "GEO_RESTRICTED"
    NO_MEDIA_FOUND = "NO_MEDIA_FOUND"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    INTERNAL_ERROR = "INTERNAL_ERROR"


ERROR_PATTERNS = {
    r"(age[_-]?restricted|18\+|mature|adult.only)": ErrorCode.AGE_RESTRICTED,
    r"(private|members.only)": ErrorCode.PRIVATE_CONTENT,
    r"(deleted|removed|taken.down|no.longer|unavailable|not.available)": ErrorCode.DELETED_CONTENT,
    r"(login|sign.in|authenticate|session)": ErrorCode.LOGIN_REQUIRED,
    r"(geo[_-]?blocked|country|region|not.available.in.your)": ErrorCode.GEO_RESTRICTED,
    r"(rate.limit|too.many|429|throttl)": ErrorCode.RATE_LIMITED,
    r"(timeout|timed?.out)": ErrorCode.TIMEOUT,
    r"(404|not.found|does.not.exist)": ErrorCode.DELETED_CONTENT,
    r"(403|forbidden|access.denied)": ErrorCode.PRIVATE_CONTENT,
}


def detect_error_code(error_message: str) -> str:
    if not error_message:
        return ErrorCode.EXTRACTION_FAILED

    msg = error_message.lower()
    for pattern, code in ERROR_PATTERNS.items():
        if re.search(pattern, msg, re.IGNORECASE):
            return code
    return ErrorCode.EXTRACTION_FAILED


def create_error_response(code: str, message: str) -> dict:
    return {"success": False, "error": {"code": code, "message": message}}
