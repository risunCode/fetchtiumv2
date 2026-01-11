#!/usr/bin/env python3
"""
Test script for YouTube streaming simplification.

Verifies:
1. Progressive formats returned for standard videos
2. DASH formats have needsMerge: true
3. No .m3u8 URLs in response
4. Audio sources included for DASH formats

Requirements: 1.1-1.3, 2.1-2.3, 3.1, 5.1-5.3, 6.1-6.3
"""

import sys
import os
import json

# Add the api directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from extract import (
    extract_with_ytdlp,
    process_youtube_formats,
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


def test_youtube_extraction(url: str, test_name: str = "YouTube Video"):
    """
    Test YouTube extraction and verify format processing.
    
    Returns dict with test results.
    """
    print_header(f"Testing: {test_name}")
    print(f"  URL: {url}")
    
    results = {
        'url': url,
        'test_name': test_name,
        'passed': True,
        'checks': {}
    }
    
    # Extract video info
    print("\n  Extracting...")
    result = extract_with_ytdlp(url)
    
    # Check extraction success
    if not result.get('success'):
        error = result.get('error', {})
        print_result("Extraction", False, f"Error: {error.get('code')} - {error.get('message')}")
        results['passed'] = False
        results['error'] = error
        return results
    
    print_result("Extraction", True, f"Platform: {result.get('platform')}")
    
    # Get video sources
    items = result.get('items', [])
    video_item = next((item for item in items if item.get('type') == 'video'), None)
    audio_item = next((item for item in items if item.get('type') == 'audio'), None)
    
    if not video_item:
        print_result("Video sources found", False, "No video item in response")
        results['passed'] = False
        return results
    
    video_sources = video_item.get('sources', [])
    audio_sources = audio_item.get('sources', []) if audio_item else []
    
    print(f"\n  Found {len(video_sources)} video sources, {len(audio_sources)} audio sources")
    
    # Check 1: No HLS URLs (.m3u8)
    hls_urls = [s for s in video_sources if '.m3u8' in s.get('url', '')]
    no_hls = len(hls_urls) == 0
    print_result("No HLS URLs (.m3u8)", no_hls, 
                 f"Found {len(hls_urls)} HLS URLs" if not no_hls else "")
    results['checks']['no_hls'] = no_hls
    if not no_hls:
        results['passed'] = False
    
    # Check 2: Progressive formats have hasAudio=true, needsMerge=false
    progressive_sources = [s for s in video_sources if s.get('hasAudio') == True]
    progressive_correct = all(
        s.get('needsMerge') == False 
        for s in progressive_sources
    )
    print_result("Progressive formats correct", progressive_correct,
                 f"{len(progressive_sources)} progressive sources")
    results['checks']['progressive_correct'] = progressive_correct
    if not progressive_correct:
        results['passed'] = False
    
    # Check 3: DASH formats have hasAudio=false, needsMerge=true
    dash_sources = [s for s in video_sources if s.get('hasAudio') == False]
    dash_correct = all(
        s.get('needsMerge') == True 
        for s in dash_sources
    )
    print_result("DASH formats correct", dash_correct,
                 f"{len(dash_sources)} DASH sources")
    results['checks']['dash_correct'] = dash_correct
    if not dash_correct:
        results['passed'] = False
    
    # Check 4: If DASH formats exist, audio sources should be available
    if dash_sources:
        has_audio_for_dash = len(audio_sources) > 0
        print_result("Audio sources for DASH merge", has_audio_for_dash,
                     f"{len(audio_sources)} audio sources available")
        results['checks']['audio_for_dash'] = has_audio_for_dash
        if not has_audio_for_dash:
            results['passed'] = False
    
    # Check 5: First source should be progressive if available (up to 720p)
    if progressive_sources:
        first_is_progressive = video_sources[0].get('hasAudio') == True
        print_result("Progressive format prioritized", first_is_progressive,
                     f"First source: {video_sources[0].get('quality')}, hasAudio={video_sources[0].get('hasAudio')}")
        results['checks']['progressive_priority'] = first_is_progressive
        if not first_is_progressive:
            results['passed'] = False
    
    # Print source details
    print("\n  Video Sources:")
    for i, source in enumerate(video_sources[:5]):  # Show first 5
        quality = source.get('quality', 'unknown')
        has_audio = source.get('hasAudio', False)
        needs_merge = source.get('needsMerge', False)
        url_preview = source.get('url', '')[:60] + '...' if source.get('url') else 'N/A'
        print(f"    {i+1}. {quality} | hasAudio={has_audio} | needsMerge={needs_merge}")
    
    if len(video_sources) > 5:
        print(f"    ... and {len(video_sources) - 5} more")
    
    if audio_sources:
        print("\n  Audio Sources:")
        for i, source in enumerate(audio_sources[:3]):  # Show first 3
            quality = source.get('quality', 'unknown')
            codec = source.get('codec', 'unknown')
            print(f"    {i+1}. {quality} | codec={codec}")
    
    # Summary
    print(f"\n  Overall: {'✓ PASSED' if results['passed'] else '✗ FAILED'}")
    
    return results


def main():
    """Run YouTube format tests"""
    print("\n" + "="*60)
    print("  YouTube Streaming Simplification - Format Tests")
    print("="*60)
    
    # Test URLs - using public YouTube videos
    test_cases = [
        # Standard video (should have progressive formats)
        ("https://www.youtube.com/watch?v=jNQXAC9IVRw", "Standard Video (Me at the zoo)"),
        # Popular video with multiple formats
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Popular Video (Rick Astley)"),
        # Short URL format (youtu.be)
        ("https://youtu.be/jNQXAC9IVRw", "Short URL Format (youtu.be)"),
    ]
    
    all_results = []
    
    for url, name in test_cases:
        try:
            result = test_youtube_extraction(url, name)
            all_results.append(result)
        except Exception as e:
            print(f"\n  ✗ ERROR: {str(e)}")
            all_results.append({
                'url': url,
                'test_name': name,
                'passed': False,
                'error': str(e)
            })
    
    # Final summary
    print_header("Test Summary")
    passed = sum(1 for r in all_results if r.get('passed'))
    total = len(all_results)
    
    for r in all_results:
        status = "✓" if r.get('passed') else "✗"
        print(f"  {status} {r.get('test_name')}")
    
    print(f"\n  Total: {passed}/{total} tests passed")
    
    # Return exit code
    return 0 if passed == total else 1


if __name__ == '__main__':
    sys.exit(main())
