# Configuration

Copy `.env.example` to `.env.local` and adjust values.

## Core Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Next.js server port |
| `NODE_ENV` | `development` | Node environment |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed origins |
| `API_KEYS` | `ftm_your_api_key_here` | Optional API key list |
| `REQUEST_TIMEOUT` | `30000` | Outbound request timeout (ms) |
| `RATE_LIMIT_ENABLED` | `true` | Toggle middleware rate limit |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Rate window (ms) |
| `PYTHON_SERVER_PORT` | `3001` | Python service port (dev) |
| `FLASK_DEBUG` | `false` | Python debug mode |

## Extractor Profile Variables

| Variable | Values | Purpose |
| --- | --- | --- |
| `EXTRACTOR_PROFILE` | `vercel` or `full` | Force runtime capability profile |
| `PYTHON_API_URL` | URL | Optional external Python service URL |

Profile resolution order:

1. `EXTRACTOR_PROFILE`
2. `VERCEL` / `VERCEL_ENV` auto-detect
3. `full`

## Example `.env.local`

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
API_KEYS=ftm_local_key
REQUEST_TIMEOUT=30000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
PYTHON_SERVER_PORT=3001
FLASK_DEBUG=false
EXTRACTOR_PROFILE=full
PYTHON_API_URL=http://127.0.0.1:3001
```

## Behavior Notes

- In `vercel` profile, Python platforms are blocked at extract route.
- In `full` profile, Python platforms are forwarded to Python `/api/extract`.
- Error code used for profile limitation:
  - `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`
