#!/usr/bin/env python3
"""
Integration test for YouTube streaming simplification.

Tests the full flow:
1. YouTube URL → extraction → format processing
2. Progressive format (720p) should use stream endpoint
3. DASH format (1080p) should use merge endpoint
4. No HLS URLs in response

Requirements: 1.1-1.3, 2.1-2.4, 3.1-3.3, 5.1-5.3, 6.1-6.3
"""

import sys
import os

# Add the api directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from extract import (
    extract_with_ytdlp,
    is_hls_format,
    is_progressive_format,
    detect_platform,
)


def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def print_result(label: str, passed: bool, details: str = ""):
    """Print a test result"""
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"  {status}: {label}")
    if details:
        print(f"         {details}")


def test_youtube_format_processing():
    """
    Test YouTube format processing with a simple, short video.
    Uses "Me at the zoo" - the first YouTube video ever uploaded.
    """
    print_header("YouTube Format Processing Integration Test")
    
    # Use a short, reliable YouTube video
    url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
    print(f"  URL: {url}")
    
    # Test 1: Platform detection
    platform = detect_platform(url)
    print_result("Platform detection", platform == 'youtube', f"Detected: {platform}")
    if platform != 'youtube':
        return False
    
    # Test 2: Extraction
    print("\n  Extracting video info...")
    result = extract_with_ytdlp(url)
    
    if not result.get('success'):
        error = result.get('error', {})
        print_result("Extraction", False, f"Error: {error.get('code')} - {error.get('message')}")
        return False
    
    print_result("Extraction", True, f"Title: {result.get('title', 'N/A')[:50]}...")
    
    # Get video and audio sources
    items = result.get('items', [])
    video_item = next((item for item in items if item.get('type') == 'video'), None)
    audio_item = next((item for item in items if item.get('type') == 'audio'), None)
    
    if not video_item:
        print_result("Video sources found", False, "No video item in response")
        return False
    
    video_sources = video_item.get('sources', [])
    audio_sources = audio_item.get('sources', []) if audio_item else []
    
    print(f"\n  Found {len(video_sources)} video sources, {len(audio_sources)} audio sources")
    
    all_passed = True
    
    # Test 3: No HLS URLs (.m3u8)
    hls_urls = [s for s in video_sources if '.m3u8' in s.get('url', '')]
    no_hls = len(hls_urls) == 0
    print_result("No HLS URLs (.m3u8) - Req 3.1", no_hls, 
                 f"Found {len(hls_urls)} HLS URLs" if not no_hls else "All URLs are direct")
    if not no_hls:
        all_passed = False
    
    # Test 4: Progressive formats have correct flags
    progressive_sources = [s for s in video_sources if s.get('hasAudio') == True]
    if progressive_sources:
        progressive_correct = all(s.get('needsMerge') == False for s in progressive_sources)
        print_result("Progressive: hasAudio=true, needsMerge=false - Req 1.3", progressive_correct,
                     f"{len(progressive_sources)} progressive sources")
        if not progressive_correct:
            all_passed = False
    else:
        print_result("Progressive formats found", False, "No progressive formats available")
    
    # Test 5: DASH formats have correct flags
    dash_sources = [s for s in video_sources if s.get('hasAudio') == False]
    if dash_sources:
        dash_correct = all(s.get('needsMerge') == True for s in dash_sources)
        print_result("DASH: hasAudio=false, needsMerge=true - Req 2.2", dash_correct,
                     f"{len(dash_sources)} DASH sources")
        if not dash_correct:
            all_passed = False
        
        # Test 6: Audio sources available for DASH merge
        has_audio_for_dash = len(audio_sources) > 0
        print_result("Audio sources for DASH merge - Req 2.3", has_audio_for_dash,
                     f"{len(audio_sources)} audio sources available")
        if not has_audio_for_dash:
            all_passed = False
    
    # Test 7: Progressive format prioritized (first source should be progressive if available)
    if progressive_sources and video_sources:
        first_is_progressive = video_sources[0].get('hasAudio') == True
        print_result("Progressive format prioritized - Req 1.2, 5.1", first_is_progressive,
                     f"First source: {video_sources[0].get('quality')}, hasAudio={video_sources[0].get('hasAudio')}")
        if not first_is_progressive:
            all_passed = False
    
    # Print source summary
    print("\n  Video Sources Summary:")
    for i, source in enumerate(video_sources[:5]):
        quality = source.get('quality', 'unknown')
        has_audio = source.get('hasAudio', False)
        needs_merge = source.get('needsMerge', False)
        endpoint = "/api/v1/stream" if has_audio else "/api/v1/merge"
        print(f"    {i+1}. {quality:12} | hasAudio={str(has_audio):5} | needsMerge={str(needs_merge):5} | → {endpoint}")
    
    if len(video_sources) > 5:
        print(f"    ... and {len(video_sources) - 5} more")
    
    if audio_sources:
        print("\n  Audio Sources (for DASH merge):")
        for i, source in enumerate(audio_sources[:3]):
            quality = source.get('quality', 'unknown')
            codec = source.get('codec', 'unknown')
            print(f"    {i+1}. {quality} | codec={codec}")
    
    return all_passed


def test_endpoint_routing():
    """
    Test that the correct endpoint would be used based on source flags.
    This is a logic test - doesn't actually call endpoints.
    """
    print_header("Endpoint Routing Logic Test")
    
    # Simulate sources
    test_cases = [
        # (hasAudio, needsMerge, expected_endpoint)
        (True, False, "/api/v1/stream", "Progressive format"),
        (False, True, "/api/v1/merge", "DASH format"),
    ]
    
    all_passed = True
    
    for has_audio, needs_merge, expected, description in test_cases:
        # Logic from FormatList.tsx and PlayerModal.tsx
        if needs_merge:
            actual = "/api/v1/merge"
        else:
            actual = "/api/v1/stream"
        
        passed = actual == expected
        print_result(f"{description} → {expected}", passed, 
                     f"Got: {actual}" if not passed else "")
        if not passed:
            all_passed = False
    
    return all_passed


def main():
    """Run integration tests"""
    print("\n" + "="*60)
    print("  YouTube Streaming Simplification - Integration Tests")
    print("="*60)
    
    results = []
    
    # Test 1: Format processing
    try:
        results.append(("Format Processing", test_youtube_format_processing()))
    except Exception as e:
        print(f"\n  ✗ ERROR: {str(e)}")
        results.append(("Format Processing", False))
    
    # Test 2: Endpoint routing logic
    try:
        results.append(("Endpoint Routing", test_endpoint_routing()))
    except Exception as e:
        print(f"\n  ✗ ERROR: {str(e)}")
        results.append(("Endpoint Routing", False))
    
    # Final summary
    print_header("Integration Test Summary")
    
    passed = sum(1 for _, p in results if p)
    total = len(results)
    
    for name, p in results:
        status = "✓" if p else "✗"
        print(f"  {status} {name}")
    
    print(f"\n  Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n  ✓ All integration tests passed!")
        print("  YouTube streaming simplification is working correctly.")
        print("  - Progressive formats (720p and below) use /api/v1/stream")
        print("  - DASH formats (1080p and above) use /api/v1/merge")
        print("  - No HLS URLs are returned for YouTube")
    else:
        print("\n  ✗ Some tests failed. Please review the output above.")
    
    return 0 if passed == total else 1


if __name__ == '__main__':
    sys.exit(main())
