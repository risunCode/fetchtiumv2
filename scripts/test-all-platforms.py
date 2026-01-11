#!/usr/bin/env python3
"""
Comprehensive Platform Test Suite (Checkpoint Task 7)
Tests all platforms: YouTube, BiliBili, Twitch, Bandcamp, SoundCloud,
                     Pinterest, Reddit, Weibo, Pixiv

Run: python scripts/test-all-platforms.py
"""

import sys
import os
import json

# Add api/py to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api', 'py'))

from extract import (
    detect_platform,
    get_platform_config,
    extract_with_ytdlp,
    extract_with_gallery_dl,
    process_video_formats,
    process_audio_formats,
    merge_headers,
    resolve_short_url,
    transform_ytdlp_result,
    transform_twitch_result,
    transform_bandcamp_result,
    transform_pinterest_result,
    transform_weibo_result,
    transform_gallery_dl_result,
    PLATFORM_CONFIG,
    YTDLP_PLATFORMS,
    GALLERY_DL_PLATFORMS,
    NSFW_PLATFORMS,
    DEFAULT_USER_AGENT,
    DEFAULT_HEADERS,
    DEFAULT_TARGET_HEIGHTS,
    DEFAULT_CODEC_PRIORITY,
)


# ============================================
# Test 1: Platform Configuration Registry
# ============================================

def test_platform_config_registry():
    """Test that PLATFORM_CONFIG contains all required platforms with correct structure"""
    print("\n=== Testing Platform Configuration Registry ===")
    
    required_platforms = [
        'youtube', 'bilibili', 'twitch', 'bandcamp', 'soundcloud',
        'pinterest', 'reddit', 'weibo', 'pixiv'
    ]
    
    required_fields = ['extractor', 'patterns', 'nsfw']
    optional_fields = ['short_url_pattern', 'custom_headers']
    
    all_passed = True
    
    # Check all required platforms exist
    for platform in required_platforms:
        if platform not in PLATFORM_CONFIG:
            print(f"  ✗ Missing platform: {platform}")
            all_passed = False
        else:
            config = PLATFORM_CONFIG[platform]
            
            # Check required fields
            for field in required_fields:
                if field not in config:
                    print(f"  ✗ {platform}: missing required field '{field}'")
                    all_passed = False
            
            # Validate extractor type
            if config.get('extractor') not in ['yt-dlp', 'gallery-dl']:
                print(f"  ✗ {platform}: invalid extractor '{config.get('extractor')}'")
                all_passed = False
            
            # Validate patterns is a list
            if not isinstance(config.get('patterns'), list):
                print(f"  ✗ {platform}: patterns must be a list")
                all_passed = False
            
            # Validate nsfw is boolean
            if not isinstance(config.get('nsfw'), bool):
                print(f"  ✗ {platform}: nsfw must be boolean")
                all_passed = False
            
            print(f"  ✓ {platform}: config valid (extractor={config['extractor']}, nsfw={config['nsfw']})")
    
    return all_passed


