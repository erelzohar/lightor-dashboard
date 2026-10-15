import { describe, it, expect } from 'vitest';
import ts from 'typescript';

/**
 * LT-350: no em-dash anywhere a person reads (Erel): a plain hyphen instead.
 * Every string, template and JSX text in the app's source, and every value in
 * its JSON, is checked; comments and regexes may keep theirs.
 */
const EM = '\u2014';
const SOURCES = import.meta.glob(['../../**/*.{ts,tsx,json}', '!../../tests/**', '!../../**/*.d.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TEXT = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

const offenders = ([file, src]: [string, string]): string[] => {
  if (!src.includes(EM) && !/\\u2014/i.test(src)) return [];
  const rel = file.replace(/^(\.\.\/)+/, '');
  if (file.endsWith('.json')) return src.includes(EM) ? [rel] : [];
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (TEXT.has(node.kind)) {
      const raw = src.slice(node.kind === ts.SyntaxKind.JsxText ? node.pos : node.getStart(sf), node.end);
      if (raw.includes(EM) || /\\u2014/i.test(raw)) found.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
};

describe('no em-dash in the app', () => {
  it('has none in any text a person can read', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    expect(Object.entries(SOURCES).flatMap(offenders)).toEqual([]);
  });
});
