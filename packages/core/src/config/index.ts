export { resolveGlossary } from './glossary.js';
export {
  ConfigError,
  aiSeverity,
  resolveConfig,
  resolveRuleSettings,
  type ResolvedRuleSetting,
} from './resolve.js';
export {
  AI_RULE_NAMES,
  aiConfigSchema,
  configSchema,
  defineConfig,
  failOnSchema,
  glossaryEntrySchema,
  ruleSettingSchema,
  ruleSeveritySchema,
  scoringSchema,
  severitySchema,
  type AIConfig,
  type FailOn,
  type GlossaryEntryInput,
  type LingoLintConfig,
  type ResolvedConfig,
  type RuleSetting,
  type ScoringConfig,
} from './schema.js';
