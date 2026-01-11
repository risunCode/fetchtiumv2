#!/usr/bin/env python3
"""
Test script for Python extractors
Run: python scripts/test-python-extractor.py
"""

import sys
import os

# Add api/py to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api', 'py'))

from extract import detect_platform, extract_with_ytdlp, extract_with_gallery_dl, NSFW_PLATFORMS

# Test URLs (public, non-authenticated)
TEST_URLS = {
    'soundcloud': 'https://soundcloud.com/olenka-ananasa/babydoll-speed',
    # 'bilibili': 'https://www.bilibili.com/video/BV1xx411c7mD',  # May need auth
    # 'reddit': 'https://www.reddit.com/r/videos/comments/example',  # Need real URL
}

def test_platform_detection():
    """Test platform detection"""
    print("\n=== Testing Platform Detection ===")
    
    test_cases = [
        ('https://soundcloud.com/artist/track', 'soundcloud'),
        ('https://www.bilibili.com/video/BV123', 'bilibili'),
        ('https://b23.tv/abc123', 'bilibili'),
        ('https://www.reddit.com/r/test/comments/abc', 'reddit'),
        ('https://v.redd.it/abc123', 'reddit'),
        ('https://www.pixiv.net/artworks/12345', 'pixiv'),
        ('https://www.eporner.com/video-abc/', 'eporner'),
        ('https://rule34video.com/video/123/', 'rule34video'),
        ('https://twitter.com/user/status/123', None),  # Not Python platform
        ('https://instagram.com/p/abc', None),  # Not Python platform
        # New platforms (Task 1.1)
        ('https://www.twitch.tv/channel/clip/ClipName', 'twitch'),
        ('https://clips.twitch.tv/ClipName', 'twitch'),
        ('https://artist.bandcamp.com/track/song', 'bandcamp'),
        ('https://bandcamp.com/discover', 'bandcamp'),
        ('https://weibo.com/1234567890/post', 'weibo'),
        ('https://weibo.cn/status/123', 'weibo'),
        ('https://www.pinterest.com/pin/123456/', 'pinterest'),
        ('https://pin.it/abc123', 'pinterest'),
    ]
    
    all_passed = True
    for url, expected in test_cases:
        result = detect_platform(url)
        status = '✓' if result == expected else '✗'
        if result != expected:
            all_passed = False
        print(f"  {status} {url[:50]}... -> {result} (expected: {expected})")
    
    return all_passed

def test_nsfw_detection():
    """Test NSFW platform detection"""
    print("\n=== Testing NSFW Detection ===")
    
    nsfw_expected = ['pixiv', 'eporner', 'rule34video']
    
    all_passed = True
    for platform in nsfw_expected:
        is_nsfw = platform in NSFW_PLATFORMS
        status = '✓' if is_nsfw else '✗'
        if not is_nsfw:
            all_passed = False
        print(f"  {status} {platform} is NSFW: {is_nsfw}")
    
    # Check non-NSFW
    for platform in ['soundcloud', 'bilibili', 'reddit']:
        is_nsfw = platform in NSFW_PLATFORMS
        status = '✓' if not is_nsfw else '✗'
        if is_nsfw:
            all_passed = False
        print(f"  {status} {platform} is NOT NSFW: {not is_nsfw}")
    
    return all_passed

def test_soundcloud_extraction():
    """Test SoundCloud extraction with yt-dlp"""
    print("\n=== Testing SoundCloud Extraction (yt-dlp) ===")
    
    url = TEST_URLS.get('soundcloud')
    if not url:
        print("  ⚠ No test URL configured")
        return True
    
    try:
        print(f"  Testing: {url}")
        result = extract_with_ytdlp(url)
        
        if result.get('success'):
            print(f"  ✓ Success!")
            print(f"    Title: {result.get('title', 'N/A')}")
            print(f"    Author: {result.get('author', 'N/A')}")
            print(f"    Items: {len(result.get('items', []))}")
            if result.get('items'):
                sources = result['items'][0].get('sources', [])
                print(f"    Sources: {len(sources)}")
            return True
        else:
            print(f"  ✗ Failed: {result.get('error', {}).get('message', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"  ✗ Exception: {e}")
        return False

def main():
    print("=" * 50)
    print("Python Extractor Test Suite")
    print("=" * 50)
    
    results = []
    
    # Run tests
    results.append(('Platform Detection', test_platform_detection()))
    results.append(('NSFW Detection', test_nsfw_detection()))
    results.append(('SoundCloud Extraction', test_soundcloud_extraction()))
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Summary")
    print("=" * 50)
    
    all_passed = True
    for name, passed in results:
        status = '✓ PASS' if passed else '✗ FAIL'
        if not passed:
            all_passed = False
        print(f"  {status}: {name}")
    
    print("\n" + ("All tests passed!" if all_passed else "Some tests failed!"))
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
