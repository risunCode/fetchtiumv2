/**
 * V1 Download Route - GET /v1/download
 * Proxy download for cross-origin media URLs with access control
 * 
 * Security: Only allows URLs that were previously extracted
 * through /v1/extract or /api/extract (stored for 5 minutes)
 */

import { logger } from '../../utils/logger.js';
import { isValidUrl as isExtractedUrl } from '../../utils/url-store.js';
import { fetchStream } from '../../core/network/index.js';

export default async function downloadRoute(fastify) {
  fastify.get('/download', async (request, reply) => {
    const { url } = request.query;

    if (!url) {
      return reply.code(400).send({
        success: false,
        error: { code: 'MISSING_URL', message: 'URL parameter required' }
      });
    }

    try {
      // Validate URL format
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_URL', message: 'Invalid URL protocol' }
        });
      }

      // Security: Only allow URLs that were extracted through /api/extract or /v1/extract
      // This prevents open proxy abuse
      if (!isExtractedUrl(url)) {
        return reply.code(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'URL not authorized. Extract first via /v1/extract' }
        });
      }

      logger.info('v1/download', 'Download request', {
        urlHost: parsed.hostname,
        accessMode: request.accessMode
      });

      // Fetch the media using our client (with connection pooling)
      const { stream, headers: respHeaders } = await fetchStream(url, {
        timeout: 60000
      });

      // Get content type
      const contentType = respHeaders['content-type'] || 'application/octet-stream';
      const contentLength = respHeaders['content-length'];

      // Set headers
      reply.header('Content-Type', contentType);
      if (contentLength) reply.header('Content-Length', contentLength);
      reply.header('Content-Disposition', 'attachment');

      // Stream the response
      return reply.send(stream);

    } catch (error) {
      logger.error('v1/download', 'Proxy download failed', error);
      return reply.code(500).send({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message: error.message }
      });
    }
  });
}
