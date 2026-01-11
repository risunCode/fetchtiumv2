/**
 * Configuration Module
 * 
 * Centralized configuration management for the application.
 * Reads environment variables and provides typed configuration objects.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import type { AppConfig } from '@/types/config';

/**
 * Parse comma-separated list from environment variable
 */
function parseList(envValue: string | undefined, defaults: string[] = []): string[] {
  if (!envValue) return defaults;
  return envValue.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Default allowed origins for development
 */
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

/**
 * User agent strings for different platforms
 */
export const userAgents = {
  /** iPad latest (primary for Facebook) */
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  /** Chrome 131 (fallback) */
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
} as const;

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  requestTimeout: number;
  maxRedirects: number;
}

/**
 * Full application configuration
 */
export interface Config extends AppConfig {
  /** Log level */
  logLevel: string;
  /** Network settings */
  network: NetworkConfig;
  /** Rate limiting settings */
  rateLimit: RateLimitConfig;
  /** Cache settings */
  cache: CacheConfig;
  /** User agent strings */
  userAgents: typeof userAgents;
}

/**
 * Get the current environment
 */
function getNodeEnv(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'test') return env;
  return 'development';
}

/**
 * Get the base URL for the application
 */
function getBaseUrl(): string {
  // In production, use NEXT_PUBLIC_BASE_URL or VERCEL_URL
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Default to localhost in development
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Application configuration singleton
 * 
 * Reads from environment variables with sensible defaults.
 */
export const config: Config = {
  // Core settings (Requirements: 9.1)
  nodeEnv: getNodeEnv(),
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: getBaseUrl(),
  debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Access control (Requirements: 9.2, 9.3)
  allowedOrigins: parseList(process.env.ALLOWED_ORIGINS, DEFAULT_ORIGINS),
  apiKeys: parseList(process.env.API_KEYS, []),
  
  // Network settings
  network: {
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    maxRedirects: parseInt(process.env.MAX_REDIRECTS || '5', 10),
  },
  
  // Rate limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
  },
  
  // Cache
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutes default
  },
  
  // User agents
  userAgents,
};

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return config.nodeEnv === 'test';
}

/**
 * Get allowed origins
 */
export function getAllowedOrigins(): string[] {
  return config.allowedOrigins;
}

/**
 * Get API keys
 */
export function getApiKeys(): string[] {
  return config.apiKeys;
}

export default config;
