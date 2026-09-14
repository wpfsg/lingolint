import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli.js';
import type { JsonOutput } from '../src/reporters/json.js';
import { ANSI, examplesDir, memoryIO, tempProject } from './helpers.js';

const en = JSON.stringify({ save: 'Save', total: 'Total {amount}', long: 'Buy' });
const esWarningsOnly = JSON.stringify({
  save: 'Guardar',
  total: 'Total {amount}',
  long: 'Realizar una compra ahora',
});
const esWithError = JSON.stringify({ save: 'Guardar', total: 'Total', long: 'Comprar' });

describe('lingolint scan', () => {
  it('reports the example project and exits 1 on errors', async () => {
    const io = memoryIO();
    const code = await run(['scan', examplesDir, '--source', 'en'], io);
    expect(code).toBe(1);
    const out = io.out();
    expect(out).toContain('Spanish');
    expect(out).toContain('German');
    expect(out).toContain('checkout.total');
    expect(out).toContain('Missing placeholder: {currency}');
    expect(out).toContain('Overall health:');
    expect(out).toContain('fail on error — exceeded');
    expect(out).not.toMatch(ANSI);
  });

  it('emits machine-readable JSON', async () => {
    const io = memoryIO();
    const code = await run(['scan', examplesDir, '--source', 'en', '--format', 'json'], io);
    expect(code).toBe(1);
    const parsed = JSON.parse(io.out()) as JsonOutput;
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.tool.name).toBe('LingoLint');
    expect(parsed.tool.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(parsed.sourceLocale).toBe('en');
    expect(parsed.failOn).toBe('error');
    expect(parsed.passed).toBe(false);
    expect(parsed.locales.map((l) => l.targetLocale)).toEqual(['de', 'es']);
    const spanish = parsed.locales.find((l) => l.targetLocale === 'es');
    const issue = spanish?.issues.find((i) => i.key === 'checkout.total');
    expect(issue).toMatchObject({
      type: 'placeholder_mismatch',
      severity: 'error',
      message: 'Missing placeholder: {currency}',
      locale: 'es',
      origin: 'deterministic',
    });
    expect(io.err()).toBe('');
  });

  it('restricts targets and exits 0 with --fail-on never', async () => {
    const io = memoryIO();
    const code = await run(
      ['scan', examplesDir, '-s', 'en', '-t', 'de', '--fail-on', 'never', '-f', 'json'],
      io,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(io.out()) as JsonOutput;
    expect(parsed.locales.map((l) => l.targetLocale)).toEqual(['de']);
    expect(parsed.passed).toBe(true);
  });

  it('applies the failure threshold', async () => {
    const dir = await tempProject({ 'en.json': en, 'es.json': esWarningsOnly });
    expect(await run(['scan', dir, '--source', 'en'], memoryIO())).toBe(0);
    expect(await run(['scan', dir, '--source', 'en', '--fail-on', 'warning'], memoryIO())).toBe(1);
  });

  it('prints a clean report when there are no issues', async () => {
    const dir = await tempProject({
      'en.json': en,
      'de.json': JSON.stringify({ save: 'Speichern', total: 'Summe {amount}', long: 'Kaufen' }),
    });
    const io = memoryIO();
    expect(await run(['scan', dir], io)).toBe(0);
    expect(io.out()).toContain('✓ No issues found');
    expect(io.out()).toContain('German');
  });

  it('shows explanations with --verbose and colors when forced', async () => {
    const io = memoryIO();
    await run(['scan', examplesDir, '--source', 'en', '--verbose', '--color'], io);
    expect(io.out()).toContain('Placeholders are replaced with values at runtime');
    expect(io.out()).toMatch(ANSI);
  });

  it('respects NO_COLOR even on a TTY', async () => {
    const io = memoryIO({ isTTY: true, env: { NO_COLOR: '1' } });
    await run(['scan', examplesDir, '--source', 'en'], io);
    expect(io.out()).not.toMatch(ANSI);
  });

  it('limits printed issues with --max-issues', async () => {
    const io = memoryIO();
    await run(['scan', examplesDir, '--source', 'en', '--max-issues', '1'], io);
    expect(io.out()).toMatch(/more issues? not shown/);
  });
});

describe('error handling', () => {
  it('fails with exit 2 and a hint when the directory is missing', async () => {
    const io = memoryIO();
    expect(await run(['scan', '/definitely/not/here'], io)).toBe(2);
    expect(io.err()).toContain('Locales directory not found');
    expect(io.err()).toContain('lingolint scan ./locales');
  });

  it('explains JSON syntax errors with a location', async () => {
    const dir = await tempProject({
      'en.json': en,
      'es.json': '{\n  "save": "Guardar"\n  "total": "x"\n}',
    });
    const io = memoryIO();
    expect(await run(['scan', dir], io)).toBe(2);
    expect(io.err()).toContain(`Unable to parse ${path.join(dir, 'es.json')}`);
    expect(io.err()).toMatch(/Invalid JSON near line 3, column \d+/);
  });

  it('fails when the source locale is not present', async () => {
    const dir = await tempProject({ 'en.json': en, 'es.json': esWithError });
    const io = memoryIO();
    expect(await run(['scan', dir, '--source', 'fr'], io)).toBe(2);
    expect(io.err()).toContain('Source locale "fr" not found');
    expect(io.err()).toContain('Found: en, es');
  });

  it('rejects unknown formats and fail-on values', async () => {
    expect(await run(['scan', examplesDir, '--format', 'xml'], memoryIO())).toBe(2);
    const io = memoryIO();
    expect(await run(['scan', examplesDir, '--fail-on', 'always'], io)).toBe(2);
    expect(io.err()).toContain('Invalid --fail-on value');
  });

  it('rejects unknown flags with exit 2', async () => {
    expect(await run(['scan', '--bogus'], memoryIO())).toBe(2);
  });

  it('prints help and version with exit 0', async () => {
    const help = memoryIO();
    expect(await run(['--help'], help)).toBe(0);
    expect(help.out()).toContain('scan');
    const version = memoryIO();
    expect(await run(['--version'], version)).toBe(0);
    expect(version.out()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('configuration files', () => {
  it('loads lingolint.config.ts and resolves localesPath relative to it', async () => {
    const dir = await tempProject({
      // Type annotations prove the file goes through a TypeScript loader.
      'lingolint.config.ts': `
        type Threshold = 'error' | 'never';
        const threshold: Threshold = 'never';
        interface Config { sourceLocale: string; localesPath: string; failOn: Threshold; rules: Record<string, string> }
        const config: Config = {
          sourceLocale: 'en',
          localesPath: './i18n',
          failOn: threshold,
          rules: { placeholders: 'warning', identicalToSource: 'off' },
        };
        export default config;
      `,
    });
    await mkdir(path.join(dir, 'i18n'));
    await writeFile(path.join(dir, 'i18n', 'en.json'), en, 'utf8');
    await writeFile(path.join(dir, 'i18n', 'es.json'), esWithError, 'utf8');

    const io = memoryIO({ cwd: dir });
    const code = await run(['scan', '--format', 'json'], io);
    expect(code).toBe(0);
    const parsed = JSON.parse(io.out()) as JsonOutput;
    expect(parsed.failOn).toBe('never');
    expect(parsed.locales[0]!.issues.find((i) => i.key === 'total')?.severity).toBe('warning');
  });

  it('loads JSON configs and lets flags override them', async () => {
    const dir = await tempProject({
      'lingolint.config.json': JSON.stringify({
        sourceLocale: 'en',
        localesPath: '.',
        failOn: 'never',
      }),
      'en.json': en,
      'es.json': esWithError,
    });
    expect(await run(['scan'], memoryIO({ cwd: dir }))).toBe(0);
    expect(await run(['scan', '--fail-on', 'error'], memoryIO({ cwd: dir }))).toBe(1);
  });

  it('reports invalid config with the file path', async () => {
    const dir = await tempProject({
      'lingolint.config.json': JSON.stringify({ rules: { missingKeys: 'error' } }),
      'en.json': en,
      'es.json': esWithError,
    });
    const io = memoryIO({ cwd: dir });
    expect(await run(['scan', dir], io)).toBe(2);
    expect(io.err()).toContain('Unknown rule "missingKeys"');
  });

  it('fails when --config points to a missing file', async () => {
    const io = memoryIO();
    expect(await run(['scan', examplesDir, '--config', './nope.config.ts'], io)).toBe(2);
    expect(io.err()).toContain('Config file not found');
  });

  it('requires an API key for --ai and never runs AI otherwise', async () => {
    const io = memoryIO({ env: {} });
    expect(await run(['scan', examplesDir, '--source', 'en', '--ai'], io)).toBe(2);
    expect(io.err()).toContain('ANTHROPIC_API_KEY is not set');
    expect(io.err()).not.toContain('sk-');
  });
});
