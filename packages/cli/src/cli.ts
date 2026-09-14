import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { scan } from './commands/scan.js';
import { CliError } from './errors.js';
import { EXIT_ERROR, EXIT_OK } from './exit-codes.js';
import { processIO, type CliIO } from './io.js';
import { TOOL_NAME, toolVersion } from './version.js';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError('Expected a non-negative integer.');
  }
  return parsed;
}

interface ScanFlags {
  source?: string;
  targets?: string[];
  target?: string[];
  include?: string[];
  format?: string;
  failOn?: string;
  config?: string;
  ai?: boolean;
  color?: boolean;
  verbose?: boolean;
  maxIssues?: number;
}

export function buildProgram(io: CliIO): Command {
  const program = new Command();
  program
    .name('lingolint')
    .description(
      `${TOOL_NAME} — ESLint for app translations. Catch translation bugs before your users do.`,
    )
    .version(toolVersion(), '-v, --version', 'Print the version')
    .helpOption('-h, --help', 'Show help')
    .exitOverride()
    .configureOutput({
      writeOut: (text) => {
        io.stdout(text);
      },
      writeErr: (text) => {
        io.stderr(text);
      },
    });

  program
    .command('scan')
    .description('Analyze locale files and report translation problems')
    .argument(
      '[path]',
      'Directory containing locale files (defaults to localesPath from the config, then ./locales)',
    )
    .option('-s, --source <locale>', 'Source locale, e.g. en')
    .option(
      '-t, --targets <locales>',
      'Comma-separated target locales (defaults to every other file)',
      splitList,
    )
    .option('--target <locales>', 'Alias for --targets', splitList)
    .option('--include <patterns>', 'Comma-separated file patterns, e.g. "*.json"', splitList)
    .option('-f, --format <format>', 'Output format: pretty or json', 'pretty')
    .option(
      '--fail-on <severity>',
      'Exit with code 1 at this severity or above: error, warning, info, never',
    )
    .option(
      '-c, --config <path>',
      'Path to a config file (defaults to lingolint.config.{ts,js,mjs,cjs,json})',
    )
    .option('--ai', 'Enable AI linguistic review (requires an API key; sends text to the provider)')
    .option('--no-ai', 'Disable AI review even if enabled in the config')
    // `--color` must be declared before `--no-color` so the default stays undefined
    // (auto-detect) instead of commander's implicit `true`.
    .option('--color', 'Force colored output')
    .option('--no-color', 'Disable colored output (NO_COLOR is also respected)')
    .option('--verbose', 'Show explanations and suggestions for every issue')
    .option(
      '--max-issues <n>',
      'Maximum issues to print per locale in pretty output (0 = all)',
      parseNonNegativeInt,
    )
    .addHelpText(
      'after',
      `
Examples:
  $ lingolint scan ./locales --source en
  $ lingolint scan --fail-on warning
  $ lingolint scan ./locales --format json > report.json
  $ lingolint scan --targets es,de --verbose

Exit codes:
  0  no issue reached the --fail-on threshold
  1  issues at or above the threshold were found
  2  the scan could not run (bad arguments, invalid config, unreadable files)`,
    )
    .action(async (pathArg: string | undefined, flags: ScanFlags) => {
      const result = await scan(
        {
          path: pathArg,
          source: flags.source,
          targets: flags.targets ?? flags.target,
          include: flags.include,
          format: flags.format,
          failOn: flags.failOn,
          config: flags.config,
          ai: flags.ai,
          color: flags.color,
          verbose: flags.verbose,
          maxIssues: flags.maxIssues,
        },
        io,
      );
      program.setOptionValue('exitCode', result.exitCode);
    });

  return program;
}

/**
 * Run the CLI with the given arguments and return the process exit code.
 * Never calls `process.exit`, so it is safe to embed and to test.
 */
export async function run(argv: readonly string[], io: CliIO = processIO()): Promise<number> {
  const program = buildProgram(io);
  try {
    await program.parseAsync([...argv], { from: 'user' });
    const exitCode = program.getOptionValue('exitCode') as number | undefined;
    return exitCode ?? EXIT_OK;
  } catch (error) {
    if (error instanceof CommanderError) {
      // --help and --version exit via this path with code 0.
      if (
        error.code === 'commander.helpDisplayed' ||
        error.code === 'commander.version' ||
        error.code === 'commander.help'
      ) {
        return EXIT_OK;
      }
      return EXIT_ERROR;
    }
    if (error instanceof CliError) {
      io.stderr(`\n${error.message}\n`);
      if (error.hint) {
        io.stderr(`\n${error.hint}\n`);
      }
      io.stderr('\n');
      return EXIT_ERROR;
    }
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    io.stderr(
      `\nUnexpected error:\n${message}\n\nIf this looks like a bug, please report it with the command you ran.\n`,
    );
    return EXIT_ERROR;
  }
}
