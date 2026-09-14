import type { IssueType, Severity, TranslationIssue } from '@lingolint/core';

export type SeverityFilter = 'all' | Severity;

/** Coarse groups shown as filter chips. */
export const TYPE_GROUPS: { id: string; label: string; types: readonly IssueType[] }[] = [
  {
    id: 'keys',
    label: 'Missing / extra keys',
    types: ['missing_key', 'extra_key', 'empty_translation'],
  },
  { id: 'variables', label: 'Variables', types: ['placeholder_mismatch'] },
  { id: 'html', label: 'HTML', types: ['html_mismatch'] },
  { id: 'untranslated', label: 'Untranslated', types: ['identical_to_source'] },
  { id: 'whitespace', label: 'Whitespace', types: ['whitespace'] },
  { id: 'length', label: 'Length', types: ['length'] },
  { id: 'duplicates', label: 'Duplicates', types: ['duplicate_translation'] },
  { id: 'terminology', label: 'Terminology', types: ['terminology'] },
  { id: 'grammar', label: 'Grammar', types: ['grammar', 'semantic'] },
  { id: 'tone', label: 'Tone & style', types: ['tone', 'style'] },
  { id: 'capitalization', label: 'Capitalization', types: ['capitalization'] },
];

export const TYPE_LABELS: Record<IssueType, string> = {
  missing_key: 'Missing key',
  extra_key: 'Extra key',
  empty_translation: 'Empty',
  placeholder_mismatch: 'Placeholder',
  html_mismatch: 'HTML',
  whitespace: 'Whitespace',
  identical_to_source: 'Untranslated',
  length: 'Length',
  duplicate_translation: 'Duplicate',
  terminology: 'Terminology',
  semantic: 'Meaning',
  grammar: 'Grammar',
  tone: 'Tone',
  capitalization: 'Capitalization',
  style: 'Style',
};

export interface IssueFilters {
  severity: SeverityFilter;
  /** Group ids; empty means all. */
  groups: readonly string[];
  query: string;
  showIgnored: boolean;
}

export const defaultFilters: IssueFilters = {
  severity: 'all',
  groups: [],
  query: '',
  showIgnored: false,
};

export function groupOf(type: IssueType): string | undefined {
  return TYPE_GROUPS.find((group) => group.types.includes(type))?.id;
}

export function filterIssues(
  issues: readonly TranslationIssue[],
  filters: IssueFilters,
  ignored: readonly string[],
): TranslationIssue[] {
  const query = filters.query.trim().toLowerCase();
  const ignoredSet = new Set(ignored);
  return issues.filter((issue) => {
    if (!filters.showIgnored && ignoredSet.has(issue.id)) {
      return false;
    }
    if (filters.severity !== 'all' && issue.severity !== filters.severity) {
      return false;
    }
    if (filters.groups.length > 0) {
      const group = groupOf(issue.type);
      if (group === undefined || !filters.groups.includes(group)) {
        return false;
      }
    }
    if (query !== '') {
      const haystack = [
        issue.key,
        issue.message,
        issue.sourceText ?? '',
        issue.translatedText ?? '',
      ]
        .join('\n')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

/** Number of issues per group, for chip badges. */
export function countByGroup(issues: readonly TranslationIssue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    const group = groupOf(issue.type);
    if (group !== undefined) {
      counts[group] = (counts[group] ?? 0) + 1;
    }
  }
  return counts;
}
