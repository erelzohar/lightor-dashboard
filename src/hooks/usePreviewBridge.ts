import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * LT-249 — the editor's side of the bridge with the public site in the
 * preview (lightor-ai-split-plan.md §4.3; the site's side is lightor-front
 * `services/editMode.ts`, LT-243). The site says LT_READY once its listener
 * is up; the editor then sends the draft (PREVIEW_DATA, on every change) and
 * LT_EDIT on, and keeps the site's highlight on what the panel has selected.
 * A click on the site comes back as LT_SELECT / LT_DESELECT. Messages go to,
 * and are only taken from, the site's own origin and its own window.
 */
export interface SiteField { path: string; kind: 'text' | 'image' }

export interface SiteSelection {
  kind: 'text' | 'image' | 'section';
  path: string | null;
  section: string | null;
  sectionType: string | null;
  /** A section's own fields, as the site draws them (front LT-249). */
  fields?: SiteField[];
}

interface Options {
  iframeRef: RefObject<HTMLIFrameElement>;
  siteOrigin: string;
  config: unknown;
  selection: SiteSelection | null;
  onSelect: (selection: SiteSelection | null) => void;
}

/** An older site build never says LT_READY; after this long the editor talks anyway. */
const READY_FALLBACK_MS = 4000;
/** Typing posts the draft at most this often. */
const POST_DELAY_MS = 120;

export function usePreviewBridge({ iframeRef, siteOrigin, config, selection, onSelect }: Options) {
  // Counts the site's LT_READY: a page that loads again (a refresh, a dev
  // reload) says it again and gets the draft and the editor again.
  const [readySeq, setReadySeq] = useState(0);
  const ready = readySeq > 0;
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const post = useCallback((message: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(message, siteOrigin);
  }, [iframeRef, siteOrigin]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== siteOrigin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as Record<string, unknown> | null;
      if (data?.type === 'LT_READY') {
        setReadySeq((n) => n + 1);
      } else if (data?.type === 'LT_SELECT') {
        onSelectRef.current({
          kind: data.kind === 'image' || data.kind === 'section' ? data.kind : 'text',
          path: typeof data.path === 'string' ? data.path : null,
          section: typeof data.section === 'string' ? data.section : null,
          sectionType: typeof data.sectionType === 'string' ? data.sectionType : null,
          fields: Array.isArray(data.fields) ? (data.fields as SiteField[]) : undefined,
        });
      } else if (data?.type === 'LT_DESELECT') {
        onSelectRef.current(null);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [iframeRef, siteOrigin]);

  // The iframe finished loading but the site never announced itself.
  const fallback = useRef<ReturnType<typeof setTimeout>>();
  const onLoad = useCallback(() => {
    clearTimeout(fallback.current);
    fallback.current = setTimeout(() => setReadySeq((n) => n || 1), READY_FALLBACK_MS);
  }, []);
  useEffect(() => { if (ready) clearTimeout(fallback.current); }, [ready]);
  useEffect(() => () => clearTimeout(fallback.current), []);

  /** Before reloading the iframe: wait for the new page's LT_READY. */
  const reloading = useCallback(() => setReadySeq(0), []);

  useEffect(() => {
    if (!readySeq) return;
    const id = setTimeout(() => post({ type: 'PREVIEW_DATA', config }), POST_DELAY_MS);
    return () => clearTimeout(id);
  }, [readySeq, config, post]);

  useEffect(() => {
    if (readySeq) post({ type: 'LT_EDIT', on: true });
  }, [readySeq, post]);

  const selPath = selection?.kind === 'section' ? null : selection?.path ?? null;
  const selSection = selection?.kind === 'section' ? selection.section : null;
  useEffect(() => {
    if (readySeq) post({ type: 'LT_SELECT_PATH', path: selPath, section: selSection });
  }, [readySeq, selPath, selSection, post]);

  const scrollTo = useCallback((target: { path?: string | null; section?: string | null; block?: 'start' | 'center' }) => {
    post({ type: 'LT_SCROLL_TO', path: target.path ?? null, section: target.section ?? null, ...(target.block ? { block: target.block } : {}) });
  }, [post]);

  return { ready, onLoad, reloading, scrollTo };
}
