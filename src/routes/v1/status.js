/**
 * V1 Status Route - GET /v1/status
 * Returns connection status and access mode info
 */

import { config } from '../../config/index.js';
import { getConnectionStats } from '../../core/network/index.js';

export default async function statusRoute(fastify) {
  fastify.get('/status', async (request, reply) => {
    const stats = getConnectionStats();
    
    return reply.send({
      success: true,
      status: stats.isWarm ? 'warm' : 'cold',
      version: 'v1',
      accessMode: request.accessMode,
      lastRequest: stats.lastRequestTime,
      timeSinceLastRequest: stats.timeSinceLastRequest,
      keepAliveTimeout: stats.keepAliveTimeout,
      timestamp: new Date().toISOString(),
      server: {
        env: config.env,
        uptime: Math.floor(process.uptime())
      }
    });
  });
}
