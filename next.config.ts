import type { NextConfig } from "next";

/**
 * Security headers for all responses
 * Requirements: 9.4
 */
const securityHeaders = [
  {
    // Prevent clickjacking
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Prevent MIME type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Enable XSS filter
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    // Control referrer information
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Permissions policy (disable unnecessary features)
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    // Content Security Policy
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
      "style-src 'self' 'unsafe-inline'", // Required for inline styles
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  /* Enable React Compiler */
  reactCompiler: true,

  /**
   * Security headers configuration
   * Requirements: 9.4
   */
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // CORS headers for API routes
        // Requirements: 9.5
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-API-Key, Content-Type, Accept',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
        ],
      },
    ];
  },

  /**
   * Rewrites for Python API proxy
   * In both development and production, proxy /api/extract to Python Flask service
   * Requirements: 3.3 - THE System SHALL proxy /api/extract requests to the Python service
   */
  async rewrites() {
    // Python API runs on port 3001 in both dev and production (via supervisord)
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:3001';
    
    return [
      {
        source: '/api/extract',
        destination: `${pythonApiUrl}/api/extract`,
      },
      {
        source: '/api/health',
        destination: `${pythonApiUrl}/api/health`,
      },
    ];
  },

  /**
   * Environment variables exposed to the browser
   */
  env: {
    // Add any public env vars here
  },

  /**
   * Image optimization configuration
   */
  images: {
    // Allow images from common CDNs
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn.com',
      },
    ],
  },

  /**
   * Experimental features
   */
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  /**
   * Turbopack configuration (Next.js 16+)
   */
  turbopack: {
    // Empty config to acknowledge Turbopack usage
  },

  /**
   * Output configuration
   */
  output: 'standalone',

  /**
   * Powered by header (disabled for security)
   */
  poweredByHeader: false,
};

export default nextConfig;
