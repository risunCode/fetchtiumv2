#!/usr/bin/env python3
"""Test yt-dlp with converted cookie"""

import sys
import tempfile
import os
sys.path.insert(0, '.')

from api.extract import convert_cookie_to_netscape
import yt_dlp

# Cookie header format (like from frontend)
cookie_header = "PREF=f4=4000000&f6=40000000&tz=Asia.Jakarta&f7=100; LOGIN_INFO=AFmmF2swRg; HSID=An4icP5bxuI3Gd8VC"

# Convert to Netscape
netscape = convert_cookie_to_netscape(cookie_header, domain=".youtube.com")
print("Converted cookie:")
print(netscape)
print()

# Write to temp file
fd, cookie_path = tempfile.mkstemp(suffix='.txt', prefix='ytdlp_cookie_')
with os.fdopen(fd, 'w') as f:
    f.write(netscape)

print(f"Cookie file: {cookie_path}")
print()

# Test with yt-dlp
ydl_opts = {
    'quiet': False,
    'no_warnings': False,
    'extract_flat': False,
    'noplaylist': True,
    'cookiefile': cookie_path,
}

url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        print("Extracting info...")
        info = ydl.extract_info(url, download=False)
        print(f"Title: {info.get('title')}")
        print(f"Formats: {len(info.get('formats', []))}")
except Exception as e:
    print(f"Error: {e}")
finally:
    # Cleanup
    try:
        os.unlink(cookie_path)
    except:
        pass
