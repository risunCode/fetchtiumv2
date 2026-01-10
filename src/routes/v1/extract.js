/**
 * V1 Extract Route - POST /v1/extract
 * Main extraction endpoint with access control
 */

import { getExtractor } from '../../extractors/index.js';
import { isValidUrl } from '../../utils/url.utils.js';
import { ErrorCode } from '../../utils/error.utils.js';
import { logger } from '../../utils/logger.js';
import { addUrls } from '../../utils/url-store.js';
import { addFilenames } from '../../utils/filename.utils.js';
import { buildResponse, buildErrorResponse } from '../../utils/response.utils.js';

export default async function extractRoute(fastify) {
  fastify.post('/extract', {
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
          cookie: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { url, cookie } = request.body;
    const startTime = Date.now();
    const hasCookie = Boolean(cookie && cookie.trim());

    try {
      // Validate URL
      if (!isValidUrl(url)) {
        return reply.code(400).send(
          buildErrorResponse(ErrorCode.INVALID_URL, 'Invalid URL format', {
            responseTime: Date.now() - startTime,
            accessMode: request.accessMode,
            usedCookie: false
          })
        );
      }

      logger.info('v1/extract', 'Extraction request', { 
        url: url.substring(0, 100),
        accessMode: request.accessMode,
        hasCookie
      });

      // Get extractor for platform
      const extractor = getExtractor(url);

      // Extract media
      let result = await extractor.extract(url, {
        signal: request.signal,
        timeout: 30000,
        cookie
      });

      // Add filenames to all sources (universal for all platforms)
      result = addFilenames(result);

      // Log raw extractor response (before response builder)
      logger.debug('v1/extract', 'Raw extractor response', { raw: result });

      // Only trust extractor's usedCookie flag (set when cookie actually used in request)
      const usedCookie = result.usedCookie === true;

      // Build standardized response with meta
      const response = buildResponse(result, {
        responseTime: Date.now() - startTime,
        accessMode: request.accessMode,
        usedCookie
      });

      // Store extracted URLs for proxy validation
      if (response.success && response.items) {
        const urls = [];
        for (const item of response.items) {
          if (item.thumbnail) urls.push(item.thumbnail);
          if (item.sources) {
            for (const src of item.sources) {
              if (src.url) urls.push(src.url);
            }
          }
        }
        if (urls.length > 0) addUrls(urls);
      }

      logger.info('v1/extract', 'Extraction completed', {
        success: response.success,
        platform: response.platform || 'unknown',
        duration: response.meta?.responseTime,
        accessMode: request.accessMode,
        publicContent: response.meta?.publicContent
      });

      return reply.send(response);

    } catch (error) {
      logger.error('v1/extract', 'Extraction failed', error);

      const statusCode = error.code === ErrorCode.UNSUPPORTED_PLATFORM ? 400 : 500;
      
      return reply.code(statusCode).send(
        buildErrorResponse(
          error.code || ErrorCode.EXTRACTION_FAILED,
          error.message || 'Extraction failed',
          {
            responseTime: Date.now() - startTime,
            accessMode: request.accessMode,
            usedCookie: false
          }
        )
      );
    }
  });
}
