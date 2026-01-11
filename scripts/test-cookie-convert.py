#!/usr/bin/env python3
"""Test cookie conversion function"""

import sys
sys.path.insert(0, '.')

from api.extract import convert_cookie_to_netscape

# Test 1: Cookie header format
print("=" * 60)
print("TEST 1: Cookie header format")
print("=" * 60)

cookie_header = "PREF=f4=4000000; LOGIN_INFO=AFmmF2swRg; HSID=An4icP5bxuI3Gd8VC; SSID=Aeym_5o1YxrcXelkQ"
result = convert_cookie_to_netscape(cookie_header, domain=".youtube.com")
print(result)
print()

# Test 2: JSON array format
print("=" * 60)
print("TEST 2: JSON array format")
print("=" * 60)

json_cookie = '''[
  {"domain": ".youtube.com", "name": "PREF", "value": "f4=4000000", "path": "/", "secure": true, "expirationDate": 1800000000},
  {"domain": ".youtube.com", "name": "LOGIN_INFO", "value": "AFmmF2swRg", "path": "/", "secure": true, "expirationDate": 1800000000}
]'''
result = convert_cookie_to_netscape(json_cookie)
print(result)
print()

# Test 3: Netscape format (should pass through)
print("=" * 60)
print("TEST 3: Netscape format (pass through)")
print("=" * 60)

netscape_cookie = """# Netscape HTTP Cookie File
# https://curl.haxx.se/rfc/cookie_spec.html

.youtube.com	TRUE	/	TRUE	1800000000	PREF	f4=4000000
.youtube.com	TRUE	/	TRUE	1800000000	LOGIN_INFO	AFmmF2swRg"""
result = convert_cookie_to_netscape(netscape_cookie)
print(result)
print()

# Test 4: Tab-separated without header
print("=" * 60)
print("TEST 4: Tab-separated without header")
print("=" * 60)

tab_cookie = """.youtube.com	TRUE	/	TRUE	1800000000	PREF	f4=4000000
.youtube.com	TRUE	/	TRUE	1800000000	LOGIN_INFO	AFmmF2swRg"""
result = convert_cookie_to_netscape(tab_cookie)
print(result)
print()

print("All tests completed!")
