import { describe, expect, it } from 'vitest';
import {
  computeScore,
  exceedsThreshold,
  minSeverity,
  overallScore,
  resolveConfig,
  summarizeIssues,
} from '../../src/index.js';

const scoring = resolveConfig({}).scoring;
const summary = (errors: number, warnings: number, info: number) => ({
  errors,
  warnings,
  info,
  total: errors + warnings + info,
});

describe('computeScore', () => {
  it('uses raw weights at or below the baseline key count', () => {
    expect(computeScore(summary(0, 0, 0), 50, scoring)).toBe(100);
    expect(computeScore(summary(2, 4, 3), 50, scoring)).toBe(81); // 100 - 10 - 8 - 0.75
    expect(computeScore(summary(1, 0, 0), 100, scoring)).toBe(95);
  });

  it('scales penalties down for large locales', () => {
    expect(computeScore(summary(1, 0, 0), 1000, scoring)).toBe(100); // 0.5 rounds to 1 → 99.5 → 100
    expect(computeScore(summary(10, 0, 0), 1000, scoring)).toBe(95);
  });

  it('clamps to 0', () => {
    expect(computeScore(summary(50, 0, 0), 10, scoring)).toBe(0);
  });

  it('honours custom weights and baseline', () => {
    const custom = resolveConfig({
      scoring: { weights: { error: 10, warning: 1, info: 0 }, baselineKeys: 10 },
    }).scoring;
    expect(custom.weights).toEqual({ error: 10, warning: 1, info: 0 });
    expect(computeScore(summary(1, 1, 5), 10, custom)).toBe(89);
    expect(computeScore(summary(1, 1, 5), 20, custom)).toBe(95);
  });
});

describe('summaries and thresholds', () => {
  it('summarizes issues by severity', () => {
    expect(
      summarizeIssues([{ severity: 'error' }, { severity: 'info' }, { severity: 'error' }]),
    ).toEqual(summary(2, 0, 1));
  });

  it('evaluates failOn thresholds', () => {
    expect(exceedsThreshold(summary(0, 1, 0), 'error')).toBe(false);
    expect(exceedsThreshold(summary(0, 1, 0), 'warning')).toBe(true);
    expect(exceedsThreshold(summary(0, 0, 1), 'warning')).toBe(false);
    expect(exceedsThreshold(summary(0, 0, 1), 'info')).toBe(true);
    expect(exceedsThreshold(summary(9, 9, 9), 'never')).toBe(false);
  });

  it('averages locale scores', () => {
    expect(overallScore([])).toBe(100);
    expect(overallScore([91, 96])).toBe(94);
  });

  it('picks the less severe of two severities', () => {
    expect(minSeverity('error', 'info')).toBe('info');
    expect(minSeverity('warning', 'error')).toBe('warning');
  });
});
