'use client';

import { useState, useCallback } from 'react';
import { ExtractResult, ExtractError } from '@/types/extract';

interface JsonOutputProps {
  data: ExtractResult | ExtractError | null;
}

/**
 * Collapsible JSON output section with copy functionality
 */
export function JsonOutput({ data }: JsonOutputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API failed, ignore
    }
  }, [data]);

  if (!data) return null;

  return (
    <details
      className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="px-4 py-3 cursor-pointer hover:bg-zinc-800/50 text-sm text-zinc-400 flex items-center justify-between list-none">
        <span className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          JSON Response
        </span>
        <button
          onClick={handleCopy}
          className="bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded text-xs transition-colors"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </summary>
      <pre className="p-4 bg-zinc-950 text-emerald-400 text-xs overflow-x-auto border-t border-zinc-800 max-h-96 overflow-y-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export default JsonOutput;
