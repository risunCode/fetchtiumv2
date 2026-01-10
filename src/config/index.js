/**
 * Environment configuration
 * Loads and exports application configuration from environment variables
 */

import { config as dotenvConfig } from 'dotenv';

// Load .env file
dotenvConfig();

// Parse comma-separated list from env
const parseList = (envValue, defaults = []) => {
  if (!envValue) return defaults;
  return envValue.split(',').map(s => s.trim()).filter(Boolean);
};

// Default allowed origins for public mode
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '127.0.0.1',
  env: process.env.NODE_ENV || 'development',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Network
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
  maxRedirects: parseInt(process.env.MAX_REDIRECTS || '5', 10),
  
  // User Agents
  userAgents: {
    // iPad latest (primary for Facebook)
    ipad: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    
    // Chrome 131 (fallback)
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  },

  // Rate limiting (simple in-memory)
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10)
  },

  // Cache (in-memory for V1)
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL || '300', 10) // 5 minutes default
  },

  // Access Control (V1 API)
  // Allowed origins for public mode (comma-separated in env)
  allowedOrigins: parseList(process.env.ALLOWED_ORIGINS, DEFAULT_ORIGINS),
  
  // API keys for private mode (comma-separated in env)
  apiKeys: parseList(process.env.API_KEYS, [])
};
