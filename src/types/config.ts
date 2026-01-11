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
  /** API keys for authentication */
  apiKeys: string[];
  /** Node environment */
  nodeEnv: 'development' | 'production' | 'test';
  /** Server port */
  port: number;
  /** Base URL for the application */
  baseUrl: string;
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Environment variables schema
 */
export interface EnvConfig {
  ALLOWED_ORIGINS?: string;
  API_KEYS?: string;
  NODE_ENV?: string;
  PORT?: string;
  BASE_URL?: string;
  DEBUG?: string;
}
