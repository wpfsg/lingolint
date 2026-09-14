import type { IssueSummary } from '@lingolint/core';
import { TYPE_GROUPS, type IssueFilters, type SeverityFilter } from '../lib/filters.js';

interface FiltersProps {
  filters: IssueFilters;
  onChange: (filters: IssueFilters) => void;
  groupCounts: Record<string, number>;
  summary: IssueSummary;
  ignoredCount: number;
}

const SEVERITIES: { id: SeverityFilter; label: string; count: (s: IssueSummary) => number }[] = [
  { id: 'all', label: 'All', count: (s) => s.total },
  { id: 'error', label: 'Errors', count: (s) => s.errors },
  { id: 'warning', label: 'Warnings', count: (s) => s.warnings },
  { id: 'info', label: 'Suggestions', count: (s) => s.info },
];

export function Filters({ filters, onChange, groupCounts, summary, ignoredCount }: FiltersProps) {
  const toggleGroup = (id: string) => {
    const groups = filters.groups.includes(id)
      ? filters.groups.filter((g) => g !== id)
      : [...filters.groups, id];
    onChange({ ...filters, groups });
  };

  return (
    <section className="filters">
      <div className="filters-row">
        <div className="segmented" role="group" aria-label="Severity">
          {SEVERITIES.map((severity) => (
            <button
              key={severity.id}
              type="button"
              className={`seg${filters.severity === severity.id ? ' is-active' : ''} seg-${severity.id}`}
              onClick={() => {
                onChange({ ...filters, severity: severity.id });
              }}
            >
              {severity.label} <span className="count">{severity.count(summary)}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="search"
          placeholder="Search key, source or translation"
          value={filters.query}
          onChange={(event) => {
            onChange({ ...filters, query: event.target.value });
          }}
        />
        {ignoredCount > 0 ? (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={filters.showIgnored}
              onChange={(event) => {
                onChange({ ...filters, showIgnored: event.target.checked });
              }}
            />
            Show dismissed ({ignoredCount})
          </label>
        ) : null}
      </div>
      <div className="chips" role="group" aria-label="Issue type">
        {TYPE_GROUPS.filter((group) => (groupCounts[group.id] ?? 0) > 0).map((group) => (
          <button
            key={group.id}
            type="button"
            className={`chip${filters.groups.includes(group.id) ? ' is-active' : ''}`}
            onClick={() => {
              toggleGroup(group.id);
            }}
          >
            {group.label} <span className="count">{groupCounts[group.id]}</span>
          </button>
        ))}
        {filters.groups.length > 0 ? (
          <button
            type="button"
            className="link"
            onClick={() => {
              onChange({ ...filters, groups: [] });
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}
