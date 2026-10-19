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

/**
 * LT-429: the en-dash stays only in time ranges ("9:00–13:00", "{{from}}–{{to}}");
 * a label like "Review 1 – name" takes the plain hyphen too.
 */
const LOCALES = import.meta.glob('../../i18n/locales/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const strings = (node: unknown, path: string, out: Array<[string, string]>) => {
  if (typeof node === 'string') out.push([path, node]);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) strings(v, path ? `${path}.${k}` : k, out);
  return out;
};

describe('no en-dash in the locales outside a range', () => {
  it('has none between words', () => {
    expect(Object.keys(LOCALES).length).toBe(5);
    const between = /(?<![\d}])–|–(?![\d{])/;
    const found = Object.entries(LOCALES).flatMap(([file, raw]) =>
      strings(JSON.parse(raw), '', []).filter(([, v]) => between.test(v)).map(([k]) => `${file.split('/').pop()}:${k}`)
    );
    expect(found).toEqual([]);
  });
});
