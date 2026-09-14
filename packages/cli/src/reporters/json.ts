import type { FailOn, ProjectReport } from '@lingolint/core';
import { TOOL_NAME, toolVersion } from '../version.js';

/**
 * Machine-readable output for `--format json`.
 *
 * This is a stable contract for integrations. It is the engine's
 * `ProjectReport` plus run metadata; fields are only ever added.
 */
export interface JsonOutput extends ProjectReport {
  tool: { name: string; version: string };
  failOn: FailOn;
  /** False when an issue at or above `failOn` was found (process exits 1). */
  passed: boolean;
}

export function toJsonOutput(report: ProjectReport, failOn: FailOn, passed: boolean): JsonOutput {
  return {
    tool: { name: TOOL_NAME, version: toolVersion() },
    ...report,
    failOn,
    passed,
  };
}

export function formatJson(report: ProjectReport, failOn: FailOn, passed: boolean): string {
  return `${JSON.stringify(toJsonOutput(report, failOn, passed), null, 2)}\n`;
}
