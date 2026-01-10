/**
 * Fastify server setup
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create Fastify server instance
 */
export function createServer() {
  const fastify = Fastify({
    logger: logger.raw,
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    trustProxy: true
  });

  // CORS
  fastify.register(fastifyCors, {
    origin: true,
    credentials: true
  });

  // Static files (public folder)
  fastify.register(fastifyStatic, {
    root: join(__dirname, '..', 'public'),
    prefix: '/'
  });

  // API routes
  fastify.register(routes, { prefix: '/api' });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found'
      }
    });
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('server', 'Request error', error);
    
    reply.code(error.statusCode || 500).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      }
    });
  });

  return fastify;
}
