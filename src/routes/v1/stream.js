/**
 * V1 Stream Route - GET /v1/stream
 * Video streaming with range request support for embed playback
 * 
 * Security: Only allows URLs that were previously extracted
 * through /v1/extract (stored for 5 minutes)
 */

import { logger } from '../../utils/logger.js';
import { isValidUrl as isExtractedUrl } from '../../utils/url-store.js';
import { fetchStream } from '../../core/network/index.js';
import { analyze } from '../../core/media/mime.helper.js';

export default async function streamRoute(fastify) {
  fastify.get('/stream', async (request, reply) => {
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

      // Security: Only allow URLs that were extracted
      if (!isExtractedUrl(url)) {
        return reply.code(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'URL not authorized. Extract first via /v1/extract' }
        });
      }

      // Build headers for upstream request
      const headers = {};
      
      // Forward range header for seeking support
      if (request.headers.range) {
        headers['Range'] = request.headers.range;
      }

      logger.debug('v1/stream', 'Stream request', {
        urlHost: parsed.hostname,
        range: request.headers.range || 'full',
        accessMode: request.accessMode
      });

      // Fetch with headers (supports range)
      const response = await fetchStream(url, { headers, timeout: 60000 });

      // Analyze media type using helper
      const mediaInfo = analyze({
        url,
        contentType: response.headers['content-type'],
        headers: response.headers
      });

      // Get response info
      const contentType = response.headers['content-type'] || mediaInfo.mime || 'application/octet-stream';
      const contentLength = response.headers['content-length'];
      const contentRange = response.headers['content-range'];
      const acceptRanges = response.headers['accept-ranges'];

      // Set response headers
      reply.header('Content-Type', contentType);
      reply.header('Accept-Ranges', acceptRanges || 'bytes');
      
      if (contentLength) {
        reply.header('Content-Length', contentLength);
      }
      
      if (contentRange) {
        reply.header('Content-Range', contentRange);
      }

      // CORS headers for embed
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Range');
      reply.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      // Status code: 206 for partial, 200 for full
      const statusCode = contentRange ? 206 : 200;
      reply.code(statusCode);

      // Stream the response
      return reply.send(response.stream);

    } catch (error) {
      logger.error('v1/stream', 'Stream failed', error);
      return reply.code(500).send({
        success: false,
        error: { code: 'STREAM_FAILED', message: error.message }
      });
    }
  });

  // OPTIONS for CORS preflight
  fastify.options('/stream', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Range');
    reply.header('Access-Control-Max-Age', '86400');
    return reply.code(204).send();
  });
}
