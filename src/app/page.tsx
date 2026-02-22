'use client';

import { useState, useCallback } from 'react';
import {
  ExtractForm,
  ResultCard,
  FormatList,
  PlayerModal,
  CookieModal,
  JsonOutput,
} from '@/components';
import {
  Download,
  FileText,
  Github,
  Link2,
  Triangle,
} from 'lucide-react';
import Image from 'next/image';
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
            <Image
              src="/icon.png"
              alt="Fetchtium"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <h1 className="text-lg font-semibold">Fetchtium</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/changelog"
              className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <FileText className="w-4 h-4" />
              Changelog
            </a>
            <a
              href="/docs"
              className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <FileText className="w-4 h-4" />
              API Docs
            </a>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="bg-zinc-900/50 border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <span>Powered by</span>
          <a
            href="https://github.com/risunCode"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            risunCode
          </a>
          <span>•</span>
          <a
            href="https://downaria.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Downaria
          </a>
        </div>
      </div>

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
                <Download className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
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
              <Link2 className="w-8 h-8 text-zinc-600" />
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
                  <Github className="w-5 h-5 text-zinc-500" />
                  <span>Source Code</span>
                </a>
                <a
                  href="https://downaria.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm transition-colors"
                >
                  <Triangle className="w-5 h-5 text-emerald-400" />
                  <span>Railway <span className="text-emerald-400 text-xs ml-1">• Full Support</span></span>
                </a>
                <a
                  href="https://fetchtiumv2.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm transition-colors"
                  title="Native extractors only (Facebook, Instagram, TikTok, Twitter)"
                >
                  <Triangle className="w-5 h-5 text-zinc-400" />
                  <span>Vercel <span className="text-amber-400 text-xs ml-1">• Native Only</span></span>
                </a>
              </div>
            </div>

            {/* Right: Platforms */}
            <div>
              <h3 className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-4">Supported Platforms</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-zinc-600 text-xs mb-2">Native (5)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Facebook', 'Instagram', 'TikTok', 'Twitter', 'Pixiv'].map(p => (
                      <span key={p} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400 text-xs">{p}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-zinc-600 text-xs mb-2">Python Wrapper (10)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['YouTube', 'BiliBili', 'SoundCloud', 'Twitch', 'Bandcamp', 'Reddit', 'Pinterest', 'Weibo'].map(p => (
                      <span key={p} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-400 text-xs">{p}</span>
                    ))}
                    {['Eporner', 'Rule34'].map(p => (
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
