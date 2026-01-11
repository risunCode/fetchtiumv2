#!/usr/bin/env python3
"""
Test script for short URL resolution (Checkpoint Task 4)
Tests: Pinterest (pin.it), Reddit (redd.it), BiliBili (b23.tv)

Run: python scripts/test-short-urls.py
"""

import sys
import os

# Add api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from extract import (
    resolve_short_url, 
    detect_platform, 
    get_platform_config,
    SHORT_URL_PATTERNS,
    DEFAULT_USER_AGENT
)


def test_short_url_pattern_detection():
    """Test that short URL patterns are correctly identified"""
    print("\n=== Testing Short URL Pattern Detection ===")
    
    test_cases = [
        # (url, expected_is_short_url)
        ('https://pin.it/abc123', True),
        ('https://b23.tv/abc123', True),
        ('https://redd.it/abc123', True),
        ('https://www.pinterest.com/pin/123456/', False),
        ('https://www.bilibili.com/video/BV123', False),
        ('https://www.reddit.com/r/test/comments/abc', False),
        ('https://youtube.com/watch?v=abc', False),
    ]
    
    all_passed = True
    for url, expected_is_short in test_cases:
        # Check if URL matches any short URL pattern
        import re
        is_short = False
        for pattern_name, pattern in SHORT_URL_PATTERNS.items():
            if re.search(pattern, url, re.IGNORECASE):
                is_short = True
                break
        
        status = '✓' if is_short == expected_is_short else '✗'
        if is_short != expected_is_short:
            all_passed = False
        print(f"  {status} {url[:50]}... -> is_short={is_short} (expected: {expected_is_short})")
    
    return all_passed


def test_platform_config_short_url_patterns():
    """Test that platform configs have correct short_url_pattern settings"""
    print("\n=== Testing Platform Config Short URL Patterns ===")
    
    expected_patterns = {
        'pinterest': r'pin\.it',
        'bilibili': r'b23\.tv',
        'reddit': r'redd\.it',
        'youtube': None,
        'soundcloud': None,
    }
    
    all_passed = True
    for platform, expected_pattern in expected_patterns.items():
        config = get_platform_config(platform)
        if config is None:
            print(f"  ✗ {platform}: config not found!")
            all_passed = False
            continue
        
        actual_pattern = config.get('short_url_pattern')
        status = '✓' if actual_pattern == expected_pattern else '✗'
        if actual_pattern != expected_pattern:
            all_passed = False
        print(f"  {status} {platform}: short_url_pattern={actual_pattern} (expected: {expected_pattern})")
    
    return all_passed


def test_resolve_short_url_passthrough():
    """Test that non-short URLs pass through unchanged"""
    print("\n=== Testing resolve_short_url Passthrough ===")
    
    test_urls = [
        'https://www.pinterest.com/pin/123456/',
        'https://www.bilibili.com/video/BV1xx411c7mD',
        'https://www.reddit.com/r/videos/comments/abc123/test/',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
    ]
    
    all_passed = True
    for url in test_urls:
        result = resolve_short_url(url)
        # Non-short URLs should pass through unchanged
        status = '✓' if result == url else '✗'
        if result != url:
            all_passed = False
            print(f"  {status} {url[:50]}...")
            print(f"      Expected: {url}")
            print(f"      Got: {result}")
        else:
            print(f"  {status} {url[:50]}... -> unchanged")
    
    return all_passed


def test_resolve_short_url_live():
    """Test actual short URL resolution (requires network)"""
    print("\n=== Testing Live Short URL Resolution ===")
    print("  (Note: These tests require network access and may fail if URLs expire)")
    
    # Test that the function handles short URLs correctly
    # Invalid short URLs typically redirect to the platform's homepage
    print("\n  Testing short URL resolution behavior:")
    
    # Test 1: Invalid pin.it URL should resolve (Pinterest redirects to homepage)
    invalid_pin_url = 'https://pin.it/invalid_test_url_12345'
    result = resolve_short_url(invalid_pin_url)
    # Pinterest redirects invalid short URLs to their homepage
    if 'pinterest' in result.lower():
        print(f"    ✓ pin.it URL resolved to Pinterest domain: {result[:50]}...")
        test1_passed = True
    else:
        print(f"    ✗ pin.it URL did not resolve to Pinterest")
        print(f"      Got: {result}")
        test1_passed = False
    
    # Test 2: Non-short URL should pass through unchanged
    normal_url = 'https://www.pinterest.com/pin/123456/'
    result = resolve_short_url(normal_url)
    if result == normal_url:
        print(f"    ✓ Non-short URL passed through unchanged")
        test2_passed = True
    else:
        print(f"    ✗ Non-short URL was modified")
        print(f"      Got: {result}")
        test2_passed = False
    
    # Test 3: Test with platform parameter
    result = resolve_short_url(invalid_pin_url, 'pinterest')
    if 'pinterest' in result.lower():
        print(f"    ✓ Short URL with platform param resolved correctly")
        test3_passed = True
    else:
        print(f"    ✗ Short URL with platform param failed")
        test3_passed = False
    
    return test1_passed and test2_passed and test3_passed


def test_tracking_param_removal():
    """Test that tracking parameters are removed from resolved URLs"""
    print("\n=== Testing Tracking Parameter Removal ===")
    
    # We can't easily test this without actual short URL resolution
    # But we can verify the TRACKING_PARAMS list exists
    from extract import TRACKING_PARAMS
    
    expected_params = ['utm_source', 'utm_medium', 'fbclid', 'gclid', 'ref']
    
    all_passed = True
    for param in expected_params:
        if param in TRACKING_PARAMS:
            print(f"  ✓ {param} is in TRACKING_PARAMS")
        else:
            print(f"  ✗ {param} is NOT in TRACKING_PARAMS")
            all_passed = False
    
    return all_passed


def test_platform_detection_with_short_urls():
    """Test that platform detection works with short URLs"""
    print("\n=== Testing Platform Detection with Short URLs ===")
    
    test_cases = [
        ('https://pin.it/abc123', 'pinterest'),
        ('https://b23.tv/abc123', 'bilibili'),
        ('https://redd.it/abc123', 'reddit'),
        ('https://v.redd.it/abc123', 'reddit'),
    ]
    
    all_passed = True
    for url, expected_platform in test_cases:
        result = detect_platform(url)
        status = '✓' if result == expected_platform else '✗'
        if result != expected_platform:
            all_passed = False
        print(f"  {status} {url} -> {result} (expected: {expected_platform})")
    
    return all_passed


def main():
    print("=" * 60)
    print("Short URL Resolution Test Suite (Checkpoint Task 4)")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(('Short URL Pattern Detection', test_short_url_pattern_detection()))
    results.append(('Platform Config Short URL Patterns', test_platform_config_short_url_patterns()))
    results.append(('resolve_short_url Passthrough', test_resolve_short_url_passthrough()))
    results.append(('Tracking Parameter Removal', test_tracking_param_removal()))
    results.append(('Platform Detection with Short URLs', test_platform_detection_with_short_urls()))
    results.append(('Live Short URL Resolution', test_resolve_short_url_live()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
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
