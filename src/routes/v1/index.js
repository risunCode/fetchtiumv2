/**
 * V1 API Routes Aggregator
 * 
 * All v1 routes are protected by access control middleware
 * - Public mode: Origin/Referer check (website only)
 * - Private mode: API key via ?key=xxx or X-API-Key header
 */

import { accessControl } from '../../middleware/access.js';
import extractRoute from './extract.js';
import downloadRoute from './download.js';
import streamRoute from './stream.js';
import statusRoute from './status.js';
import eventsRoute from './events.js';

export default async function v1Routes(fastify) {
  // Public routes (no access control, secured by url-store)
  // - events: SSE for real-time status
  // - stream: video/audio streaming
  // - download: file download
  fastify.register(eventsRoute);
  fastify.register(streamRoute);
  fastify.register(downloadRoute);
  
  // Protected routes (require Origin or API key)
  fastify.register(async (instance) => {
    instance.addHook('preHandler', accessControl);
    
    instance.register(extractRoute);
    instance.register(statusRoute);
  });
}
