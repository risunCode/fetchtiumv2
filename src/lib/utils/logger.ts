/**
 * Logger utility
 * Simple console-based logging (no pino dependency)
 * TypeScript implementation
 */

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log data interface
 */
export interface LogData {
  [key: string]: unknown;
}

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

/**
 * Log level priority
 */
const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_PRIORITY[level] >= LOG_PRIORITY[currentLevel];
}

/**
 * Format timestamp
 */
function formatTime(): string {
  return new Date().toISOString().substring(11, 19);
}

/**
 * Format log message
 */
function formatMessage(level: LogLevel, context: string, message: string, data?: LogData): string {
  const time = formatTime();
  const dataStr = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
  return `[${time}] ${level.toUpperCase()} [${context}] ${message}${dataStr}`;
}

/**
 * Logger utility with convenience methods
 */
export const logger = {
  /**
   * Debug level log
   */
  debug: (context: string, message: string, data?: LogData): void => {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', context, message, data));
    }
  },

  /**
   * Info level log
   */
  info: (context: string, message: string, data?: LogData): void => {
    if (shouldLog('info')) {
      console.info(formatMessage('info', context, message, data));
    }
  },

  /**
   * Warning level log
   */
  warn: (context: string, message: string, data?: LogData): void => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', context, message, data));
    }
  },

  /**
   * Error level log
   */
  error: (context: string, message: string, error?: Error | LogData): void => {
    if (shouldLog('error')) {
      const errorData = error instanceof Error 
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(formatMessage('error', context, message, errorData));
    }
  },

  /**
   * Log cache hit/miss
   */
  cache: (platform: string, hit: boolean): void => {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', platform, 'Cache check', { cache: hit ? 'HIT' : 'MISS' }));
    }
  },

  /**
   * Log content type detection
   */
  type: (platform: string, contentType: string): void => {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', platform, 'Content type detected', { contentType }));
    }
  },

  /**
   * Log URL resolution
   */
  resolve: (platform: string, inputUrl: string, finalUrl: string): void => {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', platform, 'URL resolved', { inputUrl, finalUrl }));
    }
  },

  /**
   * Log media extraction result
   */
  media: (platform: string, counts: LogData): void => {
    if (shouldLog('info')) {
      console.info(formatMessage('info', platform, 'Media extracted', counts));
    }
  },

  /**
   * Log extraction completion
   */
  complete: (platform: string, duration: number): void => {
    if (shouldLog('info')) {
      console.info(formatMessage('info', platform, 'Extraction completed', { duration }));
    }
  }
};
