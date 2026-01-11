#!/usr/bin/env python3
"""
Test YouTube DASH format handling.

Tests that:
1. DASH formats (1080p+) have needsMerge=true
2. Audio sources are available for DASH merge
3. Progressive formats are prioritized over DASH

Requirements: 2.1-2.4, 5.1-5.3
"""

import sys
import os

# Add the api directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from extract import extract_with_ytdlp


def print_header(text: str):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def print_result(label: str, passed: bool, details: str = ""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"  {status}: {label}")
    if details:
        print(f"         {details}")


def test_youtube_dash_formats():
    """
    Test YouTube DASH format handling with a popular video.
    Rick Astley - Never Gonna Give You Up has many format options.
    """
    print_header("YouTube DASH Format Test")
    
    # Use a popular video with many formats
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    print(f"  URL: {url}")
    
    print("\n  Extracting video info...")
    result = extract_with_ytdlp(url)
    
    if not result.get('success'):
        error = result.get('error', {})
        print_result("Extraction", False, f"Error: {error.get('code')} - {error.get('message')}")
        return False
    
    print_result("Extraction", True, f"Title: {result.get('title', 'N/A')[:40]}...")
    
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
    
    # Categorize sources
    progressive_sources = [s for s in video_sources if s.get('hasAudio') == True]
    dash_sources = [s for s in video_sources if s.get('hasAudio') == False]
    
    print(f"  Progressive sources: {len(progressive_sources)}")
    print(f"  DASH sources: {len(dash_sources)}")
    
    # Test 1: DASH formats have correct flags
    if dash_sources:
        dash_correct = all(s.get('needsMerge') == True for s in dash_sources)
        print_result("DASH formats have needsMerge=true - Req 2.2", dash_correct)
        if not dash_correct:
            all_passed = False
            for s in dash_sources:
                if s.get('needsMerge') != True:
                    print(f"         Bad source: {s.get('quality')} needsMerge={s.get('needsMerge')}")
    else:
        print_result("DASH formats found", True, "No DASH formats (all progressive)")
    
    # Test 2: Audio sources available for DASH merge
    if dash_sources:
        has_audio = len(audio_sources) > 0
        print_result("Audio sources for DASH merge - Req 2.3", has_audio,
                     f"{len(audio_sources)} audio sources")
        if not has_audio:
            all_passed = False
    
    # Test 3: Progressive formats prioritized
    if progressive_sources and video_sources:
        first_is_progressive = video_sources[0].get('hasAudio') == True
        print_result("Progressive format first - Req 5.1", first_is_progressive,
                     f"First: {video_sources[0].get('quality')}, hasAudio={video_sources[0].get('hasAudio')}")
        if not first_is_progressive:
            all_passed = False
    
    # Test 4: No HLS URLs
    hls_urls = [s for s in video_sources if '.m3u8' in s.get('url', '')]
    no_hls = len(hls_urls) == 0
    print_result("No HLS URLs - Req 3.1", no_hls)
    if not no_hls:
        all_passed = False
    
    # Print all sources
    print("\n  All Video Sources:")
    for i, source in enumerate(video_sources):
        quality = source.get('quality', 'unknown')
        has_audio = source.get('hasAudio', False)
        needs_merge = source.get('needsMerge', False)
        resolution = source.get('resolution', 'N/A')
        endpoint = "/api/v1/stream" if has_audio else "/api/v1/merge"
        print(f"    {i+1}. {quality:15} | {resolution:10} | hasAudio={str(has_audio):5} | needsMerge={str(needs_merge):5} | → {endpoint}")
    
    if audio_sources:
        print("\n  Audio Sources:")
        for i, source in enumerate(audio_sources):
            quality = source.get('quality', 'unknown')
            codec = source.get('codec', 'unknown')
            bitrate = source.get('bitrate', 'N/A')
            print(f"    {i+1}. {quality:20} | codec={codec:6} | bitrate={bitrate}")
    
    return all_passed


def main():
    print("\n" + "="*60)
    print("  YouTube DASH Format Integration Test")
    print("="*60)
    
    try:
        passed = test_youtube_dash_formats()
    except Exception as e:
        print(f"\n  ✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        passed = False
    
    print_header("Test Result")
    if passed:
        print("  ✓ All DASH format tests passed!")
    else:
        print("  ✗ Some tests failed.")
    
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
