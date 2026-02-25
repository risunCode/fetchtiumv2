"""Input validation and sanitization helpers."""

from __future__ import annotations

import json
import re
from urllib.parse import urlparse

MAX_URL_LENGTH = 2048
MAX_COOKIE_LENGTH = 8192

BLOCKED_HOST_PATTERNS = [
    r"^localhost$",
    r"^127\.",
    r"^10\.",
    r"^172\.(1[6-9]|2[0-9]|3[01])\.",
    r"^192\.168\.",
    r"^169\.254\.",
    r"^0\.",
    r"^\[::1\]",
    r"^\[fc",
    r"^\[fd",
    r"^\[fe80:",
    r"^metadata\.",
    r"\.internal$",
    r"\.local$",
]

ATTACK_PATTERNS = [
    r"\.\.[/\\]",
    r"%2e%2e",
    r"%00",
    r"\x00",
    r"[`]",
    r"\$\{",
    r"\$\(",
    r";\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)",
    r"\|\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)",
    r">\s*/",
    r"[\r\n]",
    r"%0[aAdD]",
    r"file://",
    r"gopher://",
    r"dict://",
    r"ftp://",
]


def is_blocked_host(hostname: str) -> bool:
    if not hostname:
        return True
    lowered = hostname.lower()
    return any(re.search(pattern, lowered, re.IGNORECASE) for pattern in BLOCKED_HOST_PATTERNS)


def has_attack_pattern(input_str: str) -> bool:
    if not input_str:
        return False
    return any(re.search(pattern, input_str, re.IGNORECASE) for pattern in ATTACK_PATTERNS)


def validate_url(url: str) -> tuple[bool, str]:
    if not url:
        return False, "URL is required"
    if len(url) > MAX_URL_LENGTH:
        return False, f"URL too long (max {MAX_URL_LENGTH} chars)"
    if has_attack_pattern(url):
        return False, "Malicious pattern detected"

    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"

    if parsed.scheme not in ("http", "https"):
        return False, "Only HTTP/HTTPS URLs allowed"
    if is_blocked_host(parsed.hostname or ""):
        return False, "Internal hosts not allowed"

    hostname = parsed.hostname or ""
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", hostname) and is_blocked_host(hostname):
        return False, "Direct IP access not allowed for internal ranges"

    return True, ""


def sanitize_cookie(cookie: str) -> str | None:
    if not cookie:
        return None
    if len(cookie) > MAX_COOKIE_LENGTH:
        return None
    if has_attack_pattern(cookie):
        return None
    sanitized = re.sub(r"[\x00-\x1f\x7f]", "", cookie)
    return sanitized if sanitized else None


def convert_cookie_to_netscape(cookie: str, domain: str | None = None) -> str:
    cookie = cookie.strip()
    if cookie.startswith("# Netscape") or cookie.startswith("# HTTP Cookie"):
        return cookie

    if "\t" in cookie:
        lines = cookie.split("\n")
        valid = sum(1 for line in lines if line.strip() and not line.startswith("#") and len(line.split("\t")) >= 7)
        if valid > 0:
            return "# Netscape HTTP Cookie File\n# https://curl.haxx.se/rfc/cookie_spec.html\n\n" + cookie

    if cookie.startswith("[") or cookie.startswith("{"):
        try:
            data = json.loads(cookie)
            if not isinstance(data, list):
                data = [data]
            lines = ["# Netscape HTTP Cookie File", "# https://curl.haxx.se/rfc/cookie_spec.html", ""]
            for c in data:
                if not isinstance(c, dict) or "name" not in c or "value" not in c:
                    continue
                c_domain = c.get("domain", domain or "")
                if c_domain and not c_domain.startswith("."):
                    c_domain = "." + c_domain
                host_only = "FALSE" if c_domain.startswith(".") else "TRUE"
                path = c.get("path", "/")
                secure = "TRUE" if c.get("secure", False) else "FALSE"
                expiry = c.get("expirationDate") or c.get("expiry") or c.get("expires", 0)
                if isinstance(expiry, float):
                    expiry = int(expiry)
                lines.append(
                    f"{c_domain}\t{host_only}\t{path}\t{secure}\t{expiry}\t{c['name']}\t{c['value']}"
                )
            return "\n".join(lines)
        except json.JSONDecodeError:
            pass

    if "=" in cookie and ";" in cookie and domain:
        if not domain.startswith("."):
            domain = "." + domain
        lines = ["# Netscape HTTP Cookie File", "# https://curl.haxx.se/rfc/cookie_spec.html", ""]
        for pair in cookie.split(";"):
            pair = pair.strip()
            if "=" not in pair:
                continue
            idx = pair.index("=")
            name = pair[:idx].strip()
            value = pair[idx + 1 :].strip()
            if name and value:
                lines.append(f"{domain}\tTRUE\t/\tTRUE\t0\t{name}\t{value}")
        if len(lines) > 3:
            return "\n".join(lines)

    return cookie


def sanitize_output(value):
    if isinstance(value, str):
        value = re.sub(r"<[^>]+>", "", value)
        return re.sub(r"[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]", "", value)
    if isinstance(value, dict):
        return {k: sanitize_output(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_output(v) for v in value]
    return value
