'use client';

import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

export default function ChangelogPage() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/changelog')
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setContent('Failed to load changelog');
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/50 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
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
            <span className="text-zinc-400 text-sm">Changelog</span>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full"></div>
          </div>
        ) : (
          <article className="changelog-content">
            <ReactMarkdown
              components={{
                h1: ({ children }: { children?: ReactNode }) => (
                  <h1 className="text-3xl font-bold mb-8 pb-4 border-b border-zinc-800">{children}</h1>
                ),
                h2: ({ children }: { children?: ReactNode }) => (
                  <h2 className="text-xl font-semibold mt-12 mb-4 text-blue-400">{children}</h2>
                ),
                h3: ({ children }: { children?: ReactNode }) => (
                  <h3 className="text-lg font-medium mt-6 mb-3 text-zinc-300">{children}</h3>
                ),
                p: ({ children }: { children?: ReactNode }) => (
                  <p className="text-zinc-400 leading-relaxed mb-4">{children}</p>
                ),
                ul: ({ children }: { children?: ReactNode }) => (
                  <ul className="list-disc list-inside space-y-1 mb-4 text-zinc-400">{children}</ul>
                ),
                li: ({ children }: { children?: ReactNode }) => (
                  <li className="text-zinc-400">{children}</li>
                ),
                strong: ({ children }: { children?: ReactNode }) => (
                  <strong className="text-zinc-200 font-semibold">{children}</strong>
                ),
                code: ({ className, children }: { className?: string; children?: ReactNode }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <code className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 overflow-x-auto my-4">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="text-amber-400 bg-zinc-800/50 px-1.5 py-0.5 rounded text-sm">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }: { children?: ReactNode }) => (
                  <pre className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto my-4">
                    {children}
                  </pre>
                ),
                a: ({ href, children }: { href?: string; children?: ReactNode }) => (
                  <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                hr: () => <hr className="border-zinc-800 my-8" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-zinc-600 text-sm">
          Fetchtium v2 • Built with Next.js + Python
        </div>
      </footer>
    </div>
  );
}
