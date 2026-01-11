/**
 * GET /api/v1/status
 * Return server status and information
 * 
 * Response: StatusResponse
 */

import { NextResponse } from 'next/server';
import { getSupportedPlatforms } from '@/lib/extractors';
import { buildMeta } from '@/lib/utils/response.utils';
import type { StatusResponse } from '@/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * GET handler for server status
 */
export async function GET(): Promise<NextResponse<StatusResponse>> {
  const startTime = Date.now();

  // Get supported platforms
  const platforms = getSupportedPlatforms();
  const extractorNames = platforms.map(p => p.platform);

  // Calculate uptime in seconds
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000);

  // Build response
  const response: StatusResponse = {
    success: true,
    status: 'online',
    version: process.env.npm_package_version || '2.0.0',
    uptime,
    extractors: extractorNames,
    meta: buildMeta({
      responseTime: Date.now() - startTime,
      accessMode: 'public',
    }),
  };

  return NextResponse.json(response);
}