def test_derived_platform_lists():
    """Test that derived lists (YTDLP_PLATFORMS, GALLERY_DL_PLATFORMS, NSFW_PLATFORMS) are correct"""
    print("\n=== Testing Derived Platform Lists ===")
    
    all_passed = True
    
    # Expected yt-dlp platforms
    expected_ytdlp = ['youtube', 'bilibili', 'soundcloud', 'twitch', 'bandcamp']
    for platform in expected_ytdlp:
        if platform not in YTDLP_PLATFORMS:
            print(f"  ✗ {platform} should be in YTDLP_PLATFORMS")
            all_passed = False
        else:
            print(f"  ✓ {platform} in YTDLP_PLATFORMS")
    
    # Expected gallery-dl platforms
    expected_gallery_dl = ['reddit', 'pixiv', 'pinterest', 'weibo']
    for platform in expected_gallery_dl:
        if platform not in GALLERY_DL_PLATFORMS:
            print(f"  ✗ {platform} should be in GALLERY_DL_PLATFORMS")
            all_passed = False
        else:
            print(f"  ✓ {platform} in GALLERY_DL_PLATFORMS")
    
    # Expected NSFW platforms
    expected_nsfw = ['pixiv', 'eporner', 'rule34video']
    for platform in expected_nsfw:
        if platform not in NSFW_PLATFORMS:
            print(f"  ✗ {platform} should be in NSFW_PLATFORMS")
            all_passed = False
        else:
            print(f"  ✓ {platform} in NSFW_PLATFORMS")
    
    # Non-NSFW platforms should NOT be in NSFW_PLATFORMS
    non_nsfw = ['youtube', 'bilibili', 'soundcloud', 'reddit', 'pinterest', 'weibo', 'twitch', 'bandcamp']
    for platform in non_nsfw:
        if platform in NSFW_PLATFORMS:
            print(f"  ✗ {platform} should NOT be in NSFW_PLATFORMS")
            all_passed = False
    
    return all_passed


# ============================================
# Test 2: Platform Detection
# ============================================

def test_platform_detection():
    """Test platform detection for all platforms"""
    print("\n=== Testing Platform Detection ===")
    
    test_cases = [
        # YouTube
        ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'),
        ('https://youtu.be/dQw4w9WgXcQ', 'youtube'),
        ('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube'),
        
        # BiliBili
        ('https://www.bilibili.com/video/BV1xx411c7mD', 'bilibili'),
        ('https://www.bilibili.tv/en/video/123456', 'bilibili'),
        ('https://b23.tv/abc123', 'bilibili'),
        
        # Twitch
        ('https://www.twitch.tv/channel/clip/ClipName', 'twitch'),
        ('https://clips.twitch.tv/ClipName', 'twitch'),
        
        # Bandcamp
        ('https://artist.bandcamp.com/track/song', 'bandcamp'),
        ('https://bandcamp.com/discover', 'bandcamp'),
        
        # SoundCloud
        ('https://soundcloud.com/artist/track', 'soundcloud'),
        
        # Pinterest
        ('https://www.pinterest.com/pin/123456/', 'pinterest'),
        ('https://pin.it/abc123', 'pinterest'),
        
        # Reddit
        ('https://www.reddit.com/r/videos/comments/abc123/test/', 'reddit'),
        ('https://redd.it/abc123', 'reddit'),
        ('https://v.redd.it/abc123', 'reddit'),
        
        # Weibo
        ('https://weibo.com/1234567890/post', 'weibo'),
        ('https://weibo.cn/status/123', 'weibo'),
        
        # Pixiv
        ('https://www.pixiv.net/artworks/12345', 'pixiv'),
    ]
    
    all_passed = True
    for url, expected in test_cases:
        result = detect_platform(url)
        status = '✓' if result == expected else '✗'
        if result != expected:
            all_passed = False
            print(f"  {status} {url[:50]}... -> {result} (expected: {expected})")
        else:
            print(f"  {status} {url[:50]}... -> {result}")
    
    return all_passed


def test_get_platform_config():
    """Test get_platform_config() helper function"""
    print("\n=== Testing get_platform_config() ===")
    
    all_passed = True
    
    # Test by platform name
    for platform in ['youtube', 'bilibili', 'pinterest', 'reddit']:
        config = get_platform_config(platform)
        if config is None:
            print(f"  ✗ get_platform_config('{platform}') returned None")
            all_passed = False
        else:
            print(f"  ✓ get_platform_config('{platform}') -> extractor={config['extractor']}")
    
    # Test by URL
    test_urls = [
        ('https://www.youtube.com/watch?v=abc', 'yt-dlp'),
        ('https://pin.it/abc123', 'gallery-dl'),
        ('https://b23.tv/abc123', 'yt-dlp'),
    ]
    
    for url, expected_extractor in test_urls:
        config = get_platform_config(url)
        if config is None:
            print(f"  ✗ get_platform_config('{url[:30]}...') returned None")
            all_passed = False
        elif config['extractor'] != expected_extractor:
            print(f"  ✗ get_platform_config('{url[:30]}...') -> extractor={config['extractor']} (expected: {expected_extractor})")
            all_passed = False
        else:
            print(f"  ✓ get_platform_config('{url[:30]}...') -> extractor={config['extractor']}")
    
    return all_passed


