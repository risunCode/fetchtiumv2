# Configuration

Copy `.env.example` to `.env.local` and adjust values.

## Core Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Next.js server port |
| `NODE_ENV` | `development` | Node environment |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed origins |
| `REQUEST_TIMEOUT` | `30000` | Outbound request timeout (ms) |
| `RATE_LIMIT_ENABLED` | `true` | Toggle middleware rate limit |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Rate window (ms) |
| `PYTHON_SERVER_PORT` | `5000` | Python service listener port |
| `PYTHON_API_URL` | `http://127.0.0.1:5000` | Preferred Next.js target for Python forwarding |
| `NEXT_PUBLIC_PYTHON_API_URL` | `http://127.0.0.1:5000` | Fallback Next.js target for Python forwarding |
| `FLASK_DEBUG` | `false` | Python debug mode |

## Extractor Profile Variables

| Variable | Values | Purpose |
| --- | --- | --- |
| `EXTRACTOR_PROFILE` | `vercel` or `full` | Force runtime capability profile |

Profile resolution order:

1. `EXTRACTOR_PROFILE`
2. `VERCEL` / `VERCEL_ENV` auto-detect
3. `full`

## Example `.env.local`

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
REQUEST_TIMEOUT=30000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
PYTHON_SERVER_PORT=5000
FLASK_DEBUG=false
EXTRACTOR_PROFILE=full
PYTHON_API_URL=http://127.0.0.1:5000
NEXT_PUBLIC_PYTHON_API_URL=http://127.0.0.1:5000
```

## Behavior Notes

- In `vercel` profile, Python platforms are blocked at extract route.
- In `full` profile, Python platforms are forwarded to Python `/api/extract`.
- Next.js resolves Python endpoint in this order: `PYTHON_API_URL` -> `NEXT_PUBLIC_PYTHON_API_URL` -> `http://127.0.0.1:5000`.
- Error code used for profile limitation:
  - `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT`
