/**
 * An error whose message is complete and safe to print to the user verbatim.
 * Anything else that escapes is treated as an internal error.
 */
export class CliError extends Error {
  override readonly name = 'CliError';
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}
