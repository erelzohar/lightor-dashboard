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
