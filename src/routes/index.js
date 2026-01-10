/**
 * Route aggregator
 */

import extractRoute from './extract.route.js';
import streamRoute from './stream.route.js';
import downloadRoute from './download.route.js';

export default async function routes(fastify) {
  // Register routes
  fastify.register(extractRoute);
  fastify.register(streamRoute);
  fastify.register(downloadRoute);
}
