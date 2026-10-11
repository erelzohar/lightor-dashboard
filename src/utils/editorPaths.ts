/**
 * LT-249 — reading and writing a site config by the paths the public site
 * puts on what it draws (lightor-front `services/editMode.ts`):
 *
 *   components.hero.title · components.about.features.1.title ·
 *   blocks.<blockId>.props.items.0.value · services.<id>.name ·
 *   businessName · logoImageName
 *
 * `blocks.<id>` and `services.<id>` are found by id — blocks in
 * `config.blocks`, services in `config.appointmentTypes` (the services live in
 * their own collection; the editor saves them through their own API). A
 * numeric segment is an array index. Writes copy every object on the way, so
 * the editor's undo history keeps whole snapshots.
 */

type Json = Record<string, unknown>;

const isRecord = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

const listOf = (seg: string): { key: string; idKey: string } | null =>
  seg === 'blocks' ? { key: 'blocks', idKey: 'id' } : seg === 'services' ? { key: 'appointmentTypes', idKey: '_id' } : null;

export const getAt = (config: unknown, path: string): unknown => {
  if (!isRecord(config)) return undefined;
  const segs = path.split('.');
  let cur: unknown = config;
  let i = 0;
  const byId = listOf(segs[0]);
  if (byId) {
    const list = config[byId.key];
    cur = Array.isArray(list) ? list.find((x) => isRecord(x) && x[byId.idKey] === segs[1]) : undefined;
    i = 2;
  }
  for (; i < segs.length; i++) {
    if (cur == null) return undefined;
    const seg = segs[i];
    cur = Array.isArray(cur) ? cur[Number(seg)] : isRecord(cur) ? cur[seg] : undefined;
  }
  return cur;
};

const setIn = (node: unknown, segs: string[], value: unknown): unknown => {
  if (!segs.length) return value;
  const [seg, ...rest] = segs;
  if (Array.isArray(node) || (node == null && /^\d+$/.test(seg))) {
    const arr = Array.isArray(node) ? [...node] : [];
    const at = Number(seg);
    arr[at] = setIn(arr[at], rest, value);
    return arr;
  }
  const obj: Json = isRecord(node) ? { ...node } : {};
  obj[seg] = setIn(obj[seg], rest, value);
  return obj;
};

/** A copy of `config` with `path` set to `value`; unchanged when the block or service is gone. */
export const setAt = <T>(config: T, path: string, value: unknown): T => {
  if (!isRecord(config)) return config;
  const segs = path.split('.');
  const byId = listOf(segs[0]);
  if (!byId) return setIn(config, segs, value) as T;
  const list = Array.isArray(config[byId.key]) ? (config[byId.key] as unknown[]) : [];
  const at = list.findIndex((x) => isRecord(x) && x[byId.idKey] === segs[1]);
  if (at === -1) return config;
  const next = [...list];
  next[at] = setIn(list[at], segs.slice(2), value);
  return { ...config, [byId.key]: next } as T;
};

/** A copy without the array item `path` names (a gallery photo: `components.portfolio.items.2`). */
export const removeAt = <T>(config: T, path: string): T => {
  const segs = path.split('.');
  const at = Number(segs[segs.length - 1]);
  const parentPath = segs.slice(0, -1).join('.');
  const parent = getAt(config, parentPath);
  if (!Array.isArray(parent) || !Number.isInteger(at)) return config;
  return setAt(config, parentPath, parent.filter((_, i) => i !== at));
};

// ── Blocks (a composed page) ────────────────────────────────────────────

export interface BlockLike {
  id: string;
  type: string;
  variant?: string;
  mod?: Record<string, unknown>;
  [k: string]: unknown;
}

const blocksOf = (config: unknown): BlockLike[] =>
  isRecord(config) && Array.isArray(config.blocks) ? (config.blocks as BlockLike[]) : [];

export const blockById = (config: unknown, id: string | null | undefined): BlockLike | undefined =>
  id ? blocksOf(config).find((b) => b.id === id) : undefined;

/** A copy with the block's own fields merged (`undefined` removes a field). */
export const patchBlock = <T>(config: T, id: string, patch: Partial<BlockLike>): T => {
  const blocks = blocksOf(config);
  const at = blocks.findIndex((b) => b.id === id);
  if (at === -1) return config;
  const merged: BlockLike = { ...blocks[at], ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete merged[k];
  const next = [...blocks];
  next[at] = merged;
  return { ...(config as Json), blocks: next } as T;
};

export const moveBlock = <T>(config: T, id: string, by: -1 | 1): T => {
  const blocks = [...blocksOf(config)];
  const at = blocks.findIndex((b) => b.id === id);
  const to = at + by;
  if (at === -1 || to < 0 || to >= blocks.length) return config;
  [blocks[at], blocks[to]] = [blocks[to], blocks[at]];
  return { ...(config as Json), blocks } as T;
};

export const removeBlock = <T>(config: T, id: string): T => {
  const blocks = blocksOf(config);
  if (!blocks.some((b) => b.id === id)) return config;
  return { ...(config as Json), blocks: blocks.filter((b) => b.id !== id) } as T;
};
