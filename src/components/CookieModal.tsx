'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CookieModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Platform = 'facebook' | 'instagram' | 'twitter' | 'youtube';

const PLATFORMS: Platform[] = ['facebook', 'instagram', 'twitter', 'youtube'];

function parseCookies(
  text: string,
  platform: Platform
): { ok: true; data: string; count: number; format: string } | { ok: false; error: string } {
  const trimmed = text.trim();

  const defaultDomains: Record<Platform, string> = {
    facebook: '.facebook.com',
    instagram: '.instagram.com',
    twitter: '.twitter.com',
    youtube: '.youtube.com',
  };

  const defaultDomain = defaultDomains[platform];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      let data = JSON.parse(trimmed);
      if (!Array.isArray(data)) data = [data];

      const cookieMap = new Map<string, (typeof data)[0]>();
      data.forEach((cookie: {
        name?: string;
        value?: string;
        domain?: string;
        path?: string;
        expirationDate?: number;
        secure?: boolean;
      }) => {
        if (cookie.name && cookie.value) {
          cookieMap.set(cookie.name, cookie);
        }
      });

      const lines = ['# Netscape HTTP Cookie File'];
      cookieMap.forEach((cookie) => {
        lines.push(
          [
            cookie.domain || defaultDomain,
            'TRUE',
            cookie.path || '/',
            cookie.secure ? 'TRUE' : 'FALSE',
            Math.floor(cookie.expirationDate || Date.now() / 1000 + 31536000),
            cookie.name,
            cookie.value,
          ].join('\t')
        );
      });

      return { ok: true, data: lines.join('\n'), count: cookieMap.size, format: 'JSON' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON format' };
    }
  }

  const lines = trimmed
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#') && line.split('\t').length >= 7);

  if (lines.length > 0) {
    const cookieMap = new Map<string, string>();
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 7) {
        cookieMap.set(parts[5], line);
      }
    }

    const uniqueLines = Array.from(cookieMap.values());
    return {
      ok: true,
      data: '# Netscape HTTP Cookie File\n' + uniqueLines.join('\n'),
      count: uniqueLines.length,
      format: 'Netscape',
    };
  }

  return { ok: false, error: 'Invalid format. Use JSON or Netscape format.' };
}

function getCookie(platform: Platform): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`ck_${platform}`) || '';
}

function saveCookie(platform: Platform, data: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`ck_${platform}`, data);
}

function clearCookie(platform: Platform): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`ck_${platform}`);
}

function getCookieCount(platform: Platform): number {
  const cookie = getCookie(platform);
  if (!cookie) return 0;
  return cookie
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#') && line.split('\t').length >= 7).length;
}

function netscapeToCookieHeader(netscape: string): string {
  const lines = netscape.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
  const cookies: string[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 7) {
      cookies.push(`${parts[5]}=${parts[6]}`);
    }
  }

  return cookies.join('; ');
}

