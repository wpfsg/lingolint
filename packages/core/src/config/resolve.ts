import { z } from 'zod';
import type { AIIssueType, RuleSeverity } from '../types/issue.js';
import type { QARule } from '../types/rule.js';
import { AI_RULE_NAMES, configSchema, type ResolvedConfig } from './schema.js';

/** Thrown for invalid configuration. `message` is safe to show users. */
export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Validate a raw config object and apply defaults. */
export function resolveConfig(input: unknown): ResolvedConfig {
  const result = configSchema.safeParse(input ?? {});
  if (!result.success) {
    throw new ConfigError(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export interface ResolvedRuleSetting {
  severity: RuleSeverity;
  options: unknown;
}

/**
 * Resolve the effective severity and validated options for each rule.
 *
 * Unknown rule names are an error: silently ignoring a typo like `missingKeys`
 * would disable nothing and surprise the user later.
 */
export function resolveRuleSettings(
  config: ResolvedConfig,
  rules: readonly QARule[],
): Map<string, ResolvedRuleSetting> {
  const known = new Set<string>([...rules.map((rule) => rule.name), ...AI_RULE_NAMES]);
  for (const name of Object.keys(config.rules)) {
    if (!known.has(name)) {
      const available = Array.from(known).sort().join(', ');
      throw new ConfigError(`Unknown rule "${name}" in rules. Available rules: ${available}.`);
    }
  }

  const settings = new Map<string, ResolvedRuleSetting>();
  for (const rule of rules) {
    const setting = config.rules[rule.name];
    const severity =
      setting === undefined
        ? rule.defaultSeverity
        : typeof setting === 'string'
          ? setting
          : setting[0];
    const rawOptions = Array.isArray(setting) ? setting[1] : {};
    const parsed = rule.optionsSchema.safeParse(rawOptions);
    if (!parsed.success) {
      throw new ConfigError(
        `Invalid options for rule "${rule.name}":\n${z.prettifyError(parsed.error)}`,
      );
    }
    settings.set(rule.name, { severity, options: parsed.data });
  }
  return settings;
}

const DEFAULT_AI_SEVERITIES: Record<AIIssueType, RuleSeverity> = {
  semantic: 'warning',
  grammar: 'warning',
  terminology: 'warning',
  tone: 'info',
  capitalization: 'info',
  style: 'info',
};

/** Effective severity for an AI finding type. */
export function aiSeverity(config: ResolvedConfig, type: AIIssueType): RuleSeverity {
  const setting = config.rules[type];
  if (setting === undefined) {
    return DEFAULT_AI_SEVERITIES[type];
  }
  return typeof setting === 'string' ? setting : setting[0];
}