# ============================================
# Test 3: Header Merge Function
# ============================================

def test_merge_headers():
    """Test merge_headers() function"""
    print("\n=== Testing merge_headers() ===")
    
    all_passed = True
    
    # Test with no custom headers
    result = merge_headers()
    if 'User-Agent' not in result:
        print("  ✗ merge_headers() missing User-Agent")
        all_passed = False
    elif result['User-Agent'] != DEFAULT_USER_AGENT:
        print("  ✗ merge_headers() User-Agent mismatch")
        all_passed = False
    else:
        print("  ✓ merge_headers() includes DEFAULT_USER_AGENT")
    
    # Test that DEFAULT_HEADERS are included
    for key in DEFAULT_HEADERS:
        if key not in result:
            print(f"  ✗ merge_headers() missing DEFAULT_HEADERS key: {key}")
            all_passed = False
    print(f"  ✓ merge_headers() includes all {len(DEFAULT_HEADERS)} DEFAULT_HEADERS keys")
    
    # Test with custom headers (should override)
    custom = {'Accept': 'custom/accept', 'X-Custom': 'value'}
    result = merge_headers(custom)
    if result.get('Accept') != 'custom/accept':
        print("  ✗ merge_headers() custom headers should override defaults")
        all_passed = False
    else:
        print("  ✓ merge_headers() custom headers override defaults")
    
    if result.get('X-Custom') != 'value':
        print("  ✗ merge_headers() should include custom headers")
        all_passed = False
    else:
        print("  ✓ merge_headers() includes custom headers")
    
    return all_passed


# ============================================
# Test 4: Short URL Resolution
# ============================================

def test_short_url_resolution():
    """Test resolve_short_url() function"""
    print("\n=== Testing Short URL Resolution ===")
    
    all_passed = True
    
    # Test passthrough for non-short URLs
    non_short_urls = [
        'https://www.youtube.com/watch?v=abc',
        'https://www.pinterest.com/pin/123456/',
        'https://www.bilibili.com/video/BV123',
    ]
    
    for url in non_short_urls:
        result = resolve_short_url(url)
        if result != url:
            print(f"  ✗ Non-short URL was modified: {url[:40]}...")
            all_passed = False
        else:
            print(f"  ✓ Non-short URL passed through: {url[:40]}...")
    
    # Test that short URL patterns are recognized
    # (We can't test actual resolution without network, but we can test pattern detection)
    from extract import SHORT_URL_PATTERNS
    import re
    
    short_urls = [
        ('https://pin.it/abc123', 'pin.it'),
        ('https://b23.tv/abc123', 'b23.tv'),
        ('https://redd.it/abc123', 'redd.it'),
    ]
    
    for url, expected_pattern in short_urls:
        matched = False
        for pattern_name, pattern in SHORT_URL_PATTERNS.items():
            if re.search(pattern, url, re.IGNORECASE):
                matched = True
                break
        
        if not matched:
            print(f"  ✗ Short URL pattern not detected: {url}")
            all_passed = False
        else:
            print(f"  ✓ Short URL pattern detected: {url} ({expected_pattern})")
    
    return all_passed


# ============================================
# Test 5: Format Processing
# ============================================

