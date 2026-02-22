'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const NATIVE_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'twitter', 'pixiv'] as const;
const WRAPPER_PLATFORMS = [
  'youtube',
  'bilibili',
  'soundcloud',
  'twitch',
  'bandcamp',
  'reddit',
  'pinterest',
  'weibo',
  'eporner',
  'rule34video',
] as const;

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [children]);

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm">
        <code className="font-mono text-zinc-300">{children}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded-md bg-zinc-800 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  const color = method === 'POST'
    ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
    : 'border-blue-500/30 bg-blue-500/20 text-blue-400';

  return <span className={`rounded border px-2 py-0.5 text-xs font-bold ${color}`}>{method}</span>;
}

export default function DocsPage() {
  const [baseUrl, setBaseUrl] = useState('https://fetchtiumv2.up.railway.app');
  const [extractors, setExtractors] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch('/api/v1/status', { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled && data?.success && Array.isArray(data.extractors)) {
          setExtractors(data.extractors.map((item: string) => item.toLowerCase()));
        }
      } catch {
        if (!cancelled) {
          setExtractors([...NATIVE_PLATFORMS]);
        }
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const supportedSet = useMemo(() => new Set(extractors), [extractors]);
  const nativeShown = useMemo(
    () => NATIVE_PLATFORMS.filter((platform) => supportedSet.has(platform)),
    [supportedSet]
  );
  const wrappersShown = useMemo(
    () => WRAPPER_PLATFORMS.filter((platform) => supportedSet.has(platform)),
    [supportedSet]
  );
  const isFullProfile = wrappersShown.length > 0;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800/50 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify_center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <span className="text-lg font-semibold">Fetchtium</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-sm text-zinc-400">API Documentation</span>
          </div>
          <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-white">Back</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="mb-12">
          <h1 className="mb-4 text-3xl font-bold sm:text-4xl">API Reference</h1>
          <p className="max-w-3xl text-lg text-zinc-400">
            Public media extraction API with consistent response shape and environment-aware extractor capability.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-xl font-semibold">Quick Start</h2>
          <div className="space-y-4">
            <CodeBlock>{`# cURL
curl -X POST ${baseUrl}/api/v1/extract \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://youtube.com/watch?v=dQw4w9WgXcQ"}'`}</CodeBlock>
            <CodeBlock>{`# PowerShell
$body = @{ url = "https://youtube.com/watch?v=dQw4w9WgXcQ" } | ConvertTo-Json
Invoke-RestMethod -Uri "${baseUrl}/api/v1/extract" -Method POST -Body $body -ContentType "application/json"`}</CodeBlock>
          </div>
        </section>

        <section className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-3 text-xl font-semibold">Access Model</h2>
            <p className="mb-3 text-zinc-400">All endpoints are public. API key is not required.</p>
            <ul className="space-y-1 text-sm text-zinc-500">
              <li>- Hardcoded limit: <code className="text-zinc-300">/api/v1/extract</code> = 10 requests/minute per IP</li>
              <li>- Streaming/proxy routes use higher limits for stable playback</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-3 text-xl font-semibold">Deployment Profile</h2>
            <p className="mb-3 text-zinc-400">
              Active profile: <span className={isFullProfile ? 'text-emerald-400' : 'text-amber-400'}>{isFullProfile ? 'full' : 'vercel'}</span>
            </p>
            <ul className="space-y-1 text-sm text-zinc-500">
              <li>- `vercel` profile: native extractors only</li>
              <li>- `full` profile: native + Python wrappers</li>
              <li>- Unsupported-by-deployment requests return <code className="text-zinc-300">PLATFORM_UNAVAILABLE_ON_DEPLOYMENT</code></li>
            </ul>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-xl font-semibold">Supported Platforms (Live)</h2>
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div>
              <p className="mb-2 text-sm text-zinc-500">Native ({nativeShown.length})</p>
              <div className="flex flex-wrap gap-2">
                {nativeShown.map((platform) => (
                  <span key={platform} className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                    {platform}
                  </span>
                ))}
              </div>
            </div>
            {wrappersShown.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-zinc-500">Python wrappers ({wrappersShown.length})</p>
                <div className="flex flex-wrap gap-2">
                  {wrappersShown.map((platform) => (
                    <span key={platform} className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs text-blue-400">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!isFullProfile && (
              <p className="text-sm text-zinc-500">
                Full wrapper platform coverage is available on Railway/Docker deployment profile.
              </p>
            )}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-xl font-semibold">Endpoints</h2>
          <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="border-b border-zinc-800 p-6">
              <div className="mb-2 flex items-center gap-3">
                <MethodBadge method="POST" />
                <code className="text-lg font-mono">/api/v1/extract</code>
              </div>
              <p className="text-zinc-400">Extract media metadata from a supported URL.</p>
            </div>
            <div className="space-y-6 p-6">
              <div>
                <h4 className="mb-3 text-sm font-medium uppercase text-zinc-500">Request Body</h4>
                <CodeBlock>{`{
  "url": "https://...",
  "cookie": "..." // optional
}`}</CodeBlock>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-medium uppercase text-zinc-500">Error Response</h4>
                <CodeBlock>{`{
  "success": false,
  "error": {
    "code": "PLATFORM_UNAVAILABLE_ON_DEPLOYMENT",
    "message": "This platform is available on Railway/Docker deployment."
  },
  "meta": {
    "responseTime": 4,
    "accessMode": "public",
    "publicContent": true
  }
}`}</CodeBlock>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { method: 'GET' as const, path: '/api/v1/stream', desc: 'Proxy stream for media playback' },
              { method: 'GET' as const, path: '/api/v1/download', desc: 'Download with filename header' },
              { method: 'GET' as const, path: '/api/v1/merge', desc: 'Merge separate video and audio streams' },
              { method: 'GET' as const, path: '/api/v1/thumbnail', desc: 'Proxy thumbnail images' },
              { method: 'GET' as const, path: '/api/v1/status', desc: 'Server status and supported platform list' },
              { method: 'GET' as const, path: '/api/health', desc: 'Health check endpoint' },
            ].map((endpoint) => (
              <div key={endpoint.path} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <MethodBadge method={endpoint.method} />
                  <code className="font-mono text-sm">{endpoint.path}</code>
                </div>
                <p className="text-sm text-zinc-500">{endpoint.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-6 text-xl font-semibold">Error Codes</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="p-4 text-left font-medium text-zinc-500">Code</th>
                  <th className="p-4 text-left font-medium text-zinc-500">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <tr><td className="p-4 font-mono text-red-400">INVALID_URL</td><td className="p-4 text-zinc-400">URL format is invalid</td></tr>
                <tr><td className="p-4 font-mono text-red-400">UNSUPPORTED_PLATFORM</td><td className="p-4 text-zinc-400">Platform is not supported</td></tr>
                <tr><td className="p-4 font-mono text-red-400">PLATFORM_UNAVAILABLE_ON_DEPLOYMENT</td><td className="p-4 text-zinc-400">Platform exists but is disabled on current deployment profile</td></tr>
                <tr><td className="p-4 font-mono text-red-400">RATE_LIMITED</td><td className="p-4 text-zinc-400">Too many requests in current window</td></tr>
                <tr><td className="p-4 font-mono text-red-400">EXTRACTION_FAILED</td><td className="p-4 text-zinc-400">Extraction process failed</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-zinc-800/50">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-zinc-600 sm:px-6">
          Fetchtium v2 | Built with Next.js App Router
        </div>
      </footer>
    </div>
  );
}
