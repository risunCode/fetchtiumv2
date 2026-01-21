# FetchtiumV2 Wiki

Welcome to the FetchtiumV2 documentation! FetchtiumV2 is a media extraction tool for 16+ social media platforms, built with Next.js, TypeScript, React, and Python.

## Quick Links

- [Getting Started](Getting-Started.md)
- [API Reference](API-Reference.md)
- [Supported Platforms](Supported-Platforms.md)
- [Configuration](Configuration.md)
- [Architecture](Architecture.md)
- [Deployment](Deployment.md)

## Overview

FetchtiumV2 extracts videos, images, and audio from social media platforms with a modern, responsive dark UI.

### Key Features

| Feature | Description |
|---------|-------------|
| 🎬 Media Extraction | Extract videos, images, audio from 16+ platforms |
| 🔒 Guest-First | Automatic cookie retry for private content |
| 📱 Responsive UI | Dark theme with real-time status |
| 🎵 Media Player | Built-in player with FFmpeg transcoding |
| 📦 Batch Download | Download all items from galleries |
| 🔄 SSE Status | Real-time warm/cold server indicator |
| 📖 API Docs | Interactive documentation with examples |

### Supported Platforms

**Native Extractors (TypeScript):**
- Facebook, Instagram, TikTok, Twitter/X, Pixiv

**Python Extractors (yt-dlp / gallery-dl):**
- YouTube, BiliBili, SoundCloud, Twitch, Bandcamp
- Reddit, Pinterest, Weibo
- Eporner, Rule34Video (NSFW)

## System Requirements

- Node.js 18+
- Python 3.10+
- FFmpeg (for HLS conversion and merge)
- yt-dlp (for video platforms)
- gallery-dl (for image platforms)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript + Python
- **Frontend**: React 19, Tailwind CSS
- **HTTP Client**: Undici (Node), httpx (Python)
- **Media Processing**: FFmpeg (ffmpeg-static)
- **Python Tools**: yt-dlp, gallery-dl, Flask