def test_process_video_formats():
    """Test process_video_formats() function"""
    print("\n=== Testing process_video_formats() ===")
    
    all_passed = True
    
    # Create mock formats similar to yt-dlp output
    mock_formats = [
        # Video with audio (1080p)
        {'url': 'http://example.com/1080p.mp4', 'height': 1080, 'width': 1920, 
         'vcodec': 'avc1.4d401f', 'acodec': 'mp4a.40.2', 'ext': 'mp4', 'format_note': '1080p'},
        # Video only (720p)
        {'url': 'http://example.com/720p.mp4', 'height': 720, 'width': 1280,
         'vcodec': 'avc1.4d401f', 'acodec': 'none', 'ext': 'mp4', 'format_note': '720p'},
        # Video with audio (480p)
        {'url': 'http://example.com/480p.mp4', 'height': 480, 'width': 854,
         'vcodec': 'avc1.4d401f', 'acodec': 'mp4a.40.2', 'ext': 'mp4', 'format_note': '480p'},
        # Audio only
        {'url': 'http://example.com/audio.m4a', 'height': None, 'width': None,
         'vcodec': 'none', 'acodec': 'mp4a.40.2', 'ext': 'm4a', 'abr': 128, 'format_note': 'audio'},
    ]
    
    video_sources, audio_sources = process_video_formats(mock_formats)
    
    # Check video sources
    if len(video_sources) < 1:
        print("  ✗ process_video_formats() returned no video sources")
        all_passed = False
    else:
        print(f"  ✓ process_video_formats() returned {len(video_sources)} video sources")
    
    # Check that video-only formats have needsMerge=True
    for src in video_sources:
        if src.get('hasAudio') == False and src.get('needsMerge') != True:
            print(f"  ✗ Video-only format missing needsMerge=True: {src.get('quality')}")
            all_passed = False
    
    # Check that video with audio has hasAudio=True
    has_audio_format = any(src.get('hasAudio') == True for src in video_sources)
    if has_audio_format:
        print("  ✓ Video with audio has hasAudio=True")
    
    # Check audio sources
    if len(audio_sources) < 1:
        print("  ✗ process_video_formats() returned no audio sources")
        all_passed = False
    else:
        print(f"  ✓ process_video_formats() returned {len(audio_sources)} audio sources")
    
    return all_passed


def test_process_audio_formats():
    """Test process_audio_formats() function"""
    print("\n=== Testing process_audio_formats() ===")
    
    all_passed = True
    
    # Create mock audio sources
    mock_audio = [
        {'quality': '128kbps', 'url': 'http://example.com/128.m4a', 'codec': 'AAC', '_bitrate': 128},
        {'quality': '256kbps', 'url': 'http://example.com/256.m4a', 'codec': 'AAC', '_bitrate': 256},
        {'quality': '64kbps', 'url': 'http://example.com/64.opus', 'codec': 'Opus', '_bitrate': 64},
        {'quality': '128kbps', 'url': 'http://example.com/128.opus', 'codec': 'Opus', '_bitrate': 128},
    ]
    
    result = process_audio_formats(mock_audio, target_bitrate=128)
    
    if len(result) < 1:
        print("  ✗ process_audio_formats() returned no sources")
        all_passed = False
    else:
        print(f"  ✓ process_audio_formats() returned {len(result)} sources")
    
    # Check that best AAC and Opus are selected
    codecs = [src.get('codec') for src in result]
    if 'AAC' in codecs:
        print("  ✓ process_audio_formats() selected AAC format")
    if 'Opus' in codecs:
        print("  ✓ process_audio_formats() selected Opus format")
    
    return all_passed


# ============================================
# Test 6: Response Structure Validation
# ============================================

