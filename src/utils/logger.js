/**
 * Pino logger wrapper
 * Simple logging setup with structured output
 */

import pino from 'pino';
import { config } from '../config/index.js';

const pinoLogger = pino({
  level: config.logLevel,
  transport: config.env === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined
});

/**
 * Logger utility with convenience methods
 */
export const logger = {
  /**
   * Debug level log
   */
  debug: (context, message, data) => {
    pinoLogger.debug({ context, ...data }, message);
  },

  /**
   * Info level log
   */
  info: (context, message, data) => {
    pinoLogger.info({ context, ...data }, message);
  },

  /**
   * Warning level log
   */
  warn: (context, message, data) => {
    pinoLogger.warn({ context, ...data }, message);
  },

  /**
   * Error level log
   */
  error: (context, message, error) => {
    pinoLogger.error({ 
      context, 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        ...error
      } : error
    }, message);
  },

  /**
   * Log cache hit/miss
   */
  cache: (platform, hit) => {
    pinoLogger.debug({ platform, cache: hit ? 'HIT' : 'MISS' }, 'Cache check');
  },

  /**
   * Log content type detection
   */
  type: (platform, contentType) => {
    pinoLogger.debug({ platform, contentType }, 'Content type detected');
  },

  /**
   * Log URL resolution
   */
  resolve: (platform, inputUrl, finalUrl) => {
    pinoLogger.debug({ platform, inputUrl, finalUrl }, 'URL resolved');
  },

  /**
   * Log media extraction result
   */
  media: (platform, counts) => {
    pinoLogger.info({ platform, ...counts }, 'Media extracted');
  },

  /**
   * Log extraction completion
   */
  complete: (platform, duration) => {
    pinoLogger.info({ platform, duration }, 'Extraction completed');
  },

  /**
   * Get raw pino instance for advanced usage
   */
  raw: pinoLogger
};
