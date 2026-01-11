#!/usr/bin/env python3
"""Test audio formats from yt-dlp with and without cookie"""
import yt_dlp
import sys
sys.path.insert(0, 'api')
from extract import convert_cookie_to_netscape
import tempfile
import os

url = 'https://www.youtube.com/watch?v=FfyvKLn4SGw'

# Cookie header format (like browser sends)
cookie_header = "PREF=f4=4000000&f6=40000000&tz=Asia.Jakarta&f7=100; LOGIN_INFO=AFmmF2swRgIhAKNtgHoI7YF36rpCzR_LRoh74XWRoNdGVcgSvT35vPMdAiEAzZBB3ZL2AFSoEC97NYFLweYWEidbHnGzx9j9ksPSAXo:QUQ3MjNmeWhGUS1xSFJLY3RmclZhYk5FOUtiR1prdFU3TWI2dWNnVlU4ODlzd3dBMDVBR1pjZ0phWEFESWRJcjFfR3V2LXBaZ1ZvYVdhNmJQVVJRRHktUWxoV3BXcmg1aXNfUy16NmhCT1cwQV91RkhxSTNZRHVfX09BRHE0Tlg4a1FLOXgyYV8tcWE3dmQtSF9QaGJqclpvTGxwNkEwR1V3"

def test_formats(use_cookie=False):
    ydl_opts = {
        'quiet': True,
        'youtube_include_hls_manifest': True,
    }
    
    if use_cookie:
        # Convert to Netscape format
        netscape = convert_cookie_to_netscape(cookie_header, domain='www.youtube.com')
        fd, cookie_path = tempfile.mkstemp(suffix='.txt', prefix='ytdlp_cookie_')
        with os.fdopen(fd, 'w') as f:
            f.write(netscape)
        ydl_opts['cookiefile'] = cookie_path
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])
            
            audio_only = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
            progressive = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none']
            
            print(f"Total formats: {len(formats)}")
            print(f"Audio-only: {len(audio_only)}")
            print(f"Progressive: {len(progressive)}")
            
            if audio_only:
                print("Audio formats:")
                for f in audio_only:
                    print(f"  {f.get('format_id')}: {f.get('acodec')} {f.get('abr')}kbps")
    finally:
        if use_cookie:
            try:
                os.unlink(cookie_path)
            except:
                pass

print("=== WITHOUT COOKIE ===")
test_formats(use_cookie=False)

print("\n=== WITH COOKIE ===")
test_formats(use_cookie=True)
