import { NextRequest, NextResponse } from 'next/server';

import { extract } from '@/lib/extractors';
import type { ExtractionRequest } from '@/lib/extractors/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: ExtractionRequest;
  try {
    body = (await request.json()) as ExtractionRequest;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_URL', message: 'Invalid JSON body' } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!body?.url?.trim()) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_URL', message: 'url is required' } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await extract(body);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unexpected error',
        },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
