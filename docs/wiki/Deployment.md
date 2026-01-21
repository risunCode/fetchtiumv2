# Deployment

## Deployment Options

| Platform | FFmpeg | Python | Recommended |
|----------|--------|--------|-------------|
| Railway | ✅ Full | ✅ Full | ⭐ Best |
| Docker | ✅ Full | ✅ Full | ⭐ Best |
| Vercel | ❌ Limited | ✅ Full | Good |
| Fly.io | ✅ Full | ✅ Full | Good |

---

## Railway (Recommended)

Railway provides full support including FFmpeg for video-audio merge and HLS transcoding.

### Deploy via GitHub

1. Connect your GitHub repository to Railway
2. Railway auto-detects Next.js and Python
3. Set environment variables in Railway dashboard

### Environment Variables

```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-app.railway.app
RATE_LIMIT_ENABLED=true
API_KEYS=ftm_your_production_key
```

### railway.json

```json
{
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

---

## Vercel

Vercel supports all extractors but has limitations:

**Supported:**
- ✅ All TypeScript extractors (Facebook, Instagram, Twitter, TikTok, Pixiv)
- ✅ All Python extractors (YouTube, SoundCloud, BiliBili, etc.)

**Not Supported:**
- ❌ BiliBili video+audio merge (requires FFmpeg)
- ❌ YouTube HLS transcoding (requires FFmpeg)
- ❌ SoundCloud Opus playback (requires FFmpeg)

### Deploy

1. Connect GitHub repository to Vercel
2. Vercel auto-detects Next.js
3. Python functions deploy automatically from `api/` folder

### vercel.json

```json
{
  "functions": {
    "api/extract.py": {
      "runtime": "python3.12"
    }
  }
}
```

### Environment Variables

Set in Vercel Dashboard → Project Settings → Environment Variables:

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://your-app.vercel.app
```

---

## Docker

### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Install Python and FFmpeg
RUN apk add --no-cache python3 py3-pip ffmpeg

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --break-system-packages -r requirements.txt

# Install Node dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  fetchtium:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - ALLOWED_ORIGINS=http://localhost:3000
      - RATE_LIMIT_ENABLED=true
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Build and Run

```bash
# Build image
docker build -t fetchtiumv2 .

# Run container
docker run -d \
  --name fetchtium \
  -p 3000:3000 \
  -e NODE_ENV=production \
  fetchtiumv2

# With docker-compose
docker-compose up -d
```

---

## Fly.io

### fly.toml

```toml
app = "fetchtiumv2"
primary_region = "sin"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true

[[services]]
  protocol = "tcp"
  internal_port = 3000

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.http_checks]]
    interval = 10000
    timeout = 2000
    path = "/health"
```

### Deploy

```bash
fly launch
fly deploy
```

---

## Reverse Proxy

### Nginx

```nginx
upstream fetchtium {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://fetchtium;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # Streaming support
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

### Caddy

```caddyfile
api.example.com {
    reverse_proxy localhost:3000 {
        header_up X-Forwarded-Proto {scheme}
        flush_interval -1
    }
}
```

---

## Health Checks

```bash
# Simple health check
curl -f http://localhost:3000/health

# Detailed status
curl http://localhost:3000/api/v1/status
```

---

## Monitoring

### SSE Status

The UI uses Server-Sent Events to show warm/cold status:
- **Warm**: Server has received requests recently (< 5 minutes)
- **Cold**: Server may need to warm up

### Logging

Logs are output to stdout in JSON format:
```json
{"level":"info","module":"extract","message":"Extraction successful","platform":"twitter","items":1}
```

---

## Security Checklist

### Rate Limiting
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW=60000
```

### CORS
```env
ALLOWED_ORIGINS=https://myapp.com
```

### API Keys
```env
API_KEYS=ftm_production_key_1,ftm_production_key_2
```

### URL Encryption
```env
URL_ENCRYPT_KEY=your_32_char_hex_key
```

---

## Troubleshooting

### FFmpeg Not Found

```bash
# Check FFmpeg installation
ffmpeg -version

# Install on Ubuntu
sudo apt install ffmpeg

# Install on macOS
brew install ffmpeg
```

### Python Dependencies

```bash
# Check yt-dlp
yt-dlp --version

# Check gallery-dl
gallery-dl --version

# Reinstall
pip install --upgrade yt-dlp gallery-dl
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Memory Issues

For large media files, increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```
