import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TOOL_NAME = 'LingoLint';

let cached: string | undefined;

/** Version from this package's package.json, read once. */
export function toolVersion(): string {
  if (cached === undefined) {
    try {
      const packageJson = fileURLToPath(new URL('../package.json', import.meta.url));
      const parsed = JSON.parse(readFileSync(packageJson, 'utf8')) as { version?: string };
      cached = parsed.version ?? '0.0.0';
    } catch {
      cached = '0.0.0';
    }
  }
  return cached;
}
