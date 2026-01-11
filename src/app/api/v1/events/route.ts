/**
 * GET /api/v1/events
 * Server-Sent Events (SSE) for real-time status updates
 * 
 * Sends status updates every 2 seconds until client disconnects
 * 
 * Event format:
 * data: {"type":"status","status":"warm","keepAliveTimeout":30000,"timeSinceLastRequest":5000}
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Status update interval in milliseconds
const STATUS_INTERVAL = 2000;

// Keep-alive timeout in milliseconds (5 minutes)
const KEEP_ALIVE_TIMEOUT = 300000;

// Track last request time (in-memory, resets on server restart)
let lastRequestTime = 0;

/**
 * Update last request time (called when extraction happens)
 */
export function updateLastRequestTime(): void {
  lastRequestTime = Date.now();
}

/**
 * Get current server status with warm/cold tracking
 */
function getServerStatus(): {
  status: 'warm' | 'cold';
  keepAliveTimeout: number;
  timeSinceLastRequest: number;
} {
  const now = Date.now();
  const timeSinceLastRequest = lastRequestTime > 0 ? now - lastRequestTime : KEEP_ALIVE_TIMEOUT + 1;
  
  // Server is "warm" if a request was made within the keep-alive timeout
  const isWarm = timeSinceLastRequest < KEEP_ALIVE_TIMEOUT;
  
  return {
    status: isWarm ? 'warm' : 'cold',
    keepAliveTimeout: KEEP_ALIVE_TIMEOUT,
    timeSinceLastRequest: Math.min(timeSinceLastRequest, KEEP_ALIVE_TIMEOUT),
  };
}

/**
 * Format SSE message
 */
function formatSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * GET handler for SSE stream
 */
export async function GET(request: NextRequest): Promise<Response> {
  logger.info('events', 'SSE connection opened');

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial status immediately
      const initialStatus = getServerStatus();
      const initialEvent = {
        type: 'status',
        ...initialStatus,
        timestamp: Date.now(),
      };
      controller.enqueue(new TextEncoder().encode(formatSSE(initialEvent)));

      // Set up interval for periodic updates
      const intervalId = setInterval(() => {
        try {
          const status = getServerStatus();
          const event = {
            type: 'status',
            ...status,
            timestamp: Date.now(),
          };
          controller.enqueue(new TextEncoder().encode(formatSSE(event)));
        } catch {
          // Stream closed, clean up
          clearInterval(intervalId);
        }
      }, STATUS_INTERVAL);

      // Handle client disconnect via abort signal
      request.signal.addEventListener('abort', () => {
        logger.info('events', 'SSE connection closed by client');
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      logger.info('events', 'SSE stream cancelled');
    },
  });

  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
