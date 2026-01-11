import sys
sys.path.insert(0, 'api')

import yt_dlp
from extract import transform_ytdlp_result

url = 'https://www.bilibili.tv/en/video/4788759250606592'

ydl_opts = {'quiet': True, 'no_warnings': True, 'noplaylist': True}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)
    result = transform_ytdlp_result(info, url)
    
    print('Items:', len(result.get('items', [])))
    for item in result.get('items', []):
        print(f"\nItem {item['index']} - Type: {item['type']}")
        for src in item.get('sources', []):
            print(f"  {src.get('quality')} - {src.get('resolution', 'N/A')} - {src.get('size', 0)//1024}KB")
