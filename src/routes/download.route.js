/**
 * Download route - GET /api/download
 * Proxy download for cross-origin media URLs
 */

import { logger } from '../utils/logger.js';

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
      // Validate URL
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_URL', message: 'Invalid URL protocol' }
        });
      }

      // Only allow known CDN domains
      const allowedDomains = ['fbcdn.net', 'cdninstagram.com', 'tiktokcdn.com', 'scontent'];
      const isAllowed = allowedDomains.some(d => parsed.hostname.includes(d));
      if (!isAllowed) {
        return reply.code(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Domain not allowed' }
        });
      }

      // Fetch the media
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        return reply.code(response.status).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to fetch media' }
        });
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length');

      // Set headers
      reply.header('Content-Type', contentType);
      if (contentLength) reply.header('Content-Length', contentLength);
      reply.header('Content-Disposition', 'attachment');

      // Stream the response
      return reply.send(response.body);

    } catch (error) {
      logger.error('download', 'Proxy download failed', error);
      return reply.code(500).send({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message: error.message }
      });
    }
  });
}
