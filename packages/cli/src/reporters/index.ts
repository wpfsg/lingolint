export { formatJson, toJsonOutput, type JsonOutput } from './json.js';
export { formatPretty, type PrettyOptions } from './pretty.js';

export const OUTPUT_FORMATS = ['pretty', 'json'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
