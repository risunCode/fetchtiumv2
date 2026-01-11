'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Server status types
 */
export type ServerStatus = 'warm' | 'cold' | 'offline' | 'checking';

/**
 * SSE status event data
 */
export interface StatusEventData {
  type: 'status';
  status: 'warm' | 'cold';
  timestamp?: number;
  keepAliveTimeout?: number;
  timeSinceLastRequest?: number;
}

/**
 * useStatus hook return type
 */
export interface UseStatusReturn {
  status: ServerStatus;
  statusText: string;
  isConnected: boolean;
  reconnect: () => void;
}

/**
 * Custom hook for handling SSE connection to server status endpoint
 * Manages connection lifecycle and status updates from /api/v1/events
 * 
 * @returns {UseStatusReturn} Status state and handlers
 */
export function useStatus(): UseStatusReturn {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [statusText, setStatusText] = useState('Checking...');
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  /**
   * Initialize or reinitialize SSE connection
   */
  const initConnection = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus('checking');
    setStatusText('Connecting...');
    setIsConnected(false);

    try {
      const events = new EventSource('/api/v1/events');
      eventSourceRef.current = events;

      events.onopen = () => {
        setIsConnected(true);
        // Don't change status on open, wait for first status message
      };

      events.onmessage = (e) => {
        try {
          const data: StatusEventData = JSON.parse(e.data);

          if (data.type === 'status') {
            if (data.status === 'warm' && data.keepAliveTimeout && data.timeSinceLastRequest !== undefined) {
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
        setIsConnected(false);
        setStatus('offline');
        setStatusText('Offline');
        // EventSource will auto-reconnect
      };
    } catch {
      setIsConnected(false);
      setStatus('offline');
      setStatusText('Connection failed');
    }
  }, []);

  /**
   * Manual reconnect function
   */
  const reconnect = useCallback(() => {
    initConnection();
  }, [initConnection]);

  // Initialize connection on mount
  useEffect(() => {
    initConnection();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [initConnection]);

  return {
    status,
    statusText,
    isConnected,
    reconnect,
  };
}

export default useStatus;
