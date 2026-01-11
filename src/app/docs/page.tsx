'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

// API Key for documentation
const DEMO_API_KEY = 'ftm_9e930c5e19b4edb497636944a053806f';
const BASE_URL = 'https://fetchtiumv2.up.railway.app';

function CodeBlock({ children, language = 'bash' }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  
  const copy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="relative group">
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-zinc-300 font-mono">{children}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  const color = method === 'POST' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-bold ${color}`}>
      {method}
    </span>
  );
}

export default function DocsPage() {
  const [copiedKey, setCopiedKey] = useState(false);
  
  const copyApiKey = useCallback(() => {
    navigator.clipboard.writeText(DEMO_API_KEY);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/50 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <span className="text-lg font-semibold">Fetchtium</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-400 text-sm">API Documentation</span>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">API Reference</h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Extract media from 16+ platforms with a single API call. 
            Simple REST endpoints, consistent JSON responses.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">⚡</span>
            Quick Start
          </h2>
          
          <div className="space-y-4">
            <p className="text-zinc-400">Extract media from any supported URL:</p>
            <CodeBlock>{`# PowerShell
$body = @{ url = "https://youtube.com/watch?v=dQw4w9WgXcQ" } | ConvertTo-Json
Invoke-RestMethod -Uri "${BASE_URL}/api/v1/extract" -Method POST -Body $body -ContentType "application/json"`}</CodeBlock>
            
            <CodeBlock>{`# cURL
curl -X POST ${BASE_URL}/api/v1/extract \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'`}</CodeBlock>
          </div>
        </section>

        {/* API Key */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400">🔑</span>
            Authentication
          </h2>
          
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <p className="text-zinc-400 mb-4">
              API key is optional for basic usage. Include it in the <code className="text-amber-400 bg-zinc-800 px-1.5 py-0.5 rounded">X-API-Key</code> header for higher rate limits.
            </p>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-sm text-emerald-400 overflow-x-auto">
                {DEMO_API_KEY}
              </div>
              <button
                onClick={copyApiKey}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-3 rounded-lg text-sm transition-colors shrink-0"
              >
                {copiedKey ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </section>

        {/* Main Endpoint */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">📡</span>
            Endpoints
          </h2>

          {/* Extract */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <MethodBadge method="POST" />
                <code className="text-lg font-mono">/api/v1/extract</code>
              </div>
              <p className="text-zinc-400">Extract media information from a URL</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-zinc-500 uppercase mb-3">Request Body</h4>
                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm">
                  <div className="text-zinc-400">{"{"}</div>
                  <div className="pl-4">
                    <span className="text-purple-400">"url"</span>: <span className="text-emerald-400">"https://..."</span> <span className="text-zinc-600">// required</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-purple-400">"cookie"</span>: <span className="text-emerald-400">"..."</span> <span className="text-zinc-600">// optional, for private content</span>
                  </div>
                  <div className="text-zinc-400">{"}"}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-500 uppercase mb-3">Response</h4>
                <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-zinc-300">{`{
  "success": true,
  "platform": "youtube",
  "contentType": "video",
  "title": "Video Title",
  "author": "Channel Name",
  "description": "...",
  "duration": 212,
  "items": [
    {
      "index": 0,
      "type": "video",
      "thumbnail": "https://...",
      "sources": [
        {
          "quality": "1080p",
          "url": "https://...",
          "mime": "video/mp4",
          "extension": "mp4",
          "filename": "video_1080p.mp4",
          "resolution": "1920x1080",
          "hasAudio": false,
          "needsMerge": true
        }
      ]
    },
    {
      "index": 1,
      "type": "audio",
      "sources": [...]
    }
  ],
  "meta": {
    "responseTime": 1234,
    "publicContent": true
  }
}`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Other Endpoints Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/stream</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Proxy stream for media playback</p>
              <code className="text-xs text-zinc-600 block">?url=https://...</code>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/download</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Download with filename</p>
              <code className="text-xs text-zinc-600 block">?url=...&filename=video.mp4</code>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/merge</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Merge video + audio streams</p>
              <code className="text-xs text-zinc-600 block">?video=...&audio=...</code>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/thumbnail</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Proxy thumbnails (Instagram)</p>
              <code className="text-xs text-zinc-600 block">?url=https://cdninstagram.com/...</code>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/status</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Server status & platforms</p>
              <code className="text-xs text-zinc-600 block">Returns supported platforms list</code>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/health</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Health check endpoint</p>
              <code className="text-xs text-zinc-600 block">Returns {"{ ok: true }"}</code>
            </div>
          </div>

          {/* Internal Endpoints */}
          <h3 className="text-lg font-medium mt-8 mb-4 text-zinc-400">Internal Endpoints</h3>
          <p className="text-zinc-500 text-sm mb-4">Used by the frontend for playback and download. Not intended for direct API usage.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/hls-stream</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Convert HLS/DASH to MP4 via FFmpeg</p>
              <code className="text-xs text-zinc-600 block">?url=...&type=video&audioUrl=...</code>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/hls-proxy</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">Proxy HLS manifest & segments (YouTube)</p>
              <code className="text-xs text-zinc-600 block">?url=...&type=manifest|segment</code>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <MethodBadge method="GET" />
                <code className="font-mono text-sm">/api/v1/events</code>
              </div>
              <p className="text-zinc-500 text-sm mb-3">SSE stream for server status</p>
              <code className="text-xs text-zinc-600 block">Server-Sent Events connection</code>
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400">🌐</span>
            Supported Platforms
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <h3 className="font-medium">Native Extractors</h3>
                <span className="text-zinc-600 text-xs">TypeScript</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Facebook', 'Instagram', 'TikTok', 'Twitter/X', 'Pixiv'].map(p => (
                  <span key={p} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm">{p}</span>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <h3 className="font-medium">Python Extractors</h3>
                <span className="text-zinc-600 text-xs">yt-dlp / gallery-dl</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['YouTube', 'BiliBili', 'SoundCloud', 'Twitch', 'Bandcamp', 'Reddit', 'Pinterest', 'Weibo', 'Eporner', 'Rule34'].map(p => (
                  <span key={p} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Error Codes */}
        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400">⚠️</span>
            Error Codes
          </h2>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 text-zinc-500 font-medium">Code</th>
                  <th className="text-left p-4 text-zinc-500 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <tr><td className="p-4 font-mono text-red-400">INVALID_URL</td><td className="p-4 text-zinc-400">URL format is invalid</td></tr>
                <tr><td className="p-4 font-mono text-red-400">UNSUPPORTED_PLATFORM</td><td className="p-4 text-zinc-400">Platform not supported</td></tr>
                <tr><td className="p-4 font-mono text-red-400">CONTENT_NOT_FOUND</td><td className="p-4 text-zinc-400">Content deleted or private</td></tr>
                <tr><td className="p-4 font-mono text-red-400">AUTH_REQUIRED</td><td className="p-4 text-zinc-400">Cookie required for private content</td></tr>
                <tr><td className="p-4 font-mono text-red-400">RATE_LIMITED</td><td className="p-4 text-zinc-400">Too many requests</td></tr>
                <tr><td className="p-4 font-mono text-red-400">EXTRACTION_FAILED</td><td className="p-4 text-zinc-400">Extraction error</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate Limits */}
        <section>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
            <h3 className="font-medium text-amber-400 mb-2">Rate Limits</h3>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• 100 requests/minute without API key</li>
              <li>• Higher limits with API key</li>
              <li>• Extraction may take 2-10s depending on platform</li>
            </ul>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-zinc-600 text-sm">
          Fetchtium v2 • Built with Next.js + Python
        </div>
      </footer>
    </div>
  );
}
