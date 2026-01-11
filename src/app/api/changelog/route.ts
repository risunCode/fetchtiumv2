import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET() {
  try {
    // Try multiple paths for different environments
    const possiblePaths = [
      join(process.cwd(), 'CHANGELOG.md'),
      join(process.cwd(), '..', 'CHANGELOG.md'),
      '/app/CHANGELOG.md', // Railway Docker path
    ];
    
    let content: string | null = null;
    
    for (const filePath of possiblePaths) {
      if (existsSync(filePath)) {
        content = await readFile(filePath, 'utf-8');
        break;
      }
    }
    
    if (!content) {
      throw new Error('CHANGELOG.md not found');
    }
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch {
    return new NextResponse('# Changelog\n\nFailed to load changelog.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
