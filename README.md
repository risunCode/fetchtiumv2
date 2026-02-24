# Fetchtium v2.0.0

Media extraction service built with Next.js App Router and TypeScript, with optional Python-backed wrapper extraction in `full` profile.

## Snapshot Scope

- Canonical extract endpoint is `POST /api/v1/extract`.
- Available runtime routes are under `src/app/api/**/route.ts`.
- This snapshot does **not** include a local `api/` Python module, so Python wrapper mode depends on a reachable Python service (`http://127.0.0.1:5000` in development, configurable by `PYTHON_API_URL` outside development).

## API Endpoints (Current)

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/extract` | Canonical public extraction route |
| GET | `/api/v1/status` | Service status and profile-aware platform list |
| GET | `/api/v1/stream` | Media stream proxy |
| GET | `/api/v1/download` | Download proxy with filename support and YouTube watch fast-path |
| GET | `/api/v1/hls-proxy` | HLS manifest/segment proxy |
| GET | `/api/v1/hls-stream` | HLS/DASH to progressive conversion |
| GET | `/api/v1/merge` | Split-stream merge and optional YouTube watch-url mode |
| GET | `/api/v1/thumbnail` | Thumbnail proxy |
| GET | `/api/changelog` | Changelog content |
| GET | `/api/health` | Health check |

Unavailable in this snapshot:

- `GET /api/v1/events`
- `POST /api/extract`

## YouTube Fast-Path Behavior

- `GET /api/v1/download` supports `watchUrl` (also `sourceUrl`/`watch`) and uses `yt-dlp` to fetch + merge to MP4 directly when the input is a YouTube watch/shorts URL.
- `GET /api/v1/merge` keeps normal split-stream behavior (`videoUrl` + `audioUrl`, or `videoH` + `audioH`) and also supports watch-url mode (`watchUrl`/`url`/`sourceUrl`/`watch`) when split inputs are not provided.
- `quality` can be passed to both fast paths to constrain selected height.

## Deployment Profiles

- `vercel`: native extractors only.
- `full`: native + Python platforms (only when Python API is reachable).
- If a Python platform is requested while Python is disabled, API returns `PLATFORM_UNAVAILABLE_ON_DEPLOYMENT` with HTTP 400.

## Local Run

```bash
npm install
cp .env.example .env.local
npm run dev:next
```

Optional Python dependencies (for external wrapper service):

```bash
pip install -r requirements.txt
```

## Dependency and Lint Notes

- ESLint stack is aligned with Next.js 16 (`eslint@9`, `eslint-config-next@16`, `core-web-vitals` + TypeScript configs).
- Dependency remediation includes a `minimatch` override under `eslint-config-next` in `package.json`.
- `npm audit --audit-level=high` reports `0 vulnerabilities` for this snapshot.
- `npm run lint` currently passes with warnings (no errors), so docs avoid claiming a fully warning-free lint state.

## Docs

- In-app docs: `/docs`
- Wiki docs: `docs/wiki/`

## License

GPL-3.0
