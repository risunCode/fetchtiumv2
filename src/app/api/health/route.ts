/**
 * GET /api/health
 * Simple health check endpoint for load balancers and monitoring
 * 
 * Response: HealthResponse
 */

import { NextResponse } from 'next/server';
import type { HealthResponse } from '@/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler for health check
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: Date.now(),
  };

  return NextResponse.json(response);
}
