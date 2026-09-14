import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliIO } from '../src/io.js';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const examplesDir = path.join(repoRoot, 'examples', 'basic');

export interface MemoryIO extends CliIO {
  out(): string;
  err(): string;
}

export function memoryIO(overrides: Partial<Pick<CliIO, 'env' | 'cwd' | 'isTTY'>> = {}): MemoryIO {
  const out: string[] = [];
  const err: string[] = [];
  return {
    stdout: (text) => {
      out.push(text);
    },
    stderr: (text) => {
      err.push(text);
    },
    isTTY: overrides.isTTY ?? false,
    env: overrides.env ?? {},
    cwd: overrides.cwd ?? repoRoot,
    out: () => out.join(''),
    err: () => err.join(''),
  };
}

/** Create a temp directory with the given files (relative paths → contents). */
export async function tempProject(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'lingolint-'));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    await writeFile(filePath, content, 'utf8');
  }
  return dir;
}

// eslint-disable-next-line no-control-regex -- matching escape sequences is the point
export const ANSI = /\[[0-9;]*m/;
