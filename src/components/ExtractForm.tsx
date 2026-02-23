'use client';

import { useState, useCallback, KeyboardEvent } from 'react';

interface ExtractFormProps {
  onExtract: (url: string) => void;
  onSettingsClick: () => void;
  isLoading: boolean;
}

/**
 * Sanitize URL input to prevent XSS and injection attacks
 */
function sanitizeUrl(input: string): string {
  if (!input) return '';
  
  let clean = input
    .replace(/[`${}]/g, '')           // Backticks, template literals
    .replace(/[<>]/g, '')             // HTML injection
    .replace(/[\x00-\x1f]/g, '')      // Control characters
    .replace(/javascript:/gi, '')      // JS protocol
    .replace(/data:/gi, '')           // Data protocol
    .replace(/file:/gi, '')           // File protocol
    .replace(/vbscript:/gi, '')       // VBScript
    .trim();
  
  // Must start with http:// or https://
  if (!/^https?:\/\//i.test(clean)) {
    if (/^www\./i.test(clean)) {
      clean = 'https://' + clean;
    } else if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(clean)) {
      clean = 'https://' + clean;
    }
  }
  
  return clean;
}

export function ExtractForm({ onExtract, onSettingsClick, isLoading }: ExtractFormProps) {
  const [url, setUrl] = useState('');

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const sanitized = sanitizeUrl(text);
      if (sanitized && /^https?:\/\//i.test(sanitized)) {
        setUrl(sanitized);
        onExtract(sanitized);
      } else {
        setUrl(sanitized);
      }
    } catch {
      // Clipboard access denied
    }
  }, [onExtract]);

  const handleExtract = useCallback(() => {
    const sanitized = sanitizeUrl(url);
    if (!sanitized || !/^https?:\/\//i.test(sanitized)) {
      return;
    }
    setUrl(sanitized);
    onExtract(sanitized);
  }, [url, onExtract]);

  const handleKeyPress = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExtract();
    }
  }, [handleExtract]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-4 mb-6">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Paste media URL..."
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-xl px-3 sm:px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            disabled={isLoading}
          />
          <button
            onClick={handlePaste}
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-3 rounded-xl transition-colors flex-shrink-0 touch-target"
            title="Paste from clipboard"
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-zinc-400 text-sm">paste</span>
            </div>
          </button>
          <button
            onClick={onSettingsClick}
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-3 rounded-xl transition-colors flex-shrink-0 touch-target"
            title="Cookie Settings"
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-zinc-400 text-sm">settings</span>
            </div>
          </button>
        </div>
        <button
          onClick={handleExtract}
          disabled={isLoading || !url.trim()}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors touch-target"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Extracting...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Extract</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default ExtractForm;
