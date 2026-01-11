#!/usr/bin/env python3
"""Test transform with full cookie from browser"""
import sys
sys.path.insert(0, 'api')

import yt_dlp
import tempfile
import os
from extract import transform_ytdlp_result, process_youtube_formats, convert_cookie_to_netscape

url = 'https://www.youtube.com/watch?v=FfyvKLn4SGw'

# Full cookie from browser (1595 chars)
full_cookie = "PREF=f4=4000000&f6=40000000&tz=Asia.Jakarta&f7=100; LOGIN_INFO=AFmmF2swRgIhAKNtgHoI7YF36rpCzR_LRoh74XWRoNdGVcgSvT35vPMdAiEAzZBB3ZL2AFSoEC97NYFLweYWEidbHnGzx9j9ksPSAXo:QUQ3MjNmeWhGUS1xSFJLY3RmclZhYk5FOUtiR1prdFU3TWI2dWNnVlU4ODlzd3dBMDVBR1pjZ0phWEFESWRJcjFfR3V2LXBaZ1ZvYVdhNmJQVVJRRHktUWxoV3BXcmg1aXNfUy16NmhCT1cwQV91RkhxSTNZRHVfX09BRHE0Tlg4a1FLOXgyYV8tcWE3dmQtSF9QaGJqclpvTGxwNkEwR1V3; HSID=An4icP5bxuI3Gd8VC; SSID=Aeym_5o1YxrcXelkQ; APISID=yY5EJKY5ae8ERBer/AAED7VtRrJYMcPNHk; SAPISID=8Uwt-YkFLg2GQdv1/A48zjQfhpsOx0VX0N; __Secure-1PAPISID=8Uwt-YkFLg2GQdv1/A48zjQfhpsOx0VX0N; __Secure-3PAPISID=8Uwt-YkFLg2GQdv1/A48zjQfhpsOx0VX0N; SID=g.a0004gj54ICfwhAR1Exd8IWCZZDhlTLnWwlX2c2RqzeGkmr7k6UqrGfW-KkttFsSmSrvaHeHtgACgYKATkSARISFQHGX2Mi55ZzFa9QZxcGcZsJTTpqKxoVAUF8yKrrzyJK5h8mqTDai-Um5nda0076; __Secure-1PSID=g.a0004gj54ICfwhAR1Exd8IWCZZDhlTLnWwlX2c2RqzeGkmr7k6UqcL_3RrixQD5reub6vLjGFwACgYKAWoSARISFQHGX2MisjP4HAaneY3kPqNt-11GORoVAUF8yKoO3mfBLHlbQx2t_DUZhi1L0076; __Secure-3PSID=g.a0004gj54ICfwhAR1Exd8IWCZZDhlTLnWwlX2c2RqzeGkmr7k6UqaIN1vdiAp13GrAOgLKSN9AACgYKAQ0SARISFQHGX2MiTVPEf4ydLvFh2ufE5rKc4BoVAUF8yKrlNi94xoipPObVeXhwGRvN0076; __Secure-1PSIDTS=sidts-CjUB7I_69K0c7V2wMOQvRkt5zbkPS6mEKstGR7_1kQ1Tgs7yFVSatVx6vTc76m_sJluViEaqCxAA; __Secure-3PSIDTS=sidts-CjUB7I_69K0c7V2wMOQvRkt5zbkPS6mEKstGR7_1kQ1Tgs7yFVSatVx6vTc76m_sJluViEaqCxAA; SIDCC=AKEyXzWK1IWaMgw1UUjQTlJykzyDjoVjK4sRcUv69B-kaLFS6Ln_wT8S-4SVPGJ96-kPkiD_Cw; __Secure-1PSIDCC=AKEyXzUfe6g8hKQRlV6mgY_ZYGsPcfS4n2kRhl1JTIShKN5bwlGA5ZJLZJM-qw159EJu9SLBOQ; __Secure-3PSIDCC=AKEyXzWgzmA3Vz1Qp-6v4goRXy902olhkBRWjRSiOs8qG0VtrsZ2YcTdTd4EgP4FUy3cdBsfFw"

print(f"Cookie length: {len(full_cookie)}")

def test_with_cookie(cookie_str):
    ydl_opts = {
        'quiet': True,
        'youtube_include_hls_manifest': True,
    }
    
    cookie_path = None
    if cookie_str:
        netscape = convert_cookie_to_netscape(cookie_str, domain='www.youtube.com')
        print(f"\nNetscape cookie preview:\n{netscape[:500]}...")
        fd, cookie_path = tempfile.mkstemp(suffix='.txt', prefix='ytdlp_cookie_')
        with os.fdopen(fd, 'w') as f:
            f.write(netscape)
        ydl_opts['cookiefile'] = cookie_path
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])
            
            print(f"\nRaw formats: {len(formats)}")
            
            # Categorize
            audio_only = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
            progressive = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and '.m3u8' not in f.get('url', '')]
            hls = [f for f in formats if '.m3u8' in f.get('url', '')]
            dash_video = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') == 'none']
            
            print(f"Audio-only: {len(audio_only)}")
            print(f"Progressive: {len(progressive)}")
            print(f"HLS: {len(hls)}")
            print(f"DASH video-only: {len(dash_video)}")
            
            if audio_only:
                print("\nAudio formats:")
                for f in audio_only[:3]:
                    print(f"  {f.get('format_id')}: {f.get('acodec')} {f.get('abr')}kbps")
    finally:
        if cookie_path:
            try:
                os.unlink(cookie_path)
            except:
                pass

print("=== WITH FULL COOKIE ===")
test_with_cookie(full_cookie)