export function CookieModal({ isOpen, onClose }: CookieModalProps) {
  const [activeTab] = useState<'cookies'>('cookies');
  const [platform, setPlatform] = useState<Platform>('facebook');
  const [cookieInput, setCookieInput] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [savedCounts, setSavedCounts] = useState<Record<Platform, number>>({
    facebook: 0,
    instagram: 0,
    twitter: 0,
    youtube: 0,
  });

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const updateSavedCounts = useCallback(() => {
    setSavedCounts({
      facebook: getCookieCount('facebook'),
      instagram: getCookieCount('instagram'),
      twitter: getCookieCount('twitter'),
      youtube: getCookieCount('youtube'),
    });
  }, []);

  const requestClose = useCallback(() => {
    if (isClosing || !isRendered) return;
    setIsClosing(true);
    onClose();
  }, [isClosing, isRendered, onClose]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRendered(true);
      setIsClosing(false);
      updateSavedCounts();
      setCookieInput('');
      setStatus(null);
      return;
    }

    if (!isRendered || isClosing) return;

    setIsClosing(true);
  }, [isClosing, isOpen, isRendered, updateSavedCounts]);

  useEffect(() => {
    if (!isRendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isRendered]);

  useEffect(() => {
    if (isRendered && !isClosing) {
      closeButtonRef.current?.focus();
    }
  }, [isClosing, isRendered]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isRendered) {
        requestClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isRendered, requestClose]);

  const handleCloseAnimationEnd = useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      if (!isClosing || event.animationName !== 'modal-panel-out') return;

      setIsRendered(false);
      setIsClosing(false);
    },
    [isClosing]
  );

  const handleSaveCookie = useCallback(() => {
    if (!cookieInput.trim()) {
      setStatus({ type: 'info', message: 'Paste cookies first.' });
      return;
    }

    const result = parseCookies(cookieInput, platform);
    if (!result.ok) {
      setStatus({ type: 'error', message: result.error });
      return;
    }

    saveCookie(platform, result.data);
    setStatus({ type: 'success', message: `Saved ${result.count} cookies (${result.format}).` });
    setCookieInput('');
    updateSavedCounts();
  }, [cookieInput, platform, updateSavedCounts]);

  const handleClearCookie = useCallback(() => {
    clearCookie(platform);
    setStatus({ type: 'info', message: 'Cookie cleared.' });
    updateSavedCounts();
  }, [platform, updateSavedCounts]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        requestClose();
      }
    },
    [requestClose]
  );

  if (!isRendered) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`}
      style={{ background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(8px)' }}
      onClick={handleBackdropClick}
    >
      <div
        className={`w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-[0_28px_90px_rgba(0,0,0,0.55)] ring-1 ring-zinc-700/40 ${isClosing ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
        onAnimationEnd={handleCloseAnimationEnd}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800/80 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/90 shadow-[0_0_10px_rgba(248,113,113,0.45)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.4)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-[0_0_10px_rgba(74,222,128,0.4)]" />
            </div>
            <h3 id="cookie-modal-title" className="font-semibold">Advanced Settings</h3>
          </div>
          <button
            ref={closeButtonRef}
            onClick={requestClose}
            className="touch-target rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <>
            <p className="text-sm text-zinc-500">Paste cookies (JSON or Netscape) for private content.</p>

            <div className="flex gap-1 rounded-xl bg-zinc-800 p-1">
              {PLATFORMS.map((item) => (
                <button
                  key={item}
                  onClick={() => setPlatform(item)}
                  className={`flex-1 rounded-lg py-2 text-sm capitalize transition-colors ${
                    platform === item
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {platform === 'youtube' && savedCounts.youtube > 0 ? (
              <div className="flex h-28 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2">
                <div className="text-center">
                  <p className="text-sm text-emerald-400">YouTube cookie configured</p>
                  <p className="mt-1 text-xs text-zinc-500">Clear to reconfigure</p>
                </div>
              </div>
            ) : (
              <textarea
                value={cookieInput}
                onChange={(event) => setCookieInput(event.target.value)}
                placeholder="Paste cookies here..."
                className="h-28 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            )}

            {status && (
              <div
                className={`text-sm ${
                  status.type === 'success'
                    ? 'text-emerald-400'
                    : status.type === 'error'
                      ? 'text-red-400'
                      : 'text-amber-400'
                }`}
              >
                {status.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveCookie}
                disabled={platform === 'youtube' && savedCounts.youtube > 0}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  platform === 'youtube' && savedCounts.youtube > 0
                    ? 'cursor-not-allowed bg-zinc-700 text-zinc-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                Save
              </button>
              <button
                onClick={handleClearCookie}
                className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm transition-colors hover:bg-zinc-700"
              >
                Clear
              </button>
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <p className="mb-2 text-xs text-zinc-500">Saved:</p>
              <div className="space-y-1 text-sm">
                {PLATFORMS.map((item) => (
                  <div key={item} className="flex justify-between">
                    <span className="capitalize">{item}</span>
                    <span className={savedCounts[item] > 0 ? 'text-emerald-400' : 'text-zinc-600'}>
                      {savedCounts[item] > 0 ? `OK ${savedCounts[item]}` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
}

export default CookieModal;

export function getSavedCookie(platform: Platform): string {
  const netscape = getCookie(platform);
  if (!netscape) return '';
  return netscapeToCookieHeader(netscape);
}

export function detectPlatformFromUrl(url: string): Platform | null {
  const value = url.toLowerCase();
  if (value.includes('facebook.com') || value.includes('fb.watch') || value.includes('fb.me')) return 'facebook';
  if (value.includes('instagram.com') || value.includes('instagr.am')) return 'instagram';
  if (value.includes('twitter.com') || value.includes('x.com') || value.includes('t.co')) return 'twitter';
  if (value.includes('youtube.com') || value.includes('youtu.be') || value.includes('youtube-nocookie.com')) return 'youtube';
  return null;
}
