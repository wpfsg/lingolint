/**
 * Process exit codes.
 *
 * - 0: scan completed and no issue reached the `failOn` threshold
 * - 1: scan completed but the `failOn` threshold was exceeded
 * - 2: the scan could not run (bad arguments, invalid config, unreadable files)
 */
export const EXIT_OK = 0;
export const EXIT_ISSUES = 1;
export const EXIT_ERROR = 2;
