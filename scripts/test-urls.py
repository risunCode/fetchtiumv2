#!/usr/bin/env python3
"""Quick test for specific URLs"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api', 'py'))
from extract import detect_platform, extract_with_ytdlp, extract_with_gallery_dl, YTDLP_PLATFORMS

def test_url(url):
    print(f"\n{'='*60}")
    print(f"URL: {url}")
    print('='*60)
    
    platform = detect_platform(url)
    print(f"Platform: {platform}")
    
    if not platform:
        print("ERROR: Platform not detected!")
        return
    
    try:
        if platform in YTDLP_PLATFORMS:
            print("Using: yt-dlp")
            result = extract_with_ytdlp(url)
        else:
            print("Using: gallery-dl")
            result = extract_with_gallery_dl(url)
        
        print("\nResult JSON:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    # Test URLs
    urls = [
        "https://soundcloud.com/wcymusicstudio/tiny7-but-you-say-u-don-believeyou-love-me-and-gave-me-everythinglyrics-videotiny7",
        "https://www.bilibili.tv/en/video/4788759250606592",
    ]
    
    for url in urls:
        test_url(url)
