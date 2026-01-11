#!/usr/bin/env python3
"""
Test script for Pinterest video extraction
Run: python scripts/test-pinterest-video.py
"""

import sys
import os
import json

# Add api to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from extract import detect_platform, extract_with_gallery_dl

# Test URLs
TEST_URLS = [
    # Video pin (from user's test)
    'https://pin.it/3PcYXL6lu',
    # Regular image pin for comparison
    # 'https://www.pinterest.com/pin/123456789/',
]

def test_pinterest_video():
    """Test Pinterest video extraction"""
    print("\n=== Testing Pinterest Video Extraction ===")
    
    for url in TEST_URLS:
        print(f"\n  Testing: {url}")
        
        # Detect platform
        platform = detect_platform(url)
        print(f"  Platform: {platform}")
        
        if platform != 'pinterest':
            print(f"  ✗ Expected pinterest, got {platform}")
            continue
        
        try:
            result = extract_with_gallery_dl(url)
            
            if result.get('success'):
                print(f"  ✓ Success!")
                print(f"    Content Type: {result.get('contentType', 'N/A')}")
                print(f"    Title: {result.get('title', 'N/A')[:50]}...")
                print(f"    Author: {result.get('author', 'N/A')}")
                print(f"    Items: {len(result.get('items', []))}")
                
                for i, item in enumerate(result.get('items', [])):
                    print(f"\n    Item {i}:")
                    print(f"      Type: {item.get('type')}")
                    print(f"      Thumbnail: {item.get('thumbnail', 'N/A')[:50] if item.get('thumbnail') else 'N/A'}...")
                    
                    for j, source in enumerate(item.get('sources', [])):
                        print(f"      Source {j}:")
                        print(f"        Quality: {source.get('quality')}")
                        print(f"        MIME: {source.get('mime')}")
                        print(f"        URL: {source.get('url', 'N/A')[:80]}...")
                        if source.get('resolution'):
                            print(f"        Resolution: {source.get('resolution')}")
                
                # Check if video was detected
                if result.get('contentType') == 'video':
                    print("\n  ✓ Video pin detected correctly!")
                else:
                    print(f"\n  ⚠ Content type is '{result.get('contentType')}', expected 'video' for video pins")
                    
            else:
                error = result.get('error', {})
                print(f"  ✗ Failed: {error.get('code')} - {error.get('message')}")
                
        except Exception as e:
            print(f"  ✗ Exception: {e}")
            import traceback
            traceback.print_exc()

def main():
    print("=" * 60)
    print("Pinterest Video Extraction Test")
    print("=" * 60)
    
    test_pinterest_video()
    
    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)

if __name__ == '__main__':
    main()
