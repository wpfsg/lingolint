import { describe, expect, it } from 'vitest';
import { htmlTagsRule, placeholdersRule } from '../../src/index.js';
import { runRule } from '../helpers.js';

describe('placeholders rule', () => {
  it('reports a missing placeholder with structured details', () => {
    const issues = runRule(
      placeholdersRule,
      { total: 'Total: {amount} {currency}' },
      { total: 'Total: {amount}' },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      key: 'total',
      message: 'Missing placeholder: {currency}',
      details: { missing: ['{currency}'], unexpected: [] },
    });
  });

  it('describes renamed placeholders', () => {
    const [issue] = runRule(placeholdersRule, { w: 'Hi {name}' }, { w: 'Hola {nombre}' });
    expect(issue?.message).toBe('Placeholder {name} appears to have been renamed to {nombre}');
  });

  it('handles multiple syntaxes in one project', () => {
    const issues = runRule(
      placeholdersRule,
      { a: '{{price}} / month', b: '%d files', c: '${user} joined' },
      { a: '{{precio}} / mes', b: 'archivos', c: '${user} se unió' },
    );
    expect(issues.map((i) => i.key)).toEqual(['a', 'b']);
  });

  it('skips empty translations (reported elsewhere)', () => {
    expect(runRule(placeholdersRule, { a: '{x}' }, { a: '' })).toEqual([]);
  });

  it('can restrict recognised syntaxes', () => {
    const issues = runRule(
      placeholdersRule,
      { a: 'Send %s to {name}' },
      { a: 'Enviar %s' },
      { options: { syntaxes: ['printf'] } },
    );
    expect(issues).toEqual([]);
  });
});

describe('htmlTags rule', () => {
  it('reports an unclosed tag', () => {
    const [issue] = runRule(
      htmlTagsRule,
      { c: 'Click <strong>Continue</strong>' },
      { c: 'Haz clic en <strong>Continuar' },
    );
    expect(issue?.message).toBe('Tag <strong> is never closed');
  });

  it('reports missing tags', () => {
    const [issue] = runRule(
      htmlTagsRule,
      { c: 'Read the <a>terms</a>' },
      { c: 'Lee los términos' },
    );
    expect(issue?.message).toBe('Missing tags: <a>, </a>');
  });

  it('passes when tags match', () => {
    expect(
      runRule(htmlTagsRule, { c: 'Line<br/>break <b>x</b>' }, { c: 'Salto<br>de línea <b>y</b>' }),
    ).toEqual([]);
  });

  it('skips strings without markup quickly', () => {
    expect(runRule(htmlTagsRule, { c: 'plain' }, { c: 'simple' })).toEqual([]);
  });
});