def validate_response_structure(result: dict, platform: str) -> tuple[bool, list]:
    """Validate that response has required structure"""
    errors = []
    
    # Required top-level fields
    required_fields = ['success', 'platform', 'contentType', 'items']
    for field in required_fields:
        if field not in result:
            errors.append(f"Missing required field: {field}")
    
    if result.get('success') != True:
        errors.append(f"success should be True, got {result.get('success')}")
    
    if result.get('platform') != platform:
        errors.append(f"platform should be '{platform}', got '{result.get('platform')}'")
    
    # Validate items
    items = result.get('items', [])
    if not isinstance(items, list):
        errors.append("items should be a list")
    elif len(items) == 0:
        errors.append("items should not be empty")
    else:
        for i, item in enumerate(items):
            # Required item fields
            if 'index' not in item:
                errors.append(f"Item {i}: missing 'index'")
            if 'type' not in item:
                errors.append(f"Item {i}: missing 'type'")
            if 'sources' not in item:
                errors.append(f"Item {i}: missing 'sources'")
            elif not isinstance(item.get('sources'), list):
                errors.append(f"Item {i}: sources should be a list")
            elif len(item.get('sources', [])) == 0:
                errors.append(f"Item {i}: sources should not be empty")
            else:
                # Validate source structure
                for j, src in enumerate(item.get('sources', [])):
                    required_src_fields = ['quality', 'url', 'mime', 'extension', 'filename']
                    for field in required_src_fields:
                        if field not in src:
                            errors.append(f"Item {i}, Source {j}: missing '{field}'")
    
    return len(errors) == 0, errors


# ============================================
# Test 7: Live Extraction Tests (Optional)
# ============================================

def test_soundcloud_extraction():
    """Test SoundCloud extraction (yt-dlp)"""
    print("\n=== Testing SoundCloud Extraction ===")
    
    # Use a known public track - try multiple URLs in case one is unavailable
    test_urls = [
        'https://soundcloud.com/olenka-ananasa/babydoll-speed',
        'https://soundcloud.com/nocopyrightsounds/ncs-release-tobu-candyland',
    ]
    
    for url in test_urls:
        try:
            result = extract_with_ytdlp(url)
            
            if result.get('success'):
                is_valid, errors = validate_response_structure(result, 'soundcloud')
                if is_valid:
                    print(f"  ✓ SoundCloud extraction successful")
                    print(f"    URL: {url[:50]}...")
                    print(f"    Title: {result.get('title', 'N/A')[:50]}")
                    print(f"    Author: {result.get('author', 'N/A')}")
                    print(f"    Items: {len(result.get('items', []))}")
                    return True
                else:
                    print(f"  ⚠ SoundCloud response structure invalid for {url[:30]}...")
                    continue
            else:
                error = result.get('error', {})
                print(f"  ⚠ SoundCloud URL unavailable: {url[:40]}... ({error.get('code')})")
                continue
        except Exception as e:
            print(f"  ⚠ SoundCloud exception for {url[:30]}...: {str(e)[:30]}")
            continue
    
    print(f"  ✗ All SoundCloud test URLs failed")
    return False


def test_youtube_extraction():
    """Test YouTube extraction (yt-dlp)"""
    print("\n=== Testing YouTube Extraction ===")
    
    # Use a known public video (Rick Astley - Never Gonna Give You Up)
    url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    
    try:
        result = extract_with_ytdlp(url)
        
        if result.get('success'):
            is_valid, errors = validate_response_structure(result, 'youtube')
            if is_valid:
                print(f"  ✓ YouTube extraction successful")
                print(f"    Title: {result.get('title', 'N/A')[:50]}")
                print(f"    Author: {result.get('author', 'N/A')}")
                print(f"    Items: {len(result.get('items', []))}")
                
                # Check for video sources with needsMerge flag
                items = result.get('items', [])
                if items:
                    video_item = items[0]
                    sources = video_item.get('sources', [])
                    has_merge_flag = any('needsMerge' in src for src in sources)
                    if has_merge_flag:
                        print(f"    ✓ Sources have needsMerge flag")
                    else:
                        print(f"    ⚠ Sources missing needsMerge flag")
                
                return True
            else:
                print(f"  ✗ YouTube response structure invalid:")
                for err in errors[:3]:
                    print(f"    - {err}")
                return False
        else:
            error = result.get('error', {})
            print(f"  ✗ YouTube extraction failed: {error.get('code')} - {error.get('message', '')[:50]}")
            return False
    except Exception as e:
        print(f"  ✗ YouTube extraction exception: {str(e)[:50]}")
        return False


