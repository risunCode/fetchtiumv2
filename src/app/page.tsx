'use client';

import { useState, useCallback } from 'react';
import {
  ExtractForm,
  ResultCard,
  FormatList,
  PlayerModal,
  CookieModal,
  StatusBadge,
  JsonOutput,
} from '@/components';
import { useExtract } from '@/hooks';

export default function Home() {
  // Extraction state
  const { isLoading, result, error, extract, reset } = useExtract();

  // Modal states
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<'video' | 'audio' | null>(null);
  const [playerMime, setPlayerMime] = useState<string | null>(null);
  const [playerThumbnail, setPlayerThumbnail] = useState<string | null>(null);
  const [playerAudioUrl, setPlayerAudioUrl] = useState<string | null>(null);
  const [playerNeedsProxy, setPlayerNeedsProxy] = useState<boolean>(false);

  // Handle extraction
  const handleExtract = useCallback((url: string) => {
    extract(url);
  }, [extract]);

  // Handle settings click (open cookie modal)
  const handleSettingsClick = useCallback(() => {
    setCookieModalOpen(true);
  }, []);

  // Handle play button click
  const handlePlay = useCallback((url: string, type: 'video' | 'audio', mime?: string, thumbnail?: string, audioUrl?: string, needsProxy?: boolean) => {
    setPlayerUrl(url);
    setPlayerType(type);
    setPlayerMime(mime || null);
    setPlayerThumbnail(thumbnail || null);
    setPlayerAudioUrl(audioUrl || null);
    setPlayerNeedsProxy(needsProxy || false);
    setPlayerModalOpen(true);
  }, []);

  // Close player modal
  const handleClosePlayer = useCallback(() => {
    setPlayerModalOpen(false);
    setPlayerUrl(null);
    setPlayerType(null);
    setPlayerMime(null);
    setPlayerThumbnail(null);
    setPlayerAudioUrl(null);
    setPlayerNeedsProxy(false);
  }, []);

  // Close cookie modal
  const handleCloseCookieModal = useCallback(() => {
    setCookieModalOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold">Fetchtium</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/docs"
              className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              API Docs
            </a>
            <StatusBadge />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Extract Form */}
        <ExtractForm
          onExtract={handleExtract}
          onSettingsClick={handleSettingsClick}
          isLoading={isLoading}
        />

        {/* Error Display */}
        {error && (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-400 font-medium">{error.error.code}</p>
                  <p className="text-red-400/80 text-sm mt-1">{error.error.message}</p>
                </div>
              </div>
            </div>
            <JsonOutput data={error} />
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            <ResultCard result={result} />
            <FormatList result={result} onPlay={handlePlay} />
            <JsonOutput data={result} />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !result && !error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-900 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h2 className="text-zinc-400 text-lg font-medium mb-2">Paste a URL to get started</h2>
            <p className="text-zinc-600 text-sm max-w-sm mx-auto">
              4 native extractors + 12 wrapper platforms. Extract videos, images, and audio.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 mt-auto safe-bottom">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Grid Layout: Links | Platforms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            {/* Left: Links & Deploy */}
            <div>
              <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-4">Links</h3>
              <div className="space-y-2">
                <a
                  href="https://github.com/nicepkg/FetchtiumV2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm transition-colors"
                >
                  <svg className="w-5 h-5 text-zinc-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>Source Code</span>
                </a>
                <a
                  href="https://fetchtiumv2.up.railway.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm transition-colors"
                >
                  <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.113 10.27A12.375 12.375 0 0 0 0 12c0 6.627 5.373 12 12 12 5.628 0 10.35-3.874 11.637-9.101l-6.769-6.769a3.745 3.745 0 0 0-5.3 0L.113 10.27zm23.774-1.37L13.13.143a.5.5 0 0 0-.707 0L.143 12.423a.5.5 0 0 0 0 .707l10.757 10.757a.5.5 0 0 0 .707 0L23.887 11.607a.5.5 0 0 0 0-.707z"/>
                  </svg>
                  <span>Railway <span className="text-emerald-400 text-xs ml-1">• Full Support</span></span>
                </a>
                <a
                  href="https://fetchtiumv2.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm transition-colors"
                  title="Native extractors only (Facebook, Instagram, TikTok, Twitter)"
                >
                  <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 22.525H0l12-21.05 12 21.05z"/>
                  </svg>
                  <span>Vercel <span className="text-amber-400 text-xs ml-1">• Native Only</span></span>
                </a>
              </div>
            </div>

            {/* Right: Platforms */}
            <div>
              <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-4">Supported Platforms</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-zinc-600 text-xs mb-2">Native (4)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Facebook', 'Instagram', 'TikTok', 'Twitter'].map(p => (
                      <span key={p} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400 text-xs">{p}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-zinc-600 text-xs mb-2">Python Wrapper (12)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['YouTube', 'BiliBili', 'SoundCloud', 'Twitch', 'Bandcamp', 'Reddit', 'Pinterest', 'Weibo'].map(p => (
                      <span key={p} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-400 text-xs">{p}</span>
                    ))}
                    {['Pixiv', 'Eporner', 'Rule34'].map(p => (
                      <span key={p} className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-xs" title="NSFW">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Copyright */}
          <div className="pt-6 border-t border-zinc-800/50 text-center text-zinc-600 text-xs">
            Fetchtium v2 • Media Extraction Tool
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PlayerModal
        isOpen={playerModalOpen}
        url={playerUrl}
        type={playerType}
        mime={playerMime}
        thumbnail={playerThumbnail}
        audioUrl={playerAudioUrl}
        needsProxy={playerNeedsProxy}
        onClose={handleClosePlayer}
      />
      <CookieModal
        isOpen={cookieModalOpen}
        onClose={handleCloseCookieModal}
      />
    </div>
  );
}
