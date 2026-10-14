import { fieldInfo } from './editorFields';

/**
 * LT-249 — what an AI answer changed on the site, in the owner's words: the
 * texts by their field names, then "the look" when the design or the colours
 * moved. `label` names a path (the editor passes its translated labels).
 */
/** Every text leaf of a config, by path (for "what changed"). */
const textLeaves = (node: unknown, prefix: string, out: Map<string, string>) => {
  if (typeof node === 'string') out.set(prefix, node);
  else if (Array.isArray(node)) node.forEach((v, i) => textLeaves(v, `${prefix}.${i}`, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) textLeaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
};

/** The names of what an answer changed: texts by their labels, then the look. */
export const changedLabels = (before: unknown, after: unknown, label: (path: string) => string, lookLabel: string): string[] => {
  const pick = (cfg: unknown) => {
    const out = new Map<string, string>();
    const c = (cfg ?? {}) as Record<string, unknown>;
    textLeaves(c.components, 'components', out);
    if (typeof c.businessName === 'string') out.set('businessName', c.businessName);
    return out;
  };
  const a = pick(before);
  const b = pick(after);
  const names: string[] = [];
  for (const [path, value] of b) {
    if (a.get(path) === value) continue;
    const info = fieldInfo(path);
    if (info.label === 'text') continue; // not a field the owner sees by name (flags, icons)
    const name = label(path);
    if (!names.includes(name)) names.push(name);
  }
  const look = (cfg: unknown) => JSON.stringify([(cfg as Record<string, unknown>)?.design ?? null, (cfg as Record<string, unknown>)?.pallete ?? null]);
  if (look(before) !== look(after)) names.push(lookLabel);
  return names;
};

/**
 * Lands a whole-site AI answer on the draft as it is now (LT-315).
 *
 * The answer is a full config built from `before`, the draft when the
 * request left. Replacing the draft with it reverted whatever the owner did
 * while Lighty was thinking. Instead, only the parts the answer changed
 * travel — each top-level key, and each section under `components`, taken
 * whole from `after` when it differs from `before` — and every other part
 * stays as it is in `prev`. Where both touched the same section, the answer
 * wins, as it would have before.
 */
export const applyAiAnswer = <T,>(prev: T, before: T, after: T): T => {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const p = { ...(prev as Record<string, unknown>) };
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const put = (target: Record<string, unknown>, key: string, value: unknown) => {
    if (value === undefined) delete target[key];
    else target[key] = value;
  };
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (key === 'components') continue;
    if (!same(b[key], a[key])) put(p, key, a[key]);
  }
  const bc = (b.components ?? {}) as Record<string, unknown>;
  const ac = (a.components ?? {}) as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(bc), ...Object.keys(ac)])].filter((k) => !same(bc[k], ac[k]));
  if (changed.length) {
    const components = { ...((p.components ?? {}) as Record<string, unknown>) };
    for (const k of changed) put(components, k, ac[k]);
    p.components = components;
  }
  return p as T;
};
