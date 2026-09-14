import type { LocaleReport } from '@lingolint/core';

interface SummaryProps {
  report: LocaleReport;
  ignoredCount: number;
}

function scoreTone(score: number): string {
  return score >= 90 ? 'good' : score >= 70 ? 'fair' : 'poor';
}

export function Summary({ report, ignoredCount }: SummaryProps) {
  return (
    <section className="summary">
      <div className={`score score-${scoreTone(report.score)}`}>
        <div className="score-value">
          {report.score}
          <span className="score-max">/100</span>
        </div>
        <div className="score-label">Translation health · {report.targetLocaleName}</div>
      </div>
      <dl className="stats">
        <div className="stat stat-error">
          <dt>Errors</dt>
          <dd>{report.summary.errors}</dd>
        </div>
        <div className="stat stat-warning">
          <dt>Warnings</dt>
          <dd>{report.summary.warnings}</dd>
        </div>
        <div className="stat stat-info">
          <dt>Suggestions</dt>
          <dd>{report.summary.info}</dd>
        </div>
        <div className="stat">
          <dt>Keys</dt>
          <dd>{report.keyCount}</dd>
        </div>
        {ignoredCount > 0 ? (
          <div className="stat">
            <dt>Dismissed</dt>
            <dd>{ignoredCount}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
