# api/extract.py
"""
Python extractor endpoint for Vercel serverless functions.
Handles platforms: BiliBili, Reddit, SoundCloud, Pixiv, Eporner, Rule34Video

Uses Flask for Vercel's WSGI support.

SECURITY:
- URL validation (protocol, SSRF protection)
- Input sanitization (path traversal, command injection)
- Rate limiting headers
- No file system access beyond temp files
- Cookie sanitization

FILE ORGANIZATION:
1. Imports
2. Flask App Initialization
3. Constants & Configuration
4. Platform Configuration Registry
5. Security Configuration & Functions
6. Error Handling
7. Platform Detection & URL Resolution
8. Extractors
9. Format Processing
10. MIME Type Mapping & Filename Generation
11. Transformers
12. Flask Routes
13. Local Development
"""

# ============================================
# 1. IMPORTS
# ============================================

from flask import Flask, request, jsonify
import re
from urllib.parse import urlparse
import httpx


# ============================================
# 2. FLASK APP INITIALIZATION
# ============================================

app = Flask(__name__)


# ============================================
# 3. CONSTANTS & CONFIGURATION
# ============================================

# Single source of truth for HTTP config (Requirements 1.1, 1.4)
DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

# Default HTTP headers for browser-like requests (Requirements 1.2)
DEFAULT_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
}

# Shared HTTP/2 client for all requests (faster than HTTP/1.1)
# Using connection pooling with 5 minute keepalive for better performance
HTTP_CLIENT = httpx.Client(
    http2=True,
    timeout=10.0,
    follow_redirects=True,
    headers={'User-Agent': DEFAULT_USER_AGENT},
    limits=httpx.Limits(
        max_keepalive_connections=10,
        max_connections=20,
        keepalive_expiry=300,  # 5 minutes
    ),
)

# Default target resolutions for video format selection
DEFAULT_TARGET_HEIGHTS = [1080, 720, 480, 360]

# Codec priority for video format selection (lower = better)
DEFAULT_CODEC_PRIORITY = {'H.264': 0, 'VP9': 1, 'AV1': 2}


def merge_headers(custom_headers: dict = None) -> dict:
    """
    Merge custom headers with DEFAULT_HEADERS.
    Custom headers take precedence over defaults. (Requirements 1.3)
    
    Args:
        custom_headers: Platform-specific header overrides
        
    Returns:
        Merged headers dict with User-Agent included
    """
    headers = {'User-Agent': DEFAULT_USER_AGENT, **DEFAULT_HEADERS}
    if custom_headers:
        headers.update(custom_headers)
    return headers


# ============================================
# 4. PLATFORM CONFIGURATION REGISTRY
# ============================================