def test_bilibili_extraction():
    """Test BiliBili extraction (yt-dlp)"""
    print("\n=== Testing BiliBili Extraction ===")
    
    # Use BiliBili TV (international) which doesn't require auth
    test_urls = [
        'https://www.bilibili.tv/en/video/4788759250606592',
        'https://www.bilibili.tv/en/video/2048573870',
    ]
    
    for url in test_urls:
        try:
            result = extract_with_ytdlp(url)
            
            if result.get('success'):
                is_valid, errors = validate_response_structure(result, 'bilibili')
                if is_valid:
                    print(f"  ✓ BiliBili extraction successful")
                    print(f"    URL: {url[:50]}...")
                    print(f"    Title: {result.get('title', 'N/A')[:50]}")
                    print(f"    Author: {result.get('author', 'N/A')}")
                    print(f"    Items: {len(result.get('items', []))}")
                    
                    # Check video sources
                    items = result.get('items', [])
                    if items:
                        video_item = items[0]
                        sources = video_item.get('sources', [])
                        print(f"    Sources: {len(sources)}")
                        for src in sources[:3]:
                            print(f"      - {src.get('quality')} ({src.get('resolution', 'N/A')})")
                    
                    return True
                else:
                    print(f"  ⚠ BiliBili response structure invalid for {url[:30]}...")
                    continue
            else:
                error = result.get('error', {})
                print(f"  ⚠ BiliBili URL unavailable: {url[:40]}... ({error.get('code')})")
                continue
        except Exception as e:
            print(f"  ⚠ BiliBili exception for {url[:30]}...: {str(e)[:30]}")
            continue
    
    print(f"  ✗ All BiliBili test URLs failed")
    return False


# ============================================
# Main Test Runner
# ============================================

def main():
    print("=" * 60)
    print("Comprehensive Platform Test Suite (Checkpoint Task 7)")
    print("=" * 60)
    
    results = []
    
    # Unit tests (no network required)
    print("\n" + "-" * 60)
    print("UNIT TESTS (No Network Required)")
    print("-" * 60)
    
    results.append(('Platform Config Registry', test_platform_config_registry()))
    results.append(('Derived Platform Lists', test_derived_platform_lists()))
    results.append(('Platform Detection', test_platform_detection()))
    results.append(('get_platform_config()', test_get_platform_config()))
    results.append(('merge_headers()', test_merge_headers()))
    results.append(('Short URL Resolution', test_short_url_resolution()))
    results.append(('process_video_formats()', test_process_video_formats()))
    results.append(('process_audio_formats()', test_process_audio_formats()))
    
    # Live extraction tests (require network)
    print("\n" + "-" * 60)
    print("LIVE EXTRACTION TESTS (Network Required)")
    print("-" * 60)
    print("Note: These tests require network access and may fail due to")
    print("      rate limiting, geo-restrictions, or content changes.")
    
    results.append(('SoundCloud Extraction', test_soundcloud_extraction()))
    results.append(('YouTube Extraction', test_youtube_extraction()))
    results.append(('BiliBili Extraction', test_bilibili_extraction()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = 0
    failed = 0
    for name, result in results:
        status = '✓ PASS' if result else '✗ FAIL'
        if result:
            passed += 1
        else:
            failed += 1
        print(f"  {status}: {name}")
    
    print(f"\nTotal: {passed} passed, {failed} failed")
    print("\n" + ("All tests passed!" if failed == 0 else "Some tests failed!"))
    
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
