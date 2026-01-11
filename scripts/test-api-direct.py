#!/usr/bin/env python3
"""Test API directly"""
import requests
import json

# Use the EXACT cookie string from browser (cookie header format)
cookie = "PREF=f4=4000000&f6=40000000&tz=Asia.Jakarta&f7=100; LOGIN_INFO=AFmmF2swRgIhAKNtgHoI7YF36rpCzR_LRoh74XWRoNdGVcgSvT35vPMdAiEAzZBB3ZL2AFSoEC97NYFLweYWEidbHnGzx9j9ksPSAXo:QUQ3MjNmeWhGUS1xSFJLY3RmclZhYk5FOUtiR1prdFU3TWI2dWNnVlU4ODlzd3dBMDVBR1pjZ0phWEFESWRJcjFfR3V2LXBaZ1ZvYVdhNmJQVVJRRHktUWxoV3BXcmg1aXNfUy16NmhCT1cwQV91RkhxSTNZRHVfX09BRHE0Tlg4a1FLOXgyYV8tcWE3dmQtSF9QaGJqclpvTGxwNkEwR1V3"
print(f"Cookie loaded: {len(cookie)} chars")

# Test Python backend directly
url = 'http://127.0.0.1:3001/api/extract'

# Test WITHOUT cookie
payload_no_cookie = {'url': 'https://www.youtube.com/watch?v=FfyvKLn4SGw'}
print("\n=== Testing WITHOUT cookie ===")
try:
    r = requests.post(url, json=payload_no_cookie, timeout=60)
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"Items count: {len(data.get('items', []))}")
    for item in data.get('items', []):
        print(f"  Item {item.get('index')}: type={item.get('type')} sources={len(item.get('sources', []))}")
except Exception as e:
    print(f"Error: {e}")

# Test WITH cookie
if cookie:
    payload_with_cookie = {'url': 'https://www.youtube.com/watch?v=FfyvKLn4SGw', 'cookie': cookie}
    print("\n=== Testing WITH cookie ===")
    try:
        r = requests.post(url, json=payload_with_cookie, timeout=60)
        data = r.json()
        print(f"Status: {r.status_code}")
        print(f"Items count: {len(data.get('items', []))}")
        for item in data.get('items', []):
            print(f"  Item {item.get('index')}: type={item.get('type')} sources={len(item.get('sources', []))}")
    except Exception as e:
        print(f"Error: {e}")

# Test Next.js API
url2 = 'http://127.0.0.1:3000/api/v1/extract'
print("\n=== Testing Next.js API (port 3000) ===")
try:
    r2 = requests.post(url2, json=payload, timeout=60)
    data2 = r2.json()
    print(f"Status: {r2.status_code}")
    print(f"Items count: {len(data2.get('items', []))}")
    for item in data2.get('items', []):
        print(f"  Item {item.get('index')}: type={item.get('type')} sources={len(item.get('sources', []))}")
except Exception as e:
    print(f"Error: {e}")
