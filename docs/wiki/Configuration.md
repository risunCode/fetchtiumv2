# Configuration

FetchtiumV2 is configured via environment variables. Copy `.env.example` to `.env.local` and customize as needed.

## Environment Variables

### Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment (`development`, `production`) |

### Access Control

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed CORS origins |
| `API_KEYS` | - | Comma-separated API keys for authentication |

### URL Encryption

| Variable | Default | Description |
|----------|---------|-------------|
| `URL_ENCRYPT_KEY` | - | 32-character hex key for URL encryption |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Window size in milliseconds |

### Python Server (Development)

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTHON_SERVER_PORT` | `3001` | Python Flask server port |
| `FLASK_DEBUG` | `false` | Enable Flask debug mode |

---

## Example .env.local File

```env
# Server
PORT=3000
NODE_ENV=development

# Access Control
ALLOWED_ORIGINS=http://localhost:3000,https://myapp.com
API_KEYS=ftm_your_api_key_here

# URL Encryption (generate with: openssl rand -hex 16)
URL_ENCRYPT_KEY=your_32_char_hex_key_here

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Python (dev only)
PYTHON_SERVER_PORT=3001
FLASK_DEBUG=false
```

---

## Generating API Keys

API keys should start with `ftm_` prefix:

```bash
# Generate a random API key
echo "ftm_$(openssl rand -hex 16)"
# Output: ftm_9e930c5e19b4edb497636944a053806f
```

Multiple keys can be configured:
```env
API_KEYS=ftm_key1,ftm_key2,ftm_key3
```

---

## Generating URL Encrypt Key

```bash
# Generate a 32-character hex key
openssl rand -hex 16
# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Rate Limiting

Rate limiting is per-IP and uses a sliding window:

- **Max requests**: Configurable via `RATE_LIMIT_MAX`
- **Window**: Configurable via `RATE_LIMIT_WINDOW` (milliseconds)

When rate limited, the API returns:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests"
  }
}
```

API key holders may have higher limits (configurable).

---

## CORS Configuration

Configure allowed origins for cross-origin requests:

```env
# Single origin
ALLOWED_ORIGINS=https://myapp.com

# Multiple origins
ALLOWED_ORIGINS=https://myapp.com,https://api.myapp.com,http://localhost:3000
```

---

## Production Configuration

```env
# Production settings
NODE_ENV=production

# Strict CORS
ALLOWED_ORIGINS=https://myapp.com

# Enable rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW=60000

# API keys for authenticated access
API_KEYS=ftm_production_key_1,ftm_production_key_2

# URL encryption
URL_ENCRYPT_KEY=your_production_key_here
```

---

## Vercel Configuration

For Vercel deployment, set environment variables in the Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add each variable with appropriate scope (Production/Preview/Development)

**Required for Vercel:**
```env
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.vercel.app
```

**Note:** Python functions on Vercel have limitations:
- No FFmpeg support (video-audio merge unavailable)
- No HLS transcoding

---

## Railway Configuration

Railway supports all features including FFmpeg:

1. Go to Project → Variables
2. Add environment variables

**Recommended for Railway:**
```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-app.railway.app
RATE_LIMIT_ENABLED=true
```

Railway automatically provides `PORT` and handles FFmpeg installation via Dockerfile.
