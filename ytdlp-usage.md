# yt-dlp Usage Reference

Reference for audio/video download, merge, and stream flows used by FetchtiumV2.

## 1) Audio Download (MP3/M4A)

### Direct yt-dlp CLI
```bash
# MP3
yt-dlp --no-playlist -x --audio-format mp3 --audio-quality 0 -o "%(title)s.%(ext)s" "<watch_url>"

# M4A
yt-dlp --no-playlist -x --audio-format m4a --audio-quality 0 -o "%(title)s.%(ext)s" "<watch_url>"
```

### FetchtiumV2 API
```bash
# YouTube watch URL fast path (audio)
curl "https://fetchtiumv2.vercel.app/api/v1/download?url=<watch_url>&type=audio&format=mp3&filename=audio.mp3"

curl "https://fetchtiumv2.vercel.app/api/v1/download?url=<watch_url>&type=audio&format=m4a&filename=audio.m4a"
```

## 2) Video Download

### Direct yt-dlp CLI
```bash
yt-dlp --no-playlist -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" --merge-output-format mp4 -o "%(title)s.%(ext)s" "<watch_url>"
```

### FetchtiumV2 API
```bash
# Direct/proxy file download
curl "https://fetchtiumv2.vercel.app/api/v1/download?url=<media_url>&filename=video.mp4"

# YouTube watch URL fast path (video)
curl "https://fetchtiumv2.vercel.app/api/v1/download?url=<watch_url>&quality=1080p&filename=video.mp4"
```

## 3) Merge (Video + Audio)

### Direct yt-dlp CLI (watch URL)
```bash
yt-dlp --no-playlist -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "%(title)s.%(ext)s" "<watch_url>"
```

### FetchtiumV2 API
```bash
# Merge split URLs
curl "https://fetchtiumv2.vercel.app/api/v1/merge?videoUrl=<video_url>&audioUrl=<audio_url>&filename=merged.mp4"

# Merge by hashed URLs from extraction result
curl "https://fetchtiumv2.vercel.app/api/v1/merge?videoH=<video_hash>&audioH=<audio_hash>&filename=merged.mp4"
```

## 4) Stream

### FetchtiumV2 API
```bash
# Playback stream/proxy
curl "https://fetchtiumv2.vercel.app/api/v1/stream?url=<media_url>"

# HLS/DASH to progressive stream (server-side FFmpeg)
curl "https://fetchtiumv2.vercel.app/api/v1/hls-stream?url=<manifest_or_segment_url>&type=video"
```

## Notes

- For YouTube audio speed, prefer `url + type=audio + format=mp3|m4a`.
- Use hash parameters (`h`, `videoH`, `audioH`) when available from extract response.
- Audio output extension should match requested format to avoid mismatched file types.
