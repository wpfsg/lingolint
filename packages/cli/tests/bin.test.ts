import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { examplesDir, repoRoot } from './helpers.js';

const bin = path.join(repoRoot, 'packages', 'cli', 'dist', 'bin.js');

// End-to-end check of the published entry point. Requires `npm run build`,
// which CI runs before tests; locally it is skipped when dist is absent.
describe.skipIf(!existsSync(bin))('lingolint binary', () => {
  it('runs the example scan through the real executable', () => {
    const result = spawnSync(process.execPath, [bin, 'scan', examplesDir, '--source', 'en'], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('LingoLint');
    expect(result.stdout).toContain('Missing placeholder: {currency}');
  });

  it('exits 2 on usage errors', () => {
    const result = spawnSync(process.execPath, [bin, 'scan', '/no/such/dir'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Locales directory not found');
  });
});
