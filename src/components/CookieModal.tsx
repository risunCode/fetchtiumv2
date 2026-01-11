'use client';

import { useState, useEffect, useCallback } from 'react';

interface CookieModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok';

const PLATFORMS: Platform[] = ['facebook', 'instagram', 'twitter', 'tiktok'];

/**
 * Parse cookie string (JSON or Netscape format) to Netscape format
 * Returns unique cookies only (deduplicated by name)
 */
function parseCookies(text: string): { ok: true; data: string; count: number; format: string } | { ok: false; error: string } {
  const trimmed = text.trim();
  
  // Try JSON format
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      let data = JSON.parse(trimmed);
      if (!Array.isArray(data)) data = [data];
      
      // Deduplicate by cookie name (keep last occurrence)
      const cookieMap = new Map<string, typeof data[0]>();
      data.forEach((c: { name?: string; value?: string; domain?: string; path?: string; expirationDate?: number }) => {
        if (c.name && c.value) {
          cookieMap.set(c.name, c);
        }
      });
      
      const lines = ['# Netscape HTTP Cookie File'];
      cookieMap.forEach((c) => {
        lines.push([
          c.domain || '.facebook.com',
          'TRUE',
          c.path || '/',
          'TRUE',
          Math.floor(c.expirationDate || Date.now() / 1000 + 31536000),
          c.name,
          c.value,
        ].join('\t'));
      });
      
      return { ok: true, data: lines.join('\n'), count: cookieMap.size, format: 'JSON' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }
  
  // Try Netscape format
  const lines = trimmed
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.split('\t').length >= 7);
  
  if (lines.length > 0) {
    // Deduplicate by cookie name (column 6, 0-indexed = 5)
    const cookieMap = new Map<string, string>();
    lines.forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 7) {
        const name = parts[5];
        cookieMap.set(name, line);
      }
    });
    
    const uniqueLines = Array.from(cookieMap.values());
    return { ok: true, data: '# Netscape HTTP Cookie File\n' + uniqueLines.join('\n'), count: uniqueLines.length, format: 'Netscape' };
  }
  
  return { ok: false, error: 'Invalid format. Use JSON or Netscape format.' };
}

/**
 * Get cookie from localStorage
 */
function getCookie(platform: Platform): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`ck_${platform}`) || '';
}

/**
 * Save cookie to localStorage
 */
function saveCookie(platform: Platform, data: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`ck_${platform}`, data);
}

/**
 * Clear cookie from localStorage
 */
function clearCookie(platform: Platform): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`ck_${platform}`);
}

/**
 * Get actual cookie count for a platform (count unique cookie entries)
 */
function getCookieCount(platform: Platform): number {
  const cookie = getCookie(platform);
  if (!cookie) return 0;
  // Count lines that are actual cookies (not comments or empty)
  const lines = cookie.split('\n').filter(l => l.trim() && !l.startsWith('#') && l.split('\t').length >= 7);
  return lines.length;
}

/**
 * Get API key from localStorage
 */
function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('api_key') || '';
}

/**
 * Save API key to localStorage
 */
function saveApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem('api_key', key.trim());
  } else {
    localStorage.removeItem('api_key');
  }
}

