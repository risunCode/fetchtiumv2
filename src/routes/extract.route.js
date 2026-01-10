/**
 * Extract route - POST /api/extract
 * Main extraction endpoint
 */

import { getExtractor } from '../extractors/index.js';
import { isValidUrl } from '../utils/url.utils.js';
import { ErrorCode, createErrorResponse } from '../utils/error.utils.js';
import { logger } from '../utils/logger.js';

export default async function extractRoute(fastify) {
  fastify.post('/extract', {
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { url } = request.body;
    const startTime = Date.now();

    try {
      // Validate URL
      if (!isValidUrl(url)) {
        return reply.code(400).send(
          createErrorResponse(ErrorCode.INVALID_URL, 'Invalid URL format')
        );
      }

      logger.info('extract', 'Extraction request', { url: url.substring(0, 100) });

      // Get extractor for platform
      const extractor = getExtractor(url);

      // Extract media
      const result = await extractor.extract(url, {
        signal: request.signal,
        timeout: 30000
      });

      // Add response time
      result.responseTime = Date.now() - startTime;

      logger.info('extract', 'Extraction completed', {
        success: result.success,
        platform: result.platform || 'unknown',
        duration: result.responseTime
      });

      return reply.send(result);

    } catch (error) {
      logger.error('extract', 'Extraction failed', error);

      const statusCode = error.code === ErrorCode.UNSUPPORTED_PLATFORM ? 400 : 500;
      
      return reply.code(statusCode).send(
        createErrorResponse(
          error.code || ErrorCode.EXTRACTION_FAILED,
          error.message || 'Extraction failed'
        )
      );
    }
  });
}
