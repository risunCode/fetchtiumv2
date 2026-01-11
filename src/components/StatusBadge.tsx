'use client';

import { useState, useEffect, useRef } from 'react';

type ServerStatus = 'warm' | 'cold' | 'offline' | 'checking';

interface StatusBadgeProps {
  className?: string;
}

export function StatusBadge({ className = '' }: StatusBadgeProps) {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [statusText, setStatusText] = useState('Checking...');
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Initialize SSE connection
    const initStatusStream = () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const events = new EventSource('/api/v1/events');
      eventSourceRef.current = events;

      events.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === 'status') {
            if (data.status === 'warm') {
              const remaining = Math.ceil(
                (data.keepAliveTimeout - data.timeSinceLastRequest) / 1000
              );
              setStatus('warm');
              setStatusText(`Warm • ${remaining}s left`);
            } else {
              // Default to cold for any non-warm status
              setStatus('cold');
              setStatusText('Cold • Ready');
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      events.onerror = () => {
        setStatus('offline');
        setStatusText('Offline');
        // EventSource will auto-reconnect
      };

      events.onopen = () => {
        // Don't change status on open, wait for first status message
        // This prevents flashing "Connected" before actual status
      };
    };

    initStatusStream();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Status dot color
  const dotColor = {
    checking: 'bg-zinc-600',
    warm: 'bg-emerald-500 animate-pulse',
    cold: 'bg-zinc-600',
    offline: 'bg-red-500',
  }[status];

  // Status text color
  const textColor = {
    checking: 'text-zinc-500',
    warm: 'text-emerald-400',
    cold: 'text-zinc-500',
    offline: 'text-red-400',
  }[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className={textColor}>{statusText}</span>
    </div>
  );
}

export default StatusBadge;