export function CookieModal({ isOpen, onClose }: CookieModalProps) {
  const [activeTab, setActiveTab] = useState<'cookies' | 'apikey'>('cookies');
  const [platform, setPlatform] = useState<Platform>('facebook');
  const [cookieInput, setCookieInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [savedCounts, setSavedCounts] = useState<Record<Platform, number>>({
    facebook: 0,
    instagram: 0,
    twitter: 0,
    tiktok: 0,
  });
  const [hasApiKey, setHasApiKey] = useState(false);

  // Update saved counts
  const updateSavedCounts = useCallback(() => {
    setSavedCounts({
      facebook: getCookieCount('facebook'),
      instagram: getCookieCount('instagram'),
      twitter: getCookieCount('twitter'),
      tiktok: getCookieCount('tiktok'),
    });
    setHasApiKey(!!getApiKey());
  }, []);

  // Initialize counts on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      updateSavedCounts();
      setCookieInput('');
      setApiKeyInput(getApiKey());
      setStatus(null);
    }
  }, [isOpen, updateSavedCounts]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSaveCookie = useCallback(() => {
    if (!cookieInput.trim()) {
      setStatus({ type: 'info', message: 'Paste cookies first' });
      return;
    }

    const result = parseCookies(cookieInput);
    if (result.ok) {
      saveCookie(platform, result.data);
      setStatus({ type: 'success', message: `✓ Saved ${result.count} cookies (${result.format})` });
      updateSavedCounts();
      setCookieInput('');
    } else {
      setStatus({ type: 'error', message: result.error });
    }
  }, [cookieInput, platform, updateSavedCounts]);

  const handleClearCookie = useCallback(() => {
    clearCookie(platform);
    setStatus({ type: 'info', message: 'Cleared' });
    updateSavedCounts();
  }, [platform, updateSavedCounts]);

  const handleSaveApiKey = useCallback(() => {
    saveApiKey(apiKeyInput);
    setStatus({ type: 'success', message: apiKeyInput.trim() ? '✓ API key saved' : 'API key cleared' });
    updateSavedCounts();
  }, [apiKeyInput, updateSavedCounts]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="font-semibold">⚙️ Advanced Settings</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => { setActiveTab('cookies'); setStatus(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'cookies'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            🍪 Cookies
          </button>
          <button
            onClick={() => { setActiveTab('apikey'); setStatus(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'apikey'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            🔑 API Key
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {activeTab === 'cookies' ? (
            <>
              <p className="text-zinc-500 text-sm">
                Paste cookies (JSON/Netscape) for private content.
              </p>

              {/* Platform tabs */}
              <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`flex-1 py-2 rounded-lg text-sm capitalize transition-colors ${
                      platform === p
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Cookie input */}
              <textarea
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                placeholder="Paste cookies here..."
                className="w-full h-28 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              />

              {/* Status message */}
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

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCookie}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleClearCookie}
                  className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Saved cookies list */}
              <div className="pt-3 border-t border-zinc-800">
                <p className="text-zinc-500 text-xs mb-2">Saved:</p>
                <div className="text-sm space-y-1">
                  {PLATFORMS.map((p) => (
                    <div key={p} className="flex justify-between">
                      <span className="capitalize">{p}</span>
                      <span className={savedCounts[p] > 0 ? 'text-emerald-400' : 'text-zinc-600'}>
                        {savedCounts[p] > 0 ? `✓ ${savedCounts[p]}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-zinc-500 text-sm">
                API key for external access. Get one from the API docs.
              </p>

              {/* API Key input */}
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="ftm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />

              {/* Status message */}
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

              {/* Save button */}
              <button
                onClick={handleSaveApiKey}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Save API Key
              </button>

              {/* Current status */}
              <div className="pt-3 border-t border-zinc-800">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Status</span>
                  <span className={hasApiKey ? 'text-emerald-400' : 'text-zinc-600'}>
                    {hasApiKey ? '✓ Configured' : 'Not set'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CookieModal;


/**
 * Get saved cookie for a platform (exported for use in extraction)
 */
export function getSavedCookie(platform: Platform): string {
  return getCookie(platform);
}

/**
 * Get saved API key (exported for use in extraction)
 */
export function getSavedApiKey(): string {
  return getApiKey();
}

/**
 * Detect platform from URL
 * Matches patterns defined in Requirements 6.2, 6.3, 6.4
 */
export function detectPlatformFromUrl(url: string): Platform | null {
  const u = url.toLowerCase();
  // Facebook: facebook.com, fb.watch, fb.me
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.me')) return 'facebook';
  // Instagram: instagram.com, instagr.am
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  // Twitter: twitter.com, x.com, t.co
  if (u.includes('twitter.com') || u.includes('x.com') || u.includes('t.co')) return 'twitter';
  // TikTok: tiktok.com, vm.tiktok.com, vt.tiktok.com
  if (u.includes('tiktok.com') || u.includes('vm.tiktok.com') || u.includes('vt.tiktok.com')) return 'tiktok';
  return null;
}
