import path from 'node:path';
import {
  analyzeProject,
  exceedsThreshold,
  failOnSchema,
  type FailOn,
  type ProjectReport,
  type ResolvedConfig,
  type TranslationAIProvider,
} from '@lingolint/core';
import { createReviewerFromConfig, AIProviderError } from '@lingolint/ai';
import { loadConfig } from '../config/load-config.js';
import { CliError } from '../errors.js';
import { EXIT_ISSUES, EXIT_OK } from '../exit-codes.js';
import { shouldUseColor, type CliIO } from '../io.js';
import { loadLocales } from '../locales/load-locales.js';
import { OUTPUT_FORMATS, formatJson, formatPretty, type OutputFormat } from '../reporters/index.js';

export interface ScanOptions {
  /** Locales directory. Overrides `localesPath` from the config. */
  path?: string | undefined;
  source?: string | undefined;
  targets?: string[] | undefined;
  include?: string[] | undefined;
  format?: string | undefined;
  failOn?: string | undefined;
  config?: string | undefined;
  ai?: boolean | undefined;
  color?: boolean | undefined;
  verbose?: boolean | undefined;
  maxIssues?: number | undefined;
}

export interface ScanResult {
  report: ProjectReport;
  config: ResolvedConfig;
  passed: boolean;
  exitCode: number;
}

function parseFormat(value: string | undefined): OutputFormat {
  const format = value ?? 'pretty';
  if (!(OUTPUT_FORMATS as readonly string[]).includes(format)) {
    throw new CliError(
      `Unknown format "${format}". Expected one of: ${OUTPUT_FORMATS.join(', ')}.`,
    );
  }
  return format as OutputFormat;
}

function parseFailOn(value: string | undefined, fallback: FailOn): FailOn {
  if (value === undefined) {
    return fallback;
  }
  const parsed = failOnSchema.safeParse(value);
  if (!parsed.success) {
    throw new CliError(
      `Invalid --fail-on value "${value}". Expected one of: ${failOnSchema.options.join(', ')}.`,
    );
  }
  return parsed.data;
}

/** Apply CLI flags on top of the loaded config. Flags always win. */
export function mergeOptions(config: ResolvedConfig, options: ScanOptions): ResolvedConfig {
  return {
    ...config,
    sourceLocale: options.source ?? config.sourceLocale,
    ...(options.targets ? { targets: options.targets } : {}),
    include: options.include ?? config.include,
    failOn: parseFailOn(options.failOn, config.failOn),
    ai: { ...config.ai, enabled: options.ai ?? config.ai.enabled },
  };
}

function createAIProvider(config: ResolvedConfig, io: CliIO): TranslationAIProvider | undefined {
  if (!config.ai.enabled) {
    return undefined;
  }
  try {
    return createReviewerFromConfig({ ai: config.ai, env: io.env, cwd: io.cwd });
  } catch (error) {
    if (error instanceof AIProviderError) {
      throw new CliError(error.message, error.hint);
    }
    throw error;
  }
}

/**
 * Run a scan end to end and write the report. Returns the exit code instead of
 * exiting so it can be embedded and tested.
 */
export async function scan(options: ScanOptions, io: CliIO): Promise<ScanResult> {
  const format = parseFormat(options.format);
  const loaded = await loadConfig(io.cwd, options.config);
  const config = mergeOptions(loaded.config, options);

  const directory =
    options.path !== undefined
      ? path.resolve(io.cwd, options.path)
      : path.resolve(loaded.baseDir, config.localesPath);
  const { locales, files } = await loadLocales(directory, config.include);

  if (!Object.hasOwn(locales, config.sourceLocale)) {
    throw new CliError(
      `Source locale "${config.sourceLocale}" not found in ${directory}`,
      `Found: ${files.map((f) => f.locale).join(', ')}. Use --source <locale> to pick the source language.`,
    );
  }
  for (const target of config.targets ?? []) {
    if (!Object.hasOwn(locales, target)) {
      throw new CliError(
        `Target locale "${target}" not found in ${directory}`,
        `Found: ${files.map((f) => f.locale).join(', ')}.`,
      );
    }
  }

  const ai = createAIProvider(config, io);
  if (ai) {
    io.stderr(
      `Using AI review may send translation text to the configured AI provider (${ai.name}).\n`,
    );
  }

  const report = await analyzeProject({
    sourceLocale: config.sourceLocale,
    locales,
    config,
    ai,
  });

  const passed = !exceedsThreshold(report.summary, config.failOn);
  if (format === 'json') {
    io.stdout(formatJson(report, config.failOn, passed));
  } else {
    io.stdout(
      formatPretty(report, {
        color: shouldUseColor(io, options.color),
        verbose: options.verbose ?? false,
        failOn: config.failOn,
        passed,
        maxIssues: options.maxIssues ?? 50,
      }),
    );
  }

  return { report, config, passed, exitCode: passed ? EXIT_OK : EXIT_ISSUES };
}
