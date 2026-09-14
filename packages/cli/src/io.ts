/**
 * Everything the CLI needs from its environment, injectable for tests.
 * Command handlers never touch `process` directly.
 */
export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  /** Whether stdout is an interactive terminal. */
  isTTY: boolean;
  env: Readonly<Record<string, string | undefined>>;
  cwd: string;
}

export function processIO(): CliIO {
  return {
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    isTTY: process.stdout.isTTY,
    env: process.env,
    cwd: process.cwd(),
  };
}

/** Decide whether to emit ANSI colors, following the NO_COLOR / FORCE_COLOR conventions. */
export function shouldUseColor(io: CliIO, flag: boolean | undefined): boolean {
  if (flag !== undefined) {
    return flag;
  }
  if (io.env.NO_COLOR !== undefined && io.env.NO_COLOR !== '') {
    return false;
  }
  if (io.env.FORCE_COLOR !== undefined && io.env.FORCE_COLOR !== '0') {
    return true;
  }
  if (io.env.CI !== undefined) {
    return false;
  }
  return io.isTTY && io.env.TERM !== 'dumb';
}
