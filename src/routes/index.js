/**
 * Route aggregator
 */

import v1Routes from './v1/index.js';

export default async function routes(fastify) {
  // Register V1 API routes with access control
  fastify.register(v1Routes, { prefix: '/v1' });
}
