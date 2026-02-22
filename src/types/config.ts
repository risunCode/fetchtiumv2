/**
 * Config Types
 * Environment and configuration type definitions
 */

/**
 * Application environment configuration
 */
export interface AppConfig {
  /** Allowed origins for CORS */
  allowedOrigins: string[];
  /** Node environment */
  nodeEnv: 'development' | 'production' | 'test';
  /** Server port */
  port: number;
  /** Base URL for the application */
  baseUrl: string;
  /** Enable debug logging */
  debug: boolean;
  /** Extractor runtime profile */
  extractorProfile: 'vercel' | 'full';
}

/**
 * Environment variables schema
 */
export interface EnvConfig {
  ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
  PORT?: string;
  BASE_URL?: string;
  DEBUG?: string;
  EXTRACTOR_PROFILE?: 'vercel' | 'full';
}
