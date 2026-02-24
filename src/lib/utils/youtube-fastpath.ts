import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const YOUTUBE_HOST_SUFFIX = '.youtube.com';
const QUALITY_HEIGHT_PATTERN = /(\d{3,4})/;

export function isYouTubeWatchUrl(raw: string): boolean {
  if (!raw) {
    return false;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be') {
      return true;
    }

    if (host !== 'youtube.com' && !host.endsWith(YOUTUBE_HOST_SUFFIX)) {
      return false;
    }

    const pathname = parsed.pathname.toLowerCase();
    return pathname.startsWith('/watch') || pathname.startsWith('/shorts/');
  } catch {
    return false;
  }
}

function parseQualityHeight(quality?: string | null): number {
  const normalized = (quality || '').toLowerCase().trim();
  const match = QUALITY_HEIGHT_PATTERN.exec(normalized);
  if (!match?.[1]) {
    return 720;
  }

  const height = Number.parseInt(match[1], 10);
  if (!Number.isFinite(height) || height <= 0) {
    return 720;
  }

  return height;
}

export function buildYouTubeSelector(quality?: string | null): string {
  const height = parseQualityHeight(quality);
  return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
}

export interface YouTubeFastPathResult {
  filePath: string;
  tempDir: string;
}

export async function downloadAndMergeYouTubeToMp4(
  sourceUrl: string,
  quality?: string | null
): Promise<YouTubeFastPathResult> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fetchtium-yt-'));
  try {
    const outputTemplate = path.join(tempDir, 'output.%(ext)s');
    const finalOutput = path.join(tempDir, 'output.mp4');
    const selector = buildYouTubeSelector(quality);

    const args = [
      '--no-warnings',
      '--no-playlist',
      '-f', selector,
      '--merge-output-format', 'mp4',
      '-o', outputTemplate,
      sourceUrl,
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn('yt-dlp', args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let combinedOutput = '';

      child.stdout.on('data', (chunk: Buffer) => {
        combinedOutput += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        combinedOutput += chunk.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`yt-dlp exited with code ${code}: ${combinedOutput.trim().slice(0, 1000)}`));
      });
    });

    if (fs.existsSync(finalOutput)) {
      return { filePath: finalOutput, tempDir };
    }

    const createdFiles = await fs.promises.readdir(tempDir);
    const mp4Name = createdFiles.find((name) => name.toLowerCase().endsWith('.mp4'));
    if (!mp4Name) {
      throw new Error('yt-dlp completed but no mp4 output was produced');
    }

    return {
      filePath: path.join(tempDir, mp4Name),
      tempDir,
    };
  } catch (error) {
    await cleanupYouTubeTempDir(tempDir);
    throw error;
  }
}

export async function cleanupYouTubeTempDir(tempDir: string): Promise<void> {
  if (!tempDir) {
    return;
  }

  await fs.promises.rm(tempDir, { recursive: true, force: true });
}