# Unified platform configuration - single source of truth for all platform settings
# (Requirements 2.1, 2.2)
# Each platform config contains:
#   - extractor: 'yt-dlp' or 'gallery-dl'
#   - patterns: list of URL regex patterns to match
#   - nsfw: boolean flag for NSFW content
#   - short_url_pattern: regex pattern for short URLs that need resolution (optional)
#   - custom_headers: dict of platform-specific headers to merge with defaults (optional)
PLATFORM_CONFIG = {
    'youtube': {
        'extractor': 'yt-dlp',
        'patterns': [r'youtube\.com', r'youtu\.be', r'youtube-nocookie\.com'],
        'nsfw': False,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'bilibili': {
        'extractor': 'yt-dlp',
        'patterns': [r'bilibili\.com', r'bilibili\.tv', r'b23\.tv'],
        'nsfw': False,
        'short_url_pattern': r'b23\.tv',
        'custom_headers': None,
    },
    'reddit': {
        'extractor': 'gallery-dl',
        'patterns': [r'reddit\.com', r'redd\.it', r'v\.redd\.it'],
        'nsfw': False,
        'short_url_pattern': r'redd\.it',
        'custom_headers': None,
    },
    'soundcloud': {
        'extractor': 'yt-dlp',
        'patterns': [r'soundcloud\.com'],
        'nsfw': False,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'pixiv': {
        'extractor': 'gallery-dl',
        'patterns': [r'pixiv\.net'],
        'nsfw': True,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'eporner': {
        'extractor': 'yt-dlp',
        'patterns': [r'eporner\.com'],
        'nsfw': True,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'rule34video': {
        'extractor': 'yt-dlp',
        'patterns': [r'rule34video\.com'],
        'nsfw': True,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'twitch': {
        'extractor': 'yt-dlp',
        'patterns': [r'twitch\.tv/\w+/clip', r'clips\.twitch\.tv'],
        'nsfw': False,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'bandcamp': {
        'extractor': 'yt-dlp',
        'patterns': [r'bandcamp\.com', r'\w+\.bandcamp\.com'],
        'nsfw': False,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'weibo': {
        'extractor': 'gallery-dl',
        'patterns': [r'weibo\.com', r'weibo\.cn'],
        'nsfw': False,
        'short_url_pattern': None,
        'custom_headers': None,
    },
    'pinterest': {
        'extractor': 'gallery-dl',
        'patterns': [r'pinterest\.com', r'pin\.it'],
        'nsfw': False,
        'short_url_pattern': r'pin\.it',
        'custom_headers': {
            'Sec-Fetch-User': '?1',
            'Pragma': 'no-cache',
        },
    },
}

# Derived lists computed from PLATFORM_CONFIG for backward compatibility
PLATFORMS = {name: config['patterns'] for name, config in PLATFORM_CONFIG.items()}
YTDLP_PLATFORMS = [name for name, config in PLATFORM_CONFIG.items() if config['extractor'] == 'yt-dlp']
GALLERY_DL_PLATFORMS = [name for name, config in PLATFORM_CONFIG.items() if config['extractor'] == 'gallery-dl']
NSFW_PLATFORMS = [name for name, config in PLATFORM_CONFIG.items() if config['nsfw']]


# ============================================
# 5. SECURITY CONFIGURATION & FUNCTIONS
# ============================================

# Max URL length to prevent DoS
MAX_URL_LENGTH = 2048

# Max cookie length
MAX_COOKIE_LENGTH = 8192

# Blocked hosts (SSRF protection)
BLOCKED_HOST_PATTERNS = [
    r'^localhost$',
    r'^127\.',
    r'^10\.',
    r'^172\.(1[6-9]|2[0-9]|3[01])\.',
    r'^192\.168\.',
    r'^169\.254\.',
    r'^0\.',
    r'^\[::1\]',
    r'^\[fc',
    r'^\[fd',
    r'^\[fe80:',
    r'^metadata\.',
    r'\.internal$',
    r'\.local$',
]

# Attack patterns to block
ATTACK_PATTERNS = [
    r'\.\.[\/\\]',           # Path traversal
    r'%2e%2e',               # Encoded path traversal
    r'%00',                  # Null byte
    r'\x00',                 # Null byte
    r'[`]',                  # Backtick (command injection)
    r'\$\{',                 # Template injection
    r'\$\(',                 # Command substitution
    r';\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)',  # Command injection
    r'\|\s*(?:ls|cat|rm|wget|curl|bash|sh|nc|python|perl|ruby|php)', # Pipe injection
    r'>\s*\/',               # Redirect to file
    r'[\r\n]',               # CRLF injection
    r'%0[aAdD]',             # Encoded CRLF
    r'file://',              # File protocol
    r'gopher://',            # Gopher protocol
    r'dict://',              # Dict protocol
    r'ftp://',               # FTP protocol (can be abused)
]


def is_blocked_host(hostname: str) -> bool:
    """Check if hostname is blocked (SSRF protection)"""
    if not hostname:
        return True
    hostname_lower = hostname.lower()
    for pattern in BLOCKED_HOST_PATTERNS:
        if re.search(pattern, hostname_lower, re.IGNORECASE):
            return True
    return False


def has_attack_pattern(input_str: str) -> bool:
    """Check for malicious patterns in input"""
    if not input_str:
        return False
    for pattern in ATTACK_PATTERNS:
        if re.search(pattern, input_str, re.IGNORECASE):
            return True
    return False


def validate_url(url: str) -> tuple[bool, str]:
    """
    Validate URL for security issues.
    Returns (is_valid, error_message)
    """
    if not url:
        return False, 'URL is required'
    
    if len(url) > MAX_URL_LENGTH:
        return False, f'URL too long (max {MAX_URL_LENGTH} chars)'
    
    # Check for attack patterns
    if has_attack_pattern(url):
        return False, 'Malicious pattern detected'
    
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False, 'Invalid URL format'
    
    # Only allow http/https
    if parsed.scheme not in ('http', 'https'):
        return False, 'Only HTTP/HTTPS URLs allowed'
    
    # Check for blocked hosts (SSRF)
    if is_blocked_host(parsed.hostname or ''):
        return False, 'Internal hosts not allowed'
    
    # Check for IP-based URLs (potential SSRF bypass)
    hostname = parsed.hostname or ''
    if re.match(r'^\d+\.\d+\.\d+\.\d+$', hostname):
        # Allow only if it's a known CDN IP range (none for now)
        # For safety, block all direct IP access
        if is_blocked_host(hostname):
            return False, 'Direct IP access not allowed for internal ranges'
    
    return True, ''


def sanitize_cookie(cookie: str) -> str | None:
    """Sanitize cookie input"""
    if not cookie:
        return None
    
    if len(cookie) > MAX_COOKIE_LENGTH:
        return None
    
    # Check for attack patterns
    if has_attack_pattern(cookie):
        return None
    
    # Basic sanitization - remove any control characters
    sanitized = re.sub(r'[\x00-\x1f\x7f]', '', cookie)
    
    return sanitized if sanitized else None


def sanitize_output(value: any) -> any:
    """Sanitize output values to prevent XSS"""
    if isinstance(value, str):
        # Remove any HTML tags and dangerous characters
        sanitized = re.sub(r'<[^>]+>', '', value)
        # Remove control characters except newlines
        sanitized = re.sub(r'[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]', '', sanitized)
        return sanitized
    elif isinstance(value, dict):
        return {k: sanitize_output(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [sanitize_output(v) for v in value]
    return value


# ============================================
# 6. ERROR HANDLING
# ============================================

class ErrorCode:
    """Error codes matching TypeScript implementation"""
    # Platform detection
    UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM'
    INVALID_URL = 'INVALID_URL'
    
    # Network
    FETCH_FAILED = 'FETCH_FAILED'
    TIMEOUT = 'TIMEOUT'
    RATE_LIMITED = 'RATE_LIMITED'
    
    # Content issues
    AGE_RESTRICTED = 'AGE_RESTRICTED'
    PRIVATE_CONTENT = 'PRIVATE_CONTENT'
    DELETED_CONTENT = 'DELETED_CONTENT'
    LOGIN_REQUIRED = 'LOGIN_REQUIRED'
    STORY_EXPIRED = 'STORY_EXPIRED'
    GEO_RESTRICTED = 'GEO_RESTRICTED'
    
    # Extraction
    NO_MEDIA_FOUND = 'NO_MEDIA_FOUND'
    EXTRACTION_FAILED = 'EXTRACTION_FAILED'
    UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT'


# Error message patterns from yt-dlp/gallery-dl
ERROR_PATTERNS = {
    # yt-dlp patterns
    r'(age[_-]?restricted|18\+|mature|adult.only)': ErrorCode.AGE_RESTRICTED,
    r'(private|members.only)': ErrorCode.PRIVATE_CONTENT,
    r'(deleted|removed|taken.down|no.longer)': ErrorCode.DELETED_CONTENT,
    r'(unavailable|not.available)': ErrorCode.DELETED_CONTENT,  # YouTube "Video unavailable"
    r'(login|sign.in|authenticate|session)': ErrorCode.LOGIN_REQUIRED,
    r'(geo[_-]?blocked|country|region|not.available.in.your)': ErrorCode.GEO_RESTRICTED,
    r'(rate.limit|too.many|429|throttl)': ErrorCode.RATE_LIMITED,
    r'(timeout|timed?.out)': ErrorCode.TIMEOUT,
    r'(404|not.found|does.not.exist)': ErrorCode.DELETED_CONTENT,
    r'(403|forbidden|access.denied)': ErrorCode.PRIVATE_CONTENT,
}


def detect_error_code(error_message: str) -> str:
    """Detect specific error code from error message"""
    if not error_message:
        return ErrorCode.EXTRACTION_FAILED
    
    error_lower = error_message.lower()
    
    for pattern, code in ERROR_PATTERNS.items():
        if re.search(pattern, error_lower, re.IGNORECASE):
            return code
    
    return ErrorCode.EXTRACTION_FAILED


def create_error_response(code: str, message: str) -> dict:
    """Create standardized error response"""
    return {
        'success': False,
        'error': {
            'code': code,
            'message': message
        }
    }


# ============================================
# 7. PLATFORM DETECTION & URL RESOLUTION
# ============================================

def get_platform_config(platform_or_url: str) -> dict | None:
    """
    Get platform configuration by platform name or URL.
    
    Args:
        platform_or_url: Either a platform name (e.g., 'youtube') or a URL
        
    Returns:
        Platform config dict or None if not found
        
    Requirements: 2.3
    """
    # First, check if it's a direct platform name
    if platform_or_url in PLATFORM_CONFIG:
        return PLATFORM_CONFIG[platform_or_url]
    
    # Otherwise, try to detect platform from URL
    for platform_name, config in PLATFORM_CONFIG.items():
        if any(re.search(p, platform_or_url, re.IGNORECASE) for p in config['patterns']):
            return config
    
    return None


def detect_platform(url: str) -> str | None:
    """Detect platform from URL"""
    for platform, patterns in PLATFORMS.items():
        if any(re.search(p, url, re.IGNORECASE) for p in patterns):
            return platform
    return None


# Known short URL patterns that need resolution (Requirements 5.1)
SHORT_URL_PATTERNS = {
    'pin.it': r'pin\.it',
    'b23.tv': r'b23\.tv',
    'redd.it': r'redd\.it',
}

# Tracking parameters to remove from resolved URLs
TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'ref', 'ref_src', 'ref_url', 'share_id',
    'sent', 'spm_id_from', 'vd_source', 'from', 'seid',
]


def resolve_short_url(url: str, platform: str = None) -> str:
    """
    Resolve short URLs to full URLs.
    
    Uses shared HTTP/2 client for faster resolution.
    Cleans up tracking params from resolved URLs.
    Falls back to original URL on failure.
    
    Args:
        url: The URL to resolve (may be a short URL)
        platform: Optional platform name for platform-specific handling
        
    Returns:
        Resolved full URL, or original URL if resolution fails
        
    Requirements: 5.1, 5.2, 5.3, 5.4
    """
    from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
    
    # Check if URL matches any known short URL pattern
    is_short_url = False
    for pattern_name, pattern in SHORT_URL_PATTERNS.items():
        if re.search(pattern, url, re.IGNORECASE):
            is_short_url = True
            break
    
    # Also check platform config for short_url_pattern
    if not is_short_url and platform:
        config = get_platform_config(platform)
        if config and config.get('short_url_pattern'):
            if re.search(config['short_url_pattern'], url, re.IGNORECASE):
                is_short_url = True
    
    if not is_short_url:
        return url
    
    try:
        # Use shared HTTP/2 client
        response = HTTP_CLIENT.head(url)
        resolved_url = str(response.url)
        
        # Parse the resolved URL
        parsed = urlparse(resolved_url)
        
        # Clean up tracking parameters
        if parsed.query:
            query_params = parse_qs(parsed.query, keep_blank_values=True)
            # Remove tracking params
            cleaned_params = {
                k: v for k, v in query_params.items()
                if k.lower() not in [p.lower() for p in TRACKING_PARAMS]
            }
            # Rebuild query string (flatten single-value lists)
            cleaned_query = urlencode(
                {k: v[0] if len(v) == 1 else v for k, v in cleaned_params.items()},
                doseq=True
            )
            parsed = parsed._replace(query=cleaned_query)
        
        # Platform-specific path cleanup
        clean_path = parsed.path
        
        # Pinterest: remove /sent/ suffix
        if 'pinterest' in parsed.netloc.lower():
            clean_path = clean_path.rstrip('/').split('/sent')[0]
            if clean_path and not clean_path.endswith('/'):
                clean_path += '/'
        
        # Reddit: ensure proper path format
        if 'reddit' in parsed.netloc.lower() or 'redd.it' in url.lower():
            # redd.it redirects to reddit.com, path should be preserved
            pass
        
        # BiliBili: clean up b23.tv redirects
        if 'bilibili' in parsed.netloc.lower():
            # Remove common tracking params from path
            clean_path = clean_path.split('?')[0]
        
        # Rebuild URL with cleaned path
        resolved_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            clean_path,
            parsed.params,
            parsed.query,
            ''  # Remove fragment
        ))
        
        return resolved_url
        
    except Exception:
        # Fall back to original URL on any failure
        return url


def resolve_media_url(url: str) -> str:
    """
    Resolve wrapper/redirect URLs to real CDN URLs.
    
    Some platforms (Rule34Video, Eporner) return wrapper URLs that redirect
    to the real CDN URL. This function follows the redirect to get the final URL.
    
    Uses shared HTTP/2 client for faster resolution.
    
    Args:
        url: Media URL that may be a wrapper/redirect URL
        
    Returns:
        Resolved CDN URL, or original URL if resolution fails
    """
    from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
    
    # Only resolve known wrapper URL patterns
    wrapper_patterns = [
        r'rule34video\.com/get_file/',
        r'eporner\.com/.*redirect',
    ]
    
    is_wrapper = any(re.search(p, url, re.IGNORECASE) for p in wrapper_patterns)
    if not is_wrapper:
        return url
    
    try:
        # Use shared HTTP/2 client
        response = HTTP_CLIENT.head(url)
        
        # Get final URL after redirects
        final_url = str(response.url)
        
        # Check if we got redirected to rickroll (URL expired)
        if 'youtube.com' in final_url or 'youtu.be' in final_url:
            return url
        
        # Remove download-related params so browser plays instead of downloads
        parsed = urlparse(final_url)
        if parsed.query:
            query_params = parse_qs(parsed.query, keep_blank_values=True)
            # Remove download params
            download_params = ['download', 'download_filename']
            cleaned_params = {
                k: v for k, v in query_params.items()
                if k.lower() not in download_params
            }
            cleaned_query = urlencode(
                {k: v[0] if len(v) == 1 else v for k, v in cleaned_params.items()},
                doseq=True
            )
            final_url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                cleaned_query,
                ''
            ))
        
        return final_url
        
    except Exception:
        return url


def resolve_media_urls_parallel(urls: list) -> list:
    """
    Resolve multiple wrapper URLs in parallel for faster extraction.
    
    Args:
        urls: List of URLs to resolve
        
    Returns:
        List of resolved URLs (same order as input)
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    # Check if any URLs need resolution
    wrapper_patterns = [
        r'rule34video\.com/get_file/',
        r'eporner\.com/.*redirect',
    ]
    
    needs_resolve = []
    for i, url in enumerate(urls):
        if any(re.search(p, url, re.IGNORECASE) for p in wrapper_patterns):
            needs_resolve.append((i, url))
    
    if not needs_resolve:
        return urls
    
    # Resolve in parallel
    results = list(urls)  # Copy
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_idx = {
            executor.submit(resolve_media_url, url): idx 
            for idx, url in needs_resolve
        }
        
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                results[idx] = future.result()
            except Exception:
                pass  # Keep original URL on error
    
    return results


# ============================================
# 8. EXTRACTORS
# ============================================

def extract_with_ytdlp(url: str, cookie: str = None) -> dict:
    """
    Extract media using yt-dlp.
    
    Handles: YouTube, SoundCloud, BiliBili, Twitch, Bandcamp
    
    Args:
        url: Media URL to extract
        cookie: Optional cookie string for authenticated requests
        
    Returns:
        Standardized extraction result dict
    """
    import yt_dlp
    
    # Detect platform for routing to appropriate transformer
    platform = detect_platform(url)
    
    # Resolve short URLs (b23.tv for BiliBili) to full URLs
    url = resolve_short_url(url, platform)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'noplaylist': True,  # Extract single video, not playlist
        # Security: disable dangerous features
        'no_check_certificate': False,
        'geo_bypass': False,
    }
    
    def get_transformer(platform: str):
        """Get the appropriate transformer function for the platform"""
        if platform == 'twitch':
            return transform_twitch_result
        elif platform == 'bandcamp':
            return transform_bandcamp_result
        elif platform == 'eporner':
            return transform_eporner_result
        elif platform == 'rule34video':
            return transform_nsfw_video_result
        else:
            return transform_ytdlp_result
    
    transformer = get_transformer(platform)
    
    if cookie:
        import tempfile
        import os
        # Create temp file securely
        fd, cookie_path = tempfile.mkstemp(suffix='.txt', prefix='ytdlp_cookie_')
        try:
            with os.fdopen(fd, 'w') as f:
                f.write(cookie)
            ydl_opts['cookiefile'] = cookie_path
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return transformer(info, url)
        except yt_dlp.utils.DownloadError as e:
            error_msg = str(e)
            error_code = detect_error_code(error_msg)
            return create_error_response(error_code, error_msg)
        except Exception as e:
            error_code = detect_error_code(str(e))
            return create_error_response(error_code, str(e))
        finally:
            # Always clean up temp file
            try:
                os.unlink(cookie_path)
            except:
                pass
    else:
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return transformer(info, url)
        except yt_dlp.utils.DownloadError as e:
            error_msg = str(e)
            error_code = detect_error_code(error_msg)
            return create_error_response(error_code, error_msg)
        except Exception as e:
            error_code = detect_error_code(str(e))
            return create_error_response(error_code, str(e))


def extract_with_gallery_dl(url: str, cookie: str = None) -> dict:
    """
    Extract media using gallery-dl.
    
    Handles: Reddit, Pixiv, Pinterest, Weibo, Eporner, Rule34Video
    
    Args:
        url: Media URL to extract
        cookie: Optional cookie string for authenticated requests
        
    Returns:
        Standardized extraction result dict
    """
    import gallery_dl
    from gallery_dl import job, config
    
    # Detect platform for routing to appropriate transformer
    platform = detect_platform(url)
    
    # Resolve short URLs (pin.it, redd.it, etc.) to full URLs
    # gallery-dl doesn't extract media from short URL redirects properly
    url = resolve_short_url(url, platform)
    
    config.clear()
    config.set(('extractor',), 'timeout', 30)
    
    # Set proper User-Agent (required to avoid blocks)
    config.set(('extractor',), 'user-agent', DEFAULT_USER_AGENT)
    
    # Pinterest-specific headers - merge with defaults (Requirements 1.3)
    if platform == 'pinterest':
        pinterest_headers = merge_headers({
            'Sec-Fetch-User': '?1',
            'Pragma': 'no-cache',
        })
        config.set(('extractor', 'pinterest'), 'headers', pinterest_headers)
    
    if cookie:
        config.set(('extractor',), 'cookies', cookie)
    
    results = []
    
    class MetadataJob(job.DataJob):
        def handle_url(self, url, kwdict, fallback=None):
            results.append((url, dict(kwdict)))
        
        def handle_directory(self, kwdict):
            pass
    
    def get_transformer(platform: str):
        """Get the appropriate transformer function for the platform"""
        if platform == 'weibo':
            return transform_weibo_result
        elif platform == 'pinterest':
            return transform_pinterest_result
        else:
            return transform_gallery_dl_result
    
    transformer = get_transformer(platform)
    
    try:
        j = MetadataJob(url)
        j.run()
    except gallery_dl.exception.AuthenticationError as e:
        return create_error_response(ErrorCode.LOGIN_REQUIRED, str(e) or 'Authentication required')
    except gallery_dl.exception.AuthorizationError as e:
        return create_error_response(ErrorCode.PRIVATE_CONTENT, str(e) or 'Access denied')
    except gallery_dl.exception.NotFoundError as e:
        return create_error_response(ErrorCode.DELETED_CONTENT, str(e) or 'Content not found')
    except gallery_dl.exception.HttpError as e:
        error_msg = str(e)
        error_code = detect_error_code(error_msg)
        return create_error_response(error_code, error_msg)
    except Exception as e:
        error_msg = str(e)
        error_code = detect_error_code(error_msg)
        return create_error_response(error_code, error_msg or 'Extraction failed')
    
    if not results:
        return create_error_response(ErrorCode.NO_MEDIA_FOUND, 'No media found at URL')
    
    return transformer(results, url)



# ============================================
# 9. FORMAT PROCESSING
# ============================================

def normalize_codec_name(codec: str) -> str:
    """
    Normalize video codec name to standard format.
    
    Args:
        codec: Raw codec string from yt-dlp (e.g., 'avc1.4d401f', 'vp9', 'av01.0.08M.08')
        
    Returns:
        Normalized codec name (e.g., 'H.264', 'VP9', 'AV1')
    """
    if not codec or codec == 'none':
        return ''
    
    codec_lower = codec.lower()
    
    if 'avc' in codec_lower or 'h264' in codec_lower or 'h.264' in codec_lower:
        return 'H.264'
    elif 'vp9' in codec_lower or 'vp09' in codec_lower:
        return 'VP9'
    elif 'av01' in codec_lower or 'av1' in codec_lower:
        return 'AV1'
    elif 'hevc' in codec_lower or 'h265' in codec_lower or 'h.265' in codec_lower:
        return 'HEVC'
    
    # Return first part of codec string (before dot)
    return codec.split('.')[0].upper()


def normalize_audio_codec_name(codec: str) -> str:
    """
    Normalize audio codec name to standard format.
    
    Args:
        codec: Raw audio codec string from yt-dlp (e.g., 'mp4a.40.2', 'opus')
        
    Returns:
        Normalized codec name (e.g., 'AAC', 'Opus')
    """
    if not codec or codec == 'none':
        return ''
    
    codec_lower = codec.lower()
    
    if 'mp4a' in codec_lower or 'aac' in codec_lower:
        return 'AAC'
    elif 'opus' in codec_lower:
        return 'Opus'
    elif 'mp3' in codec_lower or 'mpeg' in codec_lower:
        return 'MP3'
    elif 'vorbis' in codec_lower:
        return 'Vorbis'
    elif 'flac' in codec_lower:
        return 'FLAC'
    
    return codec.split('.')[0].upper()


def process_video_formats(
    formats: list,
    info: dict = None,
    target_heights: list = None,
    codec_priority: dict = None,
    height_tolerance: float = 0.1
) -> tuple[list, list]:
    """
    Process video formats and return (video_sources, audio_sources).
    
    This function provides unified format processing for all video platforms:
    - Deduplicates by resolution (max one per target height)
    - Separates video-only and audio-only formats
    - Marks needsMerge for video-only formats
    - Applies codec priority for selection
    
    Args:
        formats: List of format dicts from yt-dlp
        info: Optional info dict for filename generation
        target_heights: Target resolutions to keep (default: [1080, 720, 480, 360])
        codec_priority: Codec preference dict (lower = better, default: H.264 > VP9 > AV1)
        height_tolerance: Tolerance for matching heights (default: 10%)
        
    Returns:
        Tuple of (video_sources, audio_sources) where:
        - video_sources: List of video source dicts with needsMerge/hasAudio flags
        - audio_sources: List of audio-only source dicts
        
    Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.3
    """
    if target_heights is None:
        target_heights = DEFAULT_TARGET_HEIGHTS
    if codec_priority is None:
        codec_priority = DEFAULT_CODEC_PRIORITY
    if info is None:
        info = {}
    
    video_formats = []
    audio_formats = []
    
    # First pass: categorize formats
    for fmt in formats:
        if not fmt.get('url'):
            continue
        
        vcodec = fmt.get('vcodec', 'none')
        acodec = fmt.get('acodec', 'none')
        
        # Audio-only format
        if vcodec == 'none' and acodec != 'none':
            audio_formats.append(fmt)
        # Video format (with or without audio)
        elif vcodec != 'none':
            video_formats.append(fmt)
    
    # Process video formats
    video_sources = []
    by_height = {}
    
    for fmt in video_formats:
        height = fmt.get('height', 0)
        width = fmt.get('width', 0)
        vcodec = fmt.get('vcodec', 'none')
        acodec = fmt.get('acodec', 'none')
        
        # Normalize codec name
        codec_name = normalize_codec_name(vcodec)
        
        # Build quality string
        quality = fmt.get('format_note') or (f"{height}p" if height else fmt.get('format_id', 'default'))
        
        # Add fps if > 30
        fps = fmt.get('fps')
        if fps and fps > 30:
            quality = f"{quality} {fps}fps"
        
        ext = fmt.get('ext', 'mp4')
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        has_audio = acodec != 'none'
        
        source = {
            'quality': quality,
            'url': fmt.get('url'),
            'resolution': f"{width}x{height}" if width and height else None,
            'mime': f"video/{ext}",
            'extension': ext,
            'filename': generate_filename(info, fmt, 'video') if info else f"video_{quality}.{ext}",
            'hasAudio': has_audio,
            'needsMerge': not has_audio,  # Needs merge if no audio
            'codec': codec_name if codec_name else None,
            '_height': height,
            '_codec_priority': codec_priority.get(codec_name, 99),
            '_has_audio_score': 0 if has_audio else 1,  # Prefer formats with audio
        }
        
        if filesize:
            source['size'] = int(filesize)
        
        # Remove None values
        source = {k: v for k, v in source.items() if v is not None}
        
        # Group by height
        if height not in by_height:
            by_height[height] = []
        by_height[height].append(source)
    
    # Select best format per target resolution
    for target_h in target_heights:
        # Find closest height within tolerance
        best_match_height = None
        for h in by_height.keys():
            if abs(h - target_h) <= target_h * height_tolerance:
                if best_match_height is None or abs(h - target_h) < abs(best_match_height - target_h):
                    best_match_height = h
        
        if best_match_height and by_height[best_match_height]:
            candidates = by_height[best_match_height]
            
            # Sort by: hasAudio (prefer with audio), then codec priority
            candidates.sort(key=lambda x: (
                x.get('_has_audio_score', 1),
                x.get('_codec_priority', 99)
            ))
            
            best = candidates[0]
            
            # Clean up internal fields
            clean_source = {k: v for k, v in best.items() if not k.startswith('_')}
            video_sources.append(clean_source)
            
            # Remove used height to avoid duplicates
            del by_height[best_match_height]
    
    # Process audio formats
    audio_sources = []
    for fmt in audio_formats:
        acodec = fmt.get('acodec', 'none')
        abr = fmt.get('abr', 0)
        ext = fmt.get('ext', 'm4a')
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        
        # Normalize codec name
        codec_name = normalize_audio_codec_name(acodec)
        
        # Build quality string
        quality = fmt.get('format_note') or (f"{int(abr)}kbps" if abr else fmt.get('format_id', 'audio'))
        
        source = {
            'quality': quality,
            'url': fmt.get('url'),
            'mime': f"audio/{ext}",
            'extension': ext,
            'filename': generate_filename(info, fmt, 'audio') if info else f"audio_{quality}.{ext}",
            'codec': codec_name if codec_name else None,
            '_bitrate': abr,
        }
        
        if abr:
            source['bitrate'] = int(abr)
        if filesize:
            source['size'] = int(filesize)
        
        # Remove None values
        source = {k: v for k, v in source.items() if v is not None}
        audio_sources.append(source)
    
    return video_sources, audio_sources


def process_audio_formats(
    audio_sources: list,
    target_bitrate: int = 128
) -> list:
    """
    Process audio formats and return best quality sources.
    
    Picks best AAC and Opus formats, targeting ~128kbps for balance of quality/size.
    
    Args:
        audio_sources: List of audio source dicts (from process_video_formats or direct)
        target_bitrate: Target bitrate in kbps (default: 128)
        
    Returns:
        List of best audio sources (typically 1-2: best AAC and/or best Opus)
        
    Requirements: 3.2
    """
    if not audio_sources:
        return []
    
    # Group by codec
    aac_sources = [s for s in audio_sources if s.get('codec') == 'AAC']
    opus_sources = [s for s in audio_sources if s.get('codec') == 'Opus']
    other_sources = [s for s in audio_sources if s.get('codec') not in ['AAC', 'Opus']]
    
    def pick_best_by_bitrate(sources: list, target: int) -> dict | None:
        """Pick source closest to target bitrate."""
        if not sources:
            return None
        # Sort by distance from target bitrate
        sources_sorted = sorted(
            sources,
            key=lambda x: abs(x.get('_bitrate', x.get('bitrate', 0)) - target)
        )
        return sources_sorted[0]
    
    result = []
    
    # Pick best AAC (closest to target bitrate)
    best_aac = pick_best_by_bitrate(aac_sources, target_bitrate)
    if best_aac:
        # Clean up internal fields
        clean_source = {k: v for k, v in best_aac.items() if not k.startswith('_')}
        result.append(clean_source)
    
    # Pick best Opus (closest to target bitrate)
    best_opus = pick_best_by_bitrate(opus_sources, target_bitrate)
    if best_opus:
        clean_source = {k: v for k, v in best_opus.items() if not k.startswith('_')}
        result.append(clean_source)
    
    # If no AAC or Opus, pick best from other sources
    if not result and other_sources:
        # Sort by bitrate (highest first)
        other_sources.sort(key=lambda x: x.get('_bitrate', x.get('bitrate', 0)), reverse=True)
        clean_source = {k: v for k, v in other_sources[0].items() if not k.startswith('_')}
        result.append(clean_source)
    
    return result


# ============================================
# 9.1 YOUTUBE FORMAT PROCESSING
# ============================================

def is_hls_format(fmt: dict) -> bool:
    """
    Check if format is HLS (should be skipped for YouTube).
    
    HLS formats contain .m3u8 URLs or manifest indicators.
    We skip these because they require complex proxy handling.
    
    Requirements: 3.1
    """
    url = fmt.get('url', '')
    protocol = fmt.get('protocol', '')
    
    # Check URL for HLS indicators
    if '.m3u8' in url or '/manifest/' in url or 'index.m3u8' in url:
        return True
    
    # Check protocol field
    if protocol in ('m3u8', 'm3u8_native', 'hls'):
        return True
    
    return False


def is_progressive_format(fmt: dict) -> bool:
    """
    Check if format is progressive (has both video and audio).
    
    Progressive formats can be played directly without merging.
    
    Requirements: 1.1
    """
    vcodec = fmt.get('vcodec', 'none')
    acodec = fmt.get('acodec', 'none')
    
    return vcodec != 'none' and acodec != 'none'


def process_youtube_formats(
    formats: list,
    info: dict = None,
    max_progressive_height: int = 720,
    target_heights: list = None,
    codec_priority: dict = None,
    include_hls: bool = True,
) -> tuple[list, list, list]:
    """
    Process YouTube formats with progressive format priority.
    
    This function prioritizes progressive formats (video+audio combined) over
    DASH formats (video-only) to avoid complex HLS proxy handling.
    
    Priority order:
    1. Progressive MP4 (video+audio) up to max_progressive_height
    2. DASH video-only (for higher resolutions or when no progressive available)
    
    HLS formats (.m3u8) are collected separately for clients that want them.
    
    Args:
        formats: List of format dicts from yt-dlp
        info: Optional info dict for filename generation
        max_progressive_height: Max height for progressive formats (default: 720)
        target_heights: Target resolutions to keep (default: [1080, 720, 480, 360])
        codec_priority: Codec preference dict (default: H.264 > VP9 > AV1)
        include_hls: Whether to include HLS sources in response (default: True)
        
    Returns:
        Tuple of (video_sources, audio_sources, hls_sources) where:
        - video_sources: List with progressive formats first, then DASH
        - audio_sources: List of audio-only sources for DASH merge
        - hls_sources: List of HLS sources (for clients that want them)
        
    Requirements: 1.1, 1.2, 2.1, 3.1, 5.1, 5.2
    """
    if target_heights is None:
        target_heights = DEFAULT_TARGET_HEIGHTS
    if codec_priority is None:
        codec_priority = DEFAULT_CODEC_PRIORITY
    if info is None:
        info = {}
    
    progressive_formats = []
    dash_video_formats = []
    audio_formats = []
    hls_formats = []
    
    # First pass: categorize formats
    for fmt in formats:
        if not fmt.get('url'):
            continue
        
        # Collect HLS formats separately (for clients that want them)
        if is_hls_format(fmt):
            if include_hls:
                hls_formats.append(fmt)
            continue
        
        vcodec = fmt.get('vcodec', 'none')
        acodec = fmt.get('acodec', 'none')
        
        # Audio-only format
        if vcodec == 'none' and acodec != 'none':
            audio_formats.append(fmt)
        # Progressive format (video + audio)
        elif is_progressive_format(fmt):
            progressive_formats.append(fmt)
        # DASH video-only format
        elif vcodec != 'none':
            dash_video_formats.append(fmt)
    
    video_sources = []
    seen_heights = set()
    
    # Helper to build video source dict
    def build_source(fmt: dict, has_audio: bool) -> dict:
        height = fmt.get('height', 0)
        width = fmt.get('width', 0)
        vcodec = fmt.get('vcodec', 'none')
        codec_name = normalize_codec_name(vcodec)
        
        quality = fmt.get('format_note') or (f"{height}p" if height else fmt.get('format_id', 'default'))
        fps = fmt.get('fps')
        if fps and fps > 30:
            quality = f"{quality} {fps}fps"
        
        ext = fmt.get('ext', 'mp4')
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        
        source = {
            'quality': quality,
            'url': fmt.get('url'),
            'resolution': f"{width}x{height}" if width and height else None,
            'mime': f"video/{ext}",
            'extension': ext,
            'filename': generate_filename(info, fmt, 'video') if info else f"video_{quality}.{ext}",
            'hasAudio': has_audio,
            'needsMerge': not has_audio,
            'codec': codec_name if codec_name else None,
        }
        
        if filesize:
            source['size'] = int(filesize)
        
        # Remove None values
        return {k: v for k, v in source.items() if v is not None}
    
    # Step 1: Add progressive formats (up to max_progressive_height)
    # Sort by height descending, then by codec priority
    progressive_formats.sort(key=lambda x: (
        -x.get('height', 0),
        codec_priority.get(normalize_codec_name(x.get('vcodec', '')), 99)
    ))
    
    for fmt in progressive_formats:
        height = fmt.get('height', 0)
        
        # Skip if above max progressive height
        if height > max_progressive_height:
            continue
        
        # Skip if we already have this height
        if height in seen_heights:
            continue
        
        # Only add if height is in target heights (with tolerance)
        height_match = False
        for target_h in target_heights:
            if abs(height - target_h) <= target_h * 0.1:
                height_match = True
                break
        
        if height_match or height <= max_progressive_height:
            video_sources.append(build_source(fmt, has_audio=True))
            seen_heights.add(height)
    
    # Step 2: Add DASH formats for higher resolutions or missing heights
    dash_video_formats.sort(key=lambda x: (
        -x.get('height', 0),
        codec_priority.get(normalize_codec_name(x.get('vcodec', '')), 99)
    ))
    
    for fmt in dash_video_formats:
        height = fmt.get('height', 0)
        
        # Skip if we already have this height from progressive
        if height in seen_heights:
            continue
        
        # Only add if height is in target heights (with tolerance)
        for target_h in target_heights:
            if abs(height - target_h) <= target_h * 0.1:
                video_sources.append(build_source(fmt, has_audio=False))
                seen_heights.add(height)
                break
    
    # Process audio formats for DASH merge
    audio_sources_raw = []
    for fmt in audio_formats:
        acodec = fmt.get('acodec', 'none')
        abr = fmt.get('abr', 0)
        ext = fmt.get('ext', 'm4a')
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        codec_name = normalize_audio_codec_name(acodec)
        
        quality = fmt.get('format_note') or (f"{int(abr)}kbps" if abr else fmt.get('format_id', 'audio'))
        
        source = {
            'quality': quality,
            'url': fmt.get('url'),
            'mime': f"audio/{ext}",
            'extension': ext,
            'filename': generate_filename(info, fmt, 'audio') if info else f"audio_{quality}.{ext}",
            'codec': codec_name if codec_name else None,
            '_bitrate': abr,
        }
        
        if abr:
            source['bitrate'] = int(abr)
        if filesize:
            source['size'] = int(filesize)
        
        source = {k: v for k, v in source.items() if v is not None}
        audio_sources_raw.append(source)
    
    # Use shared audio processor to pick best sources
    audio_sources = process_audio_formats(audio_sources_raw, target_bitrate=128)
    
    # Step 3: Build HLS sources (for clients that want them)
    # Note: HLS requires proxy due to CORS - cannot be played directly in browser
    hls_sources = []
    if include_hls and hls_formats:
        hls_seen_heights = set()
        
        # Sort HLS by height descending
        hls_formats.sort(key=lambda x: -x.get('height', 0))
        
        for fmt in hls_formats:
            height = fmt.get('height', 0)
            width = fmt.get('width', 0)
            
            # Skip if we already have this height
            if height in hls_seen_heights:
                continue
            
            # Only add if height is in target heights (with tolerance)
            for target_h in target_heights:
                if abs(height - target_h) <= target_h * 0.1:
                    vcodec = fmt.get('vcodec', 'none')
                    acodec = fmt.get('acodec', 'none')
                    codec_name = normalize_codec_name(vcodec)
                    
                    quality = fmt.get('format_note') or (f"{height}p" if height else fmt.get('format_id', 'default'))
                    fps = fmt.get('fps')
                    if fps and fps > 30:
                        quality = f"{quality} {fps}fps"
                    
                    filesize = fmt.get('filesize') or fmt.get('filesize_approx')
                    has_audio = acodec != 'none'
                    
                    hls_source = {
                        'quality': quality,
                        'url': fmt.get('url'),
                        'resolution': f"{width}x{height}" if width and height else None,
                        'mime': 'video/mp4',  # Output will be MP4 after proxy processing
                        'extension': 'mp4',
                        'filename': generate_filename(info, fmt, 'video') if info else f"video_{quality}.mp4",
                        'format': 'hls',
                        'hasAudio': has_audio,
                        'needsMerge': False,  # HLS already has audio
                        'needsProxy': True,   # Cannot play directly due to CORS
                        'codec': codec_name if codec_name else None,
                    }
                    
                    if filesize:
                        hls_source['size'] = int(filesize)
                    
                    # Remove None values
                    hls_source = {k: v for k, v in hls_source.items() if v is not None}
                    hls_sources.append(hls_source)
                    hls_seen_heights.add(height)
                    break
    
    return video_sources, audio_sources, hls_sources


# ============================================
# 10. MIME TYPE MAPPING & FILENAME GENERATION
# ============================================

MIME_TO_EXTENSION = {
    # Audio
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
    'audio/x-m4a': 'm4a',
    # Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/x-flv': 'flv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    # Image
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
}

EXTENSION_TO_MIME = {
    # Audio
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'webm': 'audio/webm',  # Can also be video, context-dependent
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    # Video
    'mp4': 'video/mp4',
    'flv': 'video/x-flv',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    # Image
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
}


def get_extension_from_mime(mime: str) -> str | None:
    """Get file extension from MIME type"""
    if not mime:
        return None
    mime_lower = mime.lower().split(';')[0].strip()
    return MIME_TO_EXTENSION.get(mime_lower)


def get_mime_from_extension(ext: str, media_type: str = 'video') -> str:
    """Get MIME type from extension, with fallback based on media type"""
    if not ext:
        return f"{media_type}/mp4" if media_type == 'video' else f"{media_type}/mp3"
    ext_lower = ext.lower().lstrip('.')
    if ext_lower in EXTENSION_TO_MIME:
        return EXTENSION_TO_MIME[ext_lower]
    return f"{media_type}/{ext_lower}"


def sanitize_filename(name: str, max_length: int = 50) -> str:
    """
    Sanitize a string for use in filenames.
    Removes/replaces special characters and limits length.
    """
    if not name:
        return 'Unknown'
    
    # Remove HTML tags
    name = re.sub(r'<[^>]+>', '', name)
    
    # Replace problematic characters with underscore
    # Keep alphanumeric, spaces, hyphens, and common unicode letters
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name)
    
    # Replace multiple spaces/underscores with single underscore
    name = re.sub(r'[\s_]+', '_', name)
    
    # Remove leading/trailing underscores and spaces
    name = name.strip('_ ')
    
    # Truncate to max length
    if len(name) > max_length:
        name = name[:max_length].rstrip('_')
    
    return name if name else 'Unknown'


def generate_filename(info: dict, fmt: dict, media_type: str = 'video') -> str:
    """
    Generate a filename for a media source.
    Format: Author_Title_Quality.ext
    """
    # Get author
    author = (
        info.get('uploader') or 
        info.get('artist') or 
        info.get('channel') or 
        info.get('author') or
        info.get('user') or
        'Unknown'
    )
    author = sanitize_filename(author, max_length=30)
    
    # Get title
    title = info.get('title') or info.get('description', '')[:50] or 'download'
    title = sanitize_filename(title, max_length=40)
    
    # Get quality
    quality = (
        fmt.get('format_note') or 
        fmt.get('format_id') or 
        fmt.get('quality') or
        'default'
    )
    quality = sanitize_filename(str(quality), max_length=20)
    
    # Get extension
    ext = fmt.get('ext') or fmt.get('extension') or ('mp3' if media_type == 'audio' else 'mp4')
    ext = ext.lower().lstrip('.')
    
    return f"{author}_{title}_{quality}.{ext}"


# ============================================
# 11. TRANSFORMERS
# ============================================

def transform_ytdlp_result(info: dict, original_url: str = None) -> dict:
    """
    Transform yt-dlp info_dict to standard Fetchtium format.
    
    Uses shared process_video_formats() and process_audio_formats() for unified
    format processing across all video platforms.
    
    Requirements: 3.5, 6.2
    """
    items = []
    
    platform = detect_platform(original_url) if original_url else 'unknown'
    is_audio_platform = platform == 'soundcloud'
    is_bilibili = platform == 'bilibili'
    
    formats = info.get('formats', [])
    if not formats and info.get('url'):
        formats = [info]
    
    # Audio-only platforms (SoundCloud) - handle separately
    if is_audio_platform:
        audio_sources = []
        for fmt in formats:
            if not fmt.get('url'):
                continue
            
            acodec = fmt.get('acodec', 'none')
            if acodec == 'none':
                continue
            
            quality = fmt.get('format_note') or fmt.get('format_id') or 'default'
            abr = fmt.get('abr', 0)
            ext = fmt.get('ext', 'mp3')
            mime = get_mime_from_extension(ext, 'audio')
            filesize = fmt.get('filesize') or fmt.get('filesize_approx')
            
            source = {
                'quality': f"{quality} ({abr}kbps)" if abr else quality,
                'url': fmt.get('url'),
                'mime': mime,
                'extension': ext,
                'filename': generate_filename(info, fmt, 'audio'),
            }
            
            if abr:
                source['bitrate'] = int(abr)
            if filesize:
                source['size'] = int(filesize)
            
            audio_sources.append(source)
        
        # Sort by bitrate (highest first)
        audio_sources.sort(key=lambda x: x.get('bitrate', 0), reverse=True)
        
        # Create default source if no formats found
        if not audio_sources:
            audio_sources = [{
                'quality': 'default',
                'url': info.get('url'),
                'mime': 'audio/mpeg',
                'extension': 'mp3',
                'filename': generate_filename(info, {'ext': 'mp3'}, 'audio'),
            }]
        
        items.append({
            'index': 0,
            'type': 'audio',
            'thumbnail': info.get('thumbnail'),
            'sources': audio_sources,
        })
        
        result = {
            'success': True,
            'platform': platform,
            'contentType': 'audio',
            'title': info.get('title'),
            'author': info.get('uploader') or info.get('artist') or info.get('channel'),
            'authorUrl': info.get('uploader_url') or info.get('channel_url'),
            'id': str(info.get('id', '')),
            'description': info.get('description'),
            'uploadDate': info.get('upload_date'),
            'duration': info.get('duration'),
            'items': items,
        }
        
        return sanitize_output(result)
    
    # Video platforms - use appropriate format processor
    is_youtube = platform == 'youtube'
    hls_sources = []  # HLS sources for YouTube (optional for clients)
    
    # YouTube: Use YouTube-specific processor (progressive priority, skip HLS)
    if is_youtube:
        video_sources, audio_sources, hls_sources = process_youtube_formats(
            formats,
            info=info,
            max_progressive_height=720,  # Prefer progressive up to 720p
            target_heights=DEFAULT_TARGET_HEIGHTS,
            codec_priority=DEFAULT_CODEC_PRIORITY,
            include_hls=True,  # Include HLS for clients that want them
        )
    # BiliBili: Use shared processor with custom heights for vertical videos
    elif is_bilibili:
        # BiliBili often has vertical videos with non-standard heights
        # Use wider tolerance and include more heights
        target_heights = [1080, 1024, 720, 852, 480, 640, 360, 426, 240, 256, 144]
        height_tolerance = 0.15  # 15% tolerance for BiliBili
        
        video_sources, audio_sources_raw = process_video_formats(
            formats,
            info=info,
            target_heights=target_heights,
            codec_priority=DEFAULT_CODEC_PRIORITY,
            height_tolerance=height_tolerance
        )
        audio_sources = process_audio_formats(audio_sources_raw, target_bitrate=128)
    # Other platforms: Use shared processor with defaults
    else:
        target_heights = DEFAULT_TARGET_HEIGHTS
        height_tolerance = 0.1
        
        video_sources, audio_sources_raw = process_video_formats(
            formats,
            info=info,
            target_heights=target_heights,
            codec_priority=DEFAULT_CODEC_PRIORITY,
            height_tolerance=height_tolerance
        )
        audio_sources = process_audio_formats(audio_sources_raw, target_bitrate=128)
    
    # BiliBili: map heights to standard quality labels
    if is_bilibili:
        HEIGHT_TO_QUALITY = {
            1080: '1080P',
            1024: '720P',   # 576x1024 vertical = 720P equivalent
            720: '720P',
            852: '480P',    # 480x852 vertical = 480P equivalent
            480: '480P',
            640: '360P',    # 360x640 vertical = 360P equivalent
            360: '360P',
            426: '240P',    # 240x426 vertical = 240P equivalent
            240: '240P',
            256: '144P',    # 144x256 vertical = 144P equivalent
            144: '144P',
        }
        
        # Update quality labels for BiliBili
        for source in video_sources:
            if source.get('resolution'):
                try:
                    height = int(source['resolution'].split('x')[1])
                    if height in HEIGHT_TO_QUALITY:
                        source['quality'] = HEIGHT_TO_QUALITY[height]
                except (ValueError, IndexError):
                    pass
    
    # Create default source if no formats found
    if not video_sources:
        video_sources = [{
            'quality': 'default',
            'url': info.get('url'),
            'mime': 'video/mp4',
            'extension': 'mp4',
            'filename': generate_filename(info, {'ext': 'mp4'}, 'video'),
            'hasAudio': True,
            'needsMerge': False,
        }]
    
    items.append({
        'index': 0,
        'type': 'video',
        'thumbnail': info.get('thumbnail'),
        'sources': video_sources,
    })
    
    # Add HLS sources as separate item for YouTube (for clients that want them)
    if is_youtube and hls_sources:
        items.append({
            'index': 1,
            'type': 'video',
            'format': 'hls',
            'thumbnail': info.get('thumbnail'),
            'sources': hls_sources,
        })
        # Adjust audio index if HLS is present
        audio_index = 2
    else:
        audio_index = 1
    
    # Add audio-only formats as separate item if available
    if audio_sources:
        items.append({
            'index': audio_index,
            'type': 'audio',
            'thumbnail': info.get('thumbnail'),
            'sources': audio_sources,
        })
    
    result = {
        'success': True,
        'platform': platform,
        'contentType': 'video',
        'title': info.get('title'),
        'author': info.get('uploader') or info.get('artist') or info.get('channel'),
        'authorUrl': info.get('uploader_url') or info.get('channel_url'),
        'id': str(info.get('id', '')),
        'description': info.get('description'),
        'uploadDate': info.get('upload_date'),
        'duration': info.get('duration'),
        'items': items,
    }
    
    return sanitize_output(result)


def transform_twitch_result(info: dict, original_url: str = None) -> dict:
    """
    Transform yt-dlp Twitch clip info to standard Fetchtium format.
    
    Uses shared process_video_formats() for unified format processing.
    
    Extracts:
    - title, creator, thumbnail from yt-dlp info
    - Video formats (360p-1080p)
    - Generates proper filenames
    
    Requirements: 2.1, 2.2, 3.5
    """
    items = []
    
    formats = info.get('formats', [])
    if not formats and info.get('url'):
        formats = [info]
    
    # Use shared format processor with 15% tolerance for Twitch (Requirements 3.5)
    video_sources, audio_sources = process_video_formats(
        formats,
        info=info,
        target_heights=DEFAULT_TARGET_HEIGHTS,
        codec_priority=DEFAULT_CODEC_PRIORITY,
        height_tolerance=0.15  # 15% tolerance for Twitch
    )
    
    # Fallback if no formats matched targets
    if not video_sources:
        video_sources = [{
            'quality': 'default',
            'url': info.get('url'),
            'mime': 'video/mp4',
            'extension': 'mp4',
            'filename': generate_filename(info, {'ext': 'mp4'}, 'video'),
            'hasAudio': True,
            'needsMerge': False,
        }]
    
    items.append({
        'index': 0,
        'type': 'video',
        'thumbnail': info.get('thumbnail'),
        'sources': video_sources,
    })
    
    # Add audio sources if available (Twitch clips usually have audio in video)
    if audio_sources:
        processed_audio = process_audio_formats(audio_sources, target_bitrate=128)
        if processed_audio:
            items.append({
                'index': 1,
                'type': 'audio',
                'thumbnail': info.get('thumbnail'),
                'sources': processed_audio,
            })
    
    # Build result
    # Twitch uses 'creator' for clip creator, 'uploader' for channel
    author = info.get('creator') or info.get('uploader') or info.get('channel')
    author_url = info.get('uploader_url') or info.get('channel_url')
    
    result = {
        'success': True,
        'platform': 'twitch',
        'contentType': 'video',
        'title': info.get('title'),
        'author': author,
        'authorUrl': author_url,
        'id': str(info.get('id', '')),
        'description': info.get('description'),
        'duration': info.get('duration'),
        'items': items,
    }
    
    return sanitize_output(result)


def transform_bandcamp_result(info: dict, original_url: str = None) -> dict:
    """
    Transform yt-dlp Bandcamp track/album info to standard Fetchtium format.
    
    Uses shared process_audio_formats() for unified audio format processing.
    
    Extracts:
    - title, artist, album from yt-dlp info
    - Audio formats (mp3-128)
    - Handles both track and album URLs
    
    Requirements: 3.1, 3.2, 3.3, 3.5
    """
    items = []
    
    # Check if this is an album (has 'entries' key) or single track
    entries = info.get('entries', [])
    is_album = bool(entries)
    
    if is_album:
        # Album: process each track
        album_title = info.get('title') or info.get('album')
        album_artist = info.get('uploader') or info.get('artist')
        album_thumbnail = info.get('thumbnail')
        
        for idx, track in enumerate(entries):
            if not track:
                continue
            
            track_sources = _extract_bandcamp_audio_sources(track)
            
            # Use album thumbnail if track doesn't have one
            thumbnail = track.get('thumbnail') or album_thumbnail
            
            items.append({
                'index': idx,
                'type': 'audio',
                'thumbnail': thumbnail,
                'title': track.get('title'),
                'duration': track.get('duration'),
                'sources': track_sources,
            })
        
        # Build album result
        result = {
            'success': True,
            'platform': 'bandcamp',
            'contentType': 'audio',
            'title': album_title,
            'author': album_artist,
            'authorUrl': info.get('uploader_url') or info.get('channel_url'),
            'id': str(info.get('id', '')),
            'description': info.get('description'),
            'album': album_title,
            'trackCount': len(items),
            'items': items,
        }
    else:
        # Single track
        sources = _extract_bandcamp_audio_sources(info)
        
        items.append({
            'index': 0,
            'type': 'audio',
            'thumbnail': info.get('thumbnail'),
            'sources': sources,
        })
        
        # Build track result
        result = {
            'success': True,
            'platform': 'bandcamp',
            'contentType': 'audio',
            'title': info.get('title') or info.get('track'),
            'author': info.get('artist') or info.get('uploader') or info.get('creator'),
            'authorUrl': info.get('uploader_url') or info.get('channel_url'),
            'id': str(info.get('id', '')),
            'description': info.get('description'),
            'album': info.get('album'),
            'duration': info.get('duration'),
            'items': items,
        }
    
    return sanitize_output(result)


def _extract_bandcamp_audio_sources(track_info: dict) -> list:
    """
    Extract audio sources from a Bandcamp track info dict.
    
    Uses shared process_audio_formats() for unified processing.
    Bandcamp typically provides mp3-128 format.
    
    Requirements: 3.5
    """
    formats = track_info.get('formats', [])
    if not formats and track_info.get('url'):
        # Single format in the info dict itself
        formats = [track_info]
    
    # Build raw audio sources for processing
    raw_sources = []
    for fmt in formats:
        if not fmt.get('url'):
            continue
        
        acodec = fmt.get('acodec', 'none')
        vcodec = fmt.get('vcodec', 'none')
        
        # Skip video formats (Bandcamp is audio-only)
        if vcodec != 'none' and acodec == 'none':
            continue
        
        # Get format details
        abr = fmt.get('abr', 0)
        ext = fmt.get('ext', 'mp3')
        mime = get_mime_from_extension(ext, 'audio')
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        
        # Build quality string
        format_note = fmt.get('format_note', '')
        format_id = fmt.get('format_id', '')
        
        if format_note:
            quality = format_note
        elif abr:
            quality = f"mp3-{int(abr)}"
        elif 'mp3' in format_id.lower():
            quality = 'mp3-128'  # Bandcamp default
        else:
            quality = format_id or 'default'
        
        # Normalize codec name for process_audio_formats
        codec_name = normalize_audio_codec_name(acodec) if acodec != 'none' else 'MP3'
        
        source = {
            'quality': quality,
            'url': fmt.get('url'),
            'mime': mime,
            'extension': ext,
            'filename': generate_filename(track_info, fmt, 'audio'),
            'codec': codec_name,
            '_bitrate': abr,  # Internal field for process_audio_formats
        }
        
        if abr:
            source['bitrate'] = int(abr)
        if filesize:
            source['size'] = int(filesize)
        
        raw_sources.append(source)
    
    # Use shared audio format processor (Requirements 3.5)
    # Bandcamp typically has only one format, so target_bitrate doesn't matter much
    processed_sources = process_audio_formats(raw_sources, target_bitrate=128)
    
    # If no sources found, create a default one
    if not processed_sources and track_info.get('url'):
        processed_sources = [{
            'quality': 'mp3-128',
            'url': track_info.get('url'),
            'mime': 'audio/mpeg',
            'extension': 'mp3',
            'filename': generate_filename(track_info, {'ext': 'mp3'}, 'audio'),
        }]
    
    return processed_sources


def transform_eporner_result(info: dict, original_url: str = None) -> dict:
    """
    Transform yt-dlp Eporner video info to standard Fetchtium format.
    
    Returns all available video formats with sizes.
    
    Extracts:
    - title, description, thumbnail from yt-dlp info
    - Multiple video formats (240p, 360p, 480p, 720p, 1080p)
    - File sizes when available
    """
    items = []
    
    formats = info.get('formats', [])
    if not formats and info.get('url'):
        formats = [info]
    
    # Collect all URLs first for parallel resolution
    url_list = [fmt.get('url') for fmt in formats if fmt.get('url')]
    resolved_urls = resolve_media_urls_parallel(url_list)
    url_map = dict(zip(url_list, resolved_urls))
    
    video_sources = []
    
    for fmt in formats:
        if not fmt.get('url'):
            continue
        
        height = fmt.get('height', 0)
        width = fmt.get('width', 0)
        fps = fmt.get('fps')
        ext = fmt.get('ext', 'mp4')
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        
        # Build quality string
        # Check 'quality' field first (used by Rule34Video), then format_note, then format_id
        raw_quality = fmt.get('quality') or fmt.get('format_note') or fmt.get('format_id')
        
        # Clean up quality string (remove _HD suffix, etc)
        if raw_quality:
            quality = str(raw_quality).replace('_HD', '').replace('@60fps', '')
            # If quality is just a number (e.g., "360", "720"), add "p" suffix
            if quality.isdigit():
                quality = f"{quality}p"
        else:
            quality = f"{height}p" if height else 'default'
        
        # Override with height-based quality if height is available
        if height:
            quality = f"{height}p"
            if fps and fps > 30:
                quality = f"{height}p {int(fps)}fps"
        
        # Use resolved URL from parallel resolution
        original_url_fmt = fmt.get('url')
        resolved_url = url_map.get(original_url_fmt, original_url_fmt)
        
        source = {
            'quality': quality,
            'url': resolved_url,
            'resolution': f"{width}x{height}" if width and height else None,
            'mime': f"video/{ext}",
            'extension': ext,
            'filename': generate_filename(info, fmt, 'video'),
            'hasAudio': True,  # Eporner formats include audio
            'needsMerge': False,
        }
        
        if filesize:
            source['size'] = int(filesize)
        
        if fps:
            source['fps'] = int(fps)
        
        # Remove None values
        source = {k: v for k, v in source.items() if v is not None}
        
        video_sources.append(source)
    
    # Sort by height (highest first), then by fps
    def get_sort_key(source):
        # Extract height from resolution or quality string
        resolution = source.get('resolution', '')
        quality = source.get('quality', '')
        
        height = 0
        if resolution and 'x' in resolution:
            try:
                height = int(resolution.split('x')[1])
            except:
                pass
        elif quality:
            # Try to extract from quality string like "1080p" or "720p 60fps"
            match = re.search(r'(\d+)p', quality)
            if match:
                height = int(match.group(1))
        
        fps = source.get('fps', 0)
        return (height, fps)
    
    video_sources.sort(key=get_sort_key, reverse=True)
    
    # Fallback if no formats found
    if not video_sources and info.get('url'):
        video_sources = [{
            'quality': 'default',
            'url': info.get('url'),
            'mime': 'video/mp4',
            'extension': 'mp4',
            'filename': generate_filename(info, {'ext': 'mp4'}, 'video'),
            'hasAudio': True,
            'needsMerge': False,
        }]
    
    items.append({
        'index': 0,
        'type': 'video',
        'thumbnail': info.get('thumbnail'),
        'sources': video_sources,
    })
    
    result = {
        'success': True,
        'platform': 'eporner',
        'contentType': 'video',
        'title': info.get('title'),
        'author': info.get('uploader'),
        'authorUrl': info.get('uploader_url'),
        'id': str(info.get('id', '')),
        'description': info.get('description'),
        'uploadDate': info.get('upload_date'),
        'duration': info.get('duration'),
        'items': items,
        'isNsfw': True,
    }
    
    # Add stats if available
    stats = {}
    if info.get('view_count'):
        stats['views'] = info.get('view_count')
    if info.get('average_rating'):
        stats['rating'] = info.get('average_rating')
    if stats:
        result['stats'] = stats
    
    return sanitize_output(result)


def transform_nsfw_video_result(info: dict, original_url: str = None) -> dict:
    """
    Generic transformer for NSFW video platforms (Rule34Video, etc).
    
    Similar to eporner but with platform detection.
    """
    platform = detect_platform(original_url) or 'unknown'
    
    # Reuse eporner transformer logic
    result = transform_eporner_result(info, original_url)
    result['platform'] = platform
    
    return result


def _get_valid_thumbnail(metadata: dict, media_url: str = None) -> str | None:
    """
    Get a valid thumbnail URL from metadata.
    
    Handles cases where thumbnail is a placeholder string like "nsfw", "default", etc.
    Falls back to the media URL itself for images.
    
    Args:
        metadata: gallery-dl metadata dict
        media_url: Original media URL (used as fallback for images)
        
    Returns:
        Valid thumbnail URL or None
    """
    thumbnail = metadata.get('thumbnail') or metadata.get('preview')
    
    # Check if thumbnail is a valid URL
    if thumbnail and isinstance(thumbnail, str):
        # Skip placeholder strings that aren't URLs
        if thumbnail.startswith('http://') or thumbnail.startswith('https://'):
            return thumbnail
        # Common placeholder values to skip
        if thumbnail.lower() in ('nsfw', 'default', 'self', 'spoiler', 'image', ''):
            thumbnail = None
    
    # For images, use the media URL itself as thumbnail
    if not thumbnail and media_url:
        ext = media_url.rsplit('.', 1)[-1].lower() if '.' in media_url else ''
        if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
            thumbnail = media_url
    
    return thumbnail


def transform_gallery_dl_result(results: list, original_url: str) -> dict:
    """
    Transform gallery-dl results to standard Fetchtium format.
    
    Generic transformer for gallery-dl platforms without specific handling.
    """
    items = []
    
    # Get metadata from first result for filename generation
    meta = results[0][1] if results else {}
    
    for i, (media_url, metadata) in enumerate(results):
        ext = metadata.get('extension', '').lower()
        is_video = ext in ['mp4', 'webm', 'mov', 'avi', 'mkv'] or 'video' in media_url.lower()
        media_type = 'video' if is_video else 'image'
        
        # Determine extension from metadata or URL
        if not ext:
            # Try to extract from URL
            from urllib.parse import urlparse
            path = urlparse(media_url).path
            if '.' in path:
                ext = path.rsplit('.', 1)[-1].lower()
        
        # Fallback extensions
        if not ext:
            ext = 'mp4' if is_video else 'jpg'
        
        # Get proper MIME type
        mime = get_mime_from_extension(ext, media_type)
        
        # Generate filename
        fmt_info = {
            'ext': ext,
            'extension': ext,
            'quality': 'original',
            'format_note': 'original',
        }
        filename = generate_filename(meta, fmt_info, media_type)
        
        # Add index suffix for galleries with multiple items
        if len(results) > 1:
            base, file_ext = filename.rsplit('.', 1) if '.' in filename else (filename, ext)
            filename = f"{base}_{i+1}.{file_ext}"
        
        source = {
            'quality': 'original',
            'url': media_url,
            'mime': mime,
            'extension': ext,
            'filename': filename,
        }
        
        # Add filesize if available
        filesize = metadata.get('filesize') or metadata.get('size')
        if filesize:
            source['size'] = int(filesize)
        
        items.append({
            'index': i,
            'type': media_type,
            'thumbnail': _get_valid_thumbnail(metadata, media_url),
            'sources': [source],
        })
    
    has_video = any(item['type'] == 'video' for item in items)
    has_multiple = len(items) > 1
    
    if has_video:
        content_type = 'video'
    elif has_multiple:
        content_type = 'gallery'
    else:
        content_type = 'image'
    
    platform = detect_platform(original_url) or 'unknown'
    
    result = {
        'success': True,
        'platform': platform,
        'contentType': content_type,
        'title': meta.get('title') or meta.get('description', '')[:100],
        'author': meta.get('uploader') or meta.get('author') or meta.get('user'),
        'authorUrl': meta.get('uploader_url') or meta.get('author_url'),
        'id': str(meta.get('id', '')),
        'description': meta.get('description'),
        'items': items,
    }
    
    return sanitize_output(result)


def transform_pinterest_result(results: list, original_url: str = None) -> dict:
    """
    Transform gallery-dl Pinterest results to standard Fetchtium format.
    
    Extracts:
    - Description, board name, pinner from gallery-dl metadata
    - Maps to original resolution image or video
    - Handles pin.it short URL resolution (gallery-dl handles this automatically)
    - Supports video pins with MP4 and HLS formats
    
    Requirements: 5.1, 5.2, 5.3
    """
    items = []
    
    # Get metadata from first result for common fields
    meta = results[0][1] if results else {}
    
    # Extract pinner info from metadata
    # gallery-dl Pinterest metadata structure:
    # - pinner: dict with username, full_name, id, etc.
    # - board: dict with name, url, etc.
    # - description: pin description text
    pinner_info = meta.get('pinner', {})
    board_info = meta.get('board', {})
    
    # Get author name - try multiple fields
    author = (
        pinner_info.get('username') or
        pinner_info.get('full_name') or
        meta.get('pinner_username') or
        meta.get('username') or
        meta.get('author') or
        meta.get('uploader')
    )
    
    # Get board name
    board_name = (
        board_info.get('name') or
        meta.get('board_name') or
        meta.get('board')
    )
    
    # Get pin description - try multiple fields
    description = (
        meta.get('description') or
        meta.get('title') or
        meta.get('pin_description') or
        ''
    )
    
    # Check if this is a video pin
    videos_data = meta.get('videos')
    is_video_pin = videos_data and videos_data.get('video_list')
    
    if is_video_pin:
        # Handle video pin
        video_list = videos_data.get('video_list', {})
        sources = []
        thumbnail = None
        
        # Prefer MP4 over HLS for direct playback
        # V_720P is direct MP4, V_HLSV4 has fallback MP4
        if 'V_720P' in video_list:
            v = video_list['V_720P']
            thumbnail = v.get('thumbnail')
            sources.append({
                'quality': 'hd',
                'url': v.get('url'),
                'mime': 'video/mp4',
                'extension': 'mp4',
                'resolution': f"{v.get('width', '')}x{v.get('height', '')}",
            })
        
        # Add HLS as alternative (with needsProxy for CORS)
        if 'V_HLSV4' in video_list:
            v = video_list['V_HLSV4']
            if not thumbnail:
                thumbnail = v.get('thumbnail')
            # Check for MP4 fallback first
            fallback = v.get('_fallback', [])
            if fallback:
                sources.append({
                    'quality': 'sd',
                    'url': fallback[0],
                    'mime': 'video/mp4',
                    'extension': 'mp4',
                    'resolution': f"{v.get('width', '')}x{v.get('height', '')}",
                })
        
        # If no MP4 sources found, use HLS
        if not sources and 'V_HLSV4' in video_list:
            v = video_list['V_HLSV4']
            sources.append({
                'quality': 'hd',
                'url': v.get('url'),
                'mime': 'application/x-mpegURL',
                'extension': 'm3u8',
                'resolution': f"{v.get('width', '')}x{v.get('height', '')}",
                'needsProxy': True,
            })
        
        if sources:
            items.append({
                'index': 0,
                'type': 'video',
                'thumbnail': thumbnail,
                'sources': sources,
            })
            content_type = 'video'
        else:
            content_type = 'image'
    else:
        content_type = 'image'
    
    # Process images if no video or as fallback
    if not items:
        for i, (media_url, metadata) in enumerate(results):
            # Get extension from metadata or URL
            ext = metadata.get('extension', '').lower()
            if not ext:
                from urllib.parse import urlparse
                path = urlparse(media_url).path
                if '.' in path:
                    ext = path.rsplit('.', 1)[-1].lower()
            
            # Default to jpg for images
            if not ext or ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                ext = 'jpg'
            
            # Get MIME type
            mime = get_mime_from_extension(ext, 'image')
            
            # Generate filename
            # Format: Author_Description_Index.ext
            author_safe = sanitize_filename(author or 'Pinterest', max_length=20)
            desc_safe = sanitize_filename(description[:30] if description else 'pin', max_length=30)
            
            if len(results) > 1:
                filename = f"{author_safe}_{desc_safe}_{i+1}.{ext}"
            else:
                filename = f"{author_safe}_{desc_safe}.{ext}"
            
            source = {
                'quality': 'original',
                'url': media_url,
                'mime': mime,
                'extension': ext,
                'filename': filename,
            }
            
            # Add filesize if available
            filesize = metadata.get('filesize') or metadata.get('size')
            if filesize:
                source['size'] = int(filesize)
            
            # Extract thumbnail from Pinterest metadata
            # Pinterest provides: image_medium_url or images dict with various sizes
            thumbnail = None
            if metadata.get('image_medium_url'):
                thumbnail = metadata.get('image_medium_url')
            elif metadata.get('images'):
                images = metadata.get('images', {})
                # Prefer 236x size for thumbnail (good balance of quality/size)
                if '236x' in images:
                    thumbnail = images['236x'].get('url')
                elif '170x' in images:
                    thumbnail = images['170x'].get('url')
                elif '136x136' in images:
                    thumbnail = images['136x136'].get('url')
            
            items.append({
                'index': i,
                'type': 'image',
                'thumbnail': thumbnail,
                'sources': [source],
            })
        
        # Determine content type based on number of items
        content_type = 'gallery' if len(items) > 1 else 'image'
    
    # Get pin ID
    pin_id = (
        meta.get('id') or
        meta.get('pin_id') or
        ''
    )
    
    # Get author URL
    pinner_username = pinner_info.get('username') or meta.get('pinner_username')
    author_url = f"https://pinterest.com/{pinner_username}" if pinner_username else None
    
    # Build title - use description or board name
    title = description[:100] if description else (f"Pin from {board_name}" if board_name else None)
    
    result = {
        'success': True,
        'platform': 'pinterest',
        'contentType': content_type,
        'title': title,
        'author': author,
        'authorUrl': author_url,
        'id': str(pin_id),
        'description': description,
        'board': board_name,
        'imageCount': len(items),
        'items': items,
    }
    
    return sanitize_output(result)


def transform_weibo_result(results: list, original_url: str = None) -> dict:
    """
    Transform gallery-dl Weibo results to standard Fetchtium format.
    
    Extracts:
    - Post text, user info from gallery-dl metadata
    - Maps all images to highest resolution
    - Handles multiple images per post
    
    Requirements: 4.1, 4.2
    """
    items = []
    
    # Get metadata from first result for common fields
    meta = results[0][1] if results else {}
    
    # Extract user info from metadata
    # gallery-dl Weibo metadata structure:
    # - status.user: dict with screen_name, id, etc.
    # - status: dict with text_raw, created_at, etc.
    status_info = meta.get('status', {})
    user_info = status_info.get('user', {}) or meta.get('user', {})
    
    # Get author name - try multiple fields
    author = (
        user_info.get('screen_name') or
        user_info.get('name') or
        meta.get('user_name') or
        meta.get('screen_name') or
        meta.get('author') or
        meta.get('uploader')
    )
    
    # Get post text - try multiple fields
    post_text = (
        status_info.get('text_raw') or
        status_info.get('text') or
        meta.get('text_raw') or
        meta.get('text') or
        meta.get('description') or
        meta.get('title') or
        ''
    )
    
    # Get pic_infos for thumbnails (Weibo stores thumbnail URLs here)
    pic_infos = status_info.get('pic_infos', {})
    pic_ids = status_info.get('pic_ids', [])
    
    # Process each image
    for i, (media_url, metadata) in enumerate(results):
        # Get extension from metadata or URL
        ext = metadata.get('extension', '').lower()
        if not ext:
            from urllib.parse import urlparse
            path = urlparse(media_url).path
            if '.' in path:
                ext = path.rsplit('.', 1)[-1].lower()
        
        # Default to jpg for images
        if not ext or ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            ext = 'jpg'
        
        # Get MIME type
        mime = get_mime_from_extension(ext, 'image')
        
        # Generate filename
        # Format: Author_PostText_Index.ext
        author_safe = sanitize_filename(author or 'Weibo', max_length=20)
        text_safe = sanitize_filename(post_text[:30] if post_text else 'post', max_length=30)
        
        if len(results) > 1:
            filename = f"{author_safe}_{text_safe}_{i+1}.{ext}"
        else:
            filename = f"{author_safe}_{text_safe}.{ext}"
        
        source = {
            'quality': 'original',
            'url': media_url,
            'mime': mime,
            'extension': ext,
            'filename': filename,
        }
        
        # Add filesize if available
        filesize = metadata.get('filesize') or metadata.get('size')
        if filesize:
            source['size'] = int(filesize)
        
        # Extract thumbnail from Weibo pic_infos
        # Weibo stores thumbnails in status.pic_infos[pic_id].thumbnail or .bmiddle
        thumbnail = None
        if i < len(pic_ids) and pic_ids[i] in pic_infos:
            pic_info = pic_infos[pic_ids[i]]
            # Prefer bmiddle (360px) for better quality, fallback to thumbnail (180px)
            if pic_info.get('bmiddle', {}).get('url'):
                thumbnail = pic_info['bmiddle']['url']
            elif pic_info.get('thumbnail', {}).get('url'):
                thumbnail = pic_info['thumbnail']['url']
        
        items.append({
            'index': i,
            'type': 'image',
            'thumbnail': thumbnail,
            'sources': [source],
        })
    
    # Determine content type based on number of items
    content_type = 'gallery' if len(items) > 1 else 'image'
    
    # Get post ID
    post_id = (
        meta.get('id') or
        meta.get('status_id') or
        status_info.get('id') or
        ''
    )
    
    # Get author URL
    user_id = user_info.get('id') or meta.get('user_id')
    author_url = f"https://weibo.com/u/{user_id}" if user_id else None
    
    result = {
        'success': True,
        'platform': 'weibo',
        'contentType': content_type,
        'title': post_text[:100] if post_text else None,  # Truncate long posts
        'author': author,
        'authorUrl': author_url,
        'id': str(post_id),
        'description': post_text,
        'imageCount': len(items),
        'items': items,
    }
    
    return sanitize_output(result)


# ============================================
# 12. FLASK ROUTES
# ============================================

@app.route('/api/extract', methods=['POST', 'OPTIONS'])
def extract():
    """Main extraction endpoint"""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response
    
    try:
        # Check content type
        if not request.is_json:
            return jsonify(create_error_response(
                ErrorCode.INVALID_URL, 
                'Content-Type must be application/json'
            )), 400
        
        data = request.get_json() or {}
        url = data.get('url')
        cookie = data.get('cookie')
        
        # Validate URL (security checks)
        is_valid, error_msg = validate_url(url)
        if not is_valid:
            return jsonify(create_error_response(ErrorCode.INVALID_URL, error_msg)), 400
        
        # Sanitize cookie
        cookie = sanitize_cookie(cookie)
        
        # Detect platform
        platform = detect_platform(url)
        if not platform:
            return jsonify(create_error_response(
                ErrorCode.UNSUPPORTED_PLATFORM, 
                'Platform not supported by Python extractor'
            )), 400
        
        # Extract
        if platform in YTDLP_PLATFORMS:
            result = extract_with_ytdlp(url, cookie)
        else:
            result = extract_with_gallery_dl(url, cookie)
        
        if result.get('success'):
            result['isNsfw'] = platform in NSFW_PLATFORMS
            return jsonify(result), 200
        else:
            # Return error with appropriate status code
            error_code = result.get('error', {}).get('code', ErrorCode.EXTRACTION_FAILED)
            status_code = 400
            if error_code in [ErrorCode.RATE_LIMITED]:
                status_code = 429
            elif error_code in [ErrorCode.LOGIN_REQUIRED]:
                status_code = 401
            elif error_code in [ErrorCode.PRIVATE_CONTENT, ErrorCode.AGE_RESTRICTED]:
                status_code = 403
            elif error_code in [ErrorCode.DELETED_CONTENT]:
                status_code = 404
            
            return jsonify(result), status_code
    
    except Exception as e:
        # Don't expose internal error details
        return jsonify(create_error_response(
            ErrorCode.EXTRACTION_FAILED, 
            'Internal server error'
        )), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'runtime': 'python'})


# Block all other routes
@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'success': False,
        'error': {'code': 'NOT_FOUND', 'message': 'Endpoint not found'}
    }), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({
        'success': False,
        'error': {'code': 'METHOD_NOT_ALLOWED', 'message': 'Method not allowed'}
    }), 405


# ============================================
# 13. YOUTUBE HLS PROXY
# ============================================

@app.route('/api/yt-stream', methods=['GET'])
def yt_stream():
    """
    Proxy YouTube HLS playlist and rewrite chunk URLs.
    This allows browser to play HLS via our proxy (bypassing CORS).
    
    Query params:
    - url: YouTube HLS playlist URL (.m3u8)
    - chunk: If present, proxy a chunk URL directly
    """
    from flask import Response
    import requests
    
    url = request.args.get('url')
    is_chunk = request.args.get('chunk') == '1'
    
    if not url:
        return jsonify({'error': 'URL required'}), 400
    
    headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
        'Accept': '*/*',
    }
    
    try:
        if is_chunk:
            # Proxy chunk directly (video/audio segment)
            resp = requests.get(url, headers=headers, stream=True, timeout=30)
            
            def generate():
                for chunk in resp.iter_content(chunk_size=65536):
                    yield chunk
            
            return Response(
                generate(),
                mimetype=resp.headers.get('Content-Type', 'video/mp2t'),
                headers={
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                }
            )
        
        # Fetch HLS playlist
        resp = requests.get(url, headers=headers, timeout=30)
        
        if resp.status_code != 200:
            return jsonify({'error': f'Failed to fetch playlist: {resp.status_code}'}), 502
        
        content = resp.text
        
        # Rewrite URLs in playlist to go through our proxy
        # HLS playlists contain relative or absolute URLs to chunks
        lines = content.split('\n')
        rewritten = []
        
        base_url = url.rsplit('/', 1)[0] + '/'
        
        for line in lines:
            line = line.strip()
            if not line:
                rewritten.append('')
                continue
            
            # Skip comments/tags that aren't URLs
            if line.startswith('#'):
                rewritten.append(line)
                continue
            
            # This is a URL line - rewrite it
            if line.startswith('http'):
                chunk_url = line
            else:
                # Relative URL
                chunk_url = base_url + line
            
            # Rewrite to go through our proxy
            proxied_url = f'/api/yt-stream?url={requests.utils.quote(chunk_url, safe="")}&chunk=1'
            rewritten.append(proxied_url)
        
        rewritten_content = '\n'.join(rewritten)
        
        return Response(
            rewritten_content,
            mimetype='application/vnd.apple.mpegurl',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
            }
        )
        
    except requests.Timeout:
        return jsonify({'error': 'Request timeout'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# 14. LOCAL DEVELOPMENT
# ============================================

if __name__ == '__main__':
    import os
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    port = int(os.environ.get('PYTHON_SERVER_PORT', '3001'))
    app.run(host='localhost', port=port, debug=debug_mode)
