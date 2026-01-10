/**
 * V1 Events Route - GET /v1/events
 * Server-Sent Events for real-time status updates
 */

import { getConnectionStats } from '../../core/network/index.js';

// Track active SSE connections
const clients = new Set();

/**
 * Broadcast status to all connected clients
 */
export function broadcastStatus() {
  const stats = getConnectionStats();
  const data = JSON.stringify({
    type: 'status',
    status: stats.isWarm ? 'warm' : 'cold',
    lastRequest: stats.lastRequestTime,
    timeSinceLastRequest: stats.timeSinceLastRequest,
    keepAliveTimeout: stats.keepAliveTimeout,
    timestamp: Date.now()
  });
  
  for (const client of clients) {
    client.write(`data: ${data}\n\n`);
  }
}

export default async function eventsRoute(fastify) {
  fastify.get('/events', async (request, reply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Add to clients
    clients.add(reply.raw);
    
    // Send initial status
    const stats = getConnectionStats();
    const initial = JSON.stringify({
      type: 'status',
      status: stats.isWarm ? 'warm' : 'cold',
      lastRequest: stats.lastRequestTime,
      timeSinceLastRequest: stats.timeSinceLastRequest,
      keepAliveTimeout: stats.keepAliveTimeout,
      timestamp: Date.now()
    });
    reply.raw.write(`data: ${initial}\n\n`);
    
    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 30000);
    
    // Cleanup on close
    request.raw.on('close', () => {
      clients.delete(reply.raw);
      clearInterval(heartbeat);
    });
    
    // Don't end the response - keep it open for SSE
    return reply;
  });
}

// Broadcast status every 2 seconds (only to connected clients)
setInterval(broadcastStatus, 2000);
