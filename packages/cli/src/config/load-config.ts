import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ConfigError, resolveConfig, type ResolvedConfig } from '@lingolint/core';
import { createJiti } from 'jiti';
import { CliError } from '../errors.js';

export const CONFIG_FILE_NAMES = [
  'lingolint.config.ts',
  'lingolint.config.mts',
  'lingolint.config.cts',
  'lingolint.config.js',
  'lingolint.config.mjs',
  'lingolint.config.cjs',
  'lingolint.config.json',
];

export interface LoadedConfig {
  config: ResolvedConfig;
  /** Absolute path of the config file, or `undefined` when defaults were used. */
  filePath: string | undefined;
  /** Directory relative paths in the config resolve against. */
  baseDir: string;
}

/** Find a config file in `cwd`, or `undefined`. */
export function findConfigFile(cwd: string): string | undefined {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = path.join(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function importConfigModule(filePath: string): Promise<unknown> {
  if (filePath.endsWith('.json')) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    } catch (error) {
      throw new CliError(
        `Unable to parse config file ${filePath}\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const jiti = createJiti(pathToFileURL(path.join(path.dirname(filePath), 'noop.js')).href, {
    interopDefault: true,
    moduleCache: false,
  });
  try {
    return await jiti.import(filePath, { default: true });
  } catch (error) {
    throw new CliError(
      `Unable to load config file ${filePath}\n\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Load and validate configuration.
 *
 * `explicitPath` (from `--config`) must exist; otherwise the well-known file
 * names are searched in `cwd`, and defaults are used when none is found.
 */
export async function loadConfig(cwd: string, explicitPath?: string): Promise<LoadedConfig> {
  let filePath: string | undefined;
  if (explicitPath !== undefined) {
    filePath = path.resolve(cwd, explicitPath);
    if (!existsSync(filePath)) {
      throw new CliError(`Config file not found: ${filePath}`);
    }
  } else {
    filePath = findConfigFile(cwd);
  }

  if (filePath === undefined) {
    return { config: resolveConfig({}), filePath: undefined, baseDir: cwd };
  }

  const raw = await importConfigModule(filePath);
  if (typeof raw === 'function') {
    throw new CliError(
      `Config file ${filePath} exports a function. Export a plain object (optionally wrapped in defineConfig()).`,
    );
  }
  try {
    return { config: resolveConfig(raw ?? {}), filePath, baseDir: path.dirname(filePath) };
  } catch (error) {
    if (error instanceof ConfigError) {
      throw new CliError(`${error.message}\n\nConfig file: ${filePath}`);
    }
    throw error;
  }
}
