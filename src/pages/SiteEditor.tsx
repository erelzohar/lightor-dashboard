import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, ChevronRight, Loader2, Monitor, Palette, Redo2, RotateCcw, Save, Smartphone, Undo2, X, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import { updateAppointmentType } from '../services/appointmentsApi';
import { deleteImage } from '../services/imagesApi';
import globals from '../services/globals';
import { removedStoredImages } from '../utils/aiReconcile';
import { useDraft } from '../hooks/useDraft';
import { usePreviewBridge, type SiteField, type SiteSelection } from '../hooks/usePreviewBridge';
import { getAt, removeAt, setAt } from '../utils/editorPaths';
import { fieldInfo, galleryItemPath, sectionFieldsFromConfig } from '../utils/editorFields';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import TextPanel from '../components/siteEditor/TextPanel';
import ImagePanel from '../components/siteEditor/ImagePanel';
import SectionPanel from '../components/siteEditor/SectionPanel';
import PagePanel from '../components/siteEditor/PagePanel';
import { fieldLabel, sectionLabel, vocabLang } from '../components/siteEditor/labels';
import AiBuilder from './AiBuilder';
import type { WebConfig } from '../types';

const CLIENT_APP_URL =
  (import.meta.env.VITE_CLIENT_APP_URL as string | undefined) || 'http://localhost:5174';

/** Every picture on the site, once — the ones an image can be swapped for. */
const siteImagesOf = (config: WebConfig): string[] => {
  const names = [
    config.logoImageName,
    config.components?.hero?.heroImageSrc,
    ...(config.components?.portfolio?.items ?? []).map((i) => i.url),
    ...(config.appointmentTypes ?? []).map((a) => a.image ?? ''),
  ].filter((n): n is string => !!n);
  return Array.from(new Set(names));
};

/**
 * LT-249 — the site editor (lightor-ai-split-plan.md §4). The live site in a
 * preview; a click on any text, picture or section selects it here; the panel
 * edits it by hand or with the AI; every change lands in one draft with undo
 * and redo; one Save publishes. A business without a site yet gets today's
 * "describe your business" builder instead.
 */
const SiteEditor: React.FC = () => {
  const dispatch = useAppDispatch();
  const { auth } = useAuth();
  const webConfig = useAppSelector((state) => state.webConfig.data);

  useEffect(() => {
    if (auth.user?.webConfig_id && !webConfig) dispatch(fetchWebConfig(auth.user.webConfig_id));
  }, [auth.user?.webConfig_id, webConfig, dispatch]);

  if (!webConfig?._id) {
    if (auth.user?.webConfig_id) {
      return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
    }
    return <AiBuilder />;
  }
  return <Editor key={webConfig._id} saved={webConfig} />;
};

const Editor: React.FC<{ saved: WebConfig }> = ({ saved }) => {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  const { direction } = useTheme();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const draft = useDraft<WebConfig>(saved);
  const baseRef = useRef<WebConfig>(saved);
  const [selection, setSelection] = useState<SiteSelection | null>(null);
  const [pageOpen, setPageOpen] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const uploads = useRef<Set<string>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // A request typed in the floating assistant (it still lands here until Lighty, phase 2).
  const [initialMessage] = useState(() => (location.state as { floatingMessage?: string } | null)?.floatingMessage);
  useEffect(() => {
    if (initialMessage) {
      window.history.replaceState({}, '');
      setPageOpen(true);
    }
  }, [initialMessage]);

  const previewUrl = import.meta.env.PROD && saved.subDomain ? `https://${saved.subDomain}.lightor.app` : CLIENT_APP_URL;
  const siteOrigin = useMemo(() => new URL(previewUrl).origin, [previewUrl]);

  const select = useCallback((next: SiteSelection | null) => {
    setSelection(next);
    if (next) setPageOpen(false);
  }, []);
  // On a phone the panel opens over the lower screen: bring what was tapped to the top.
  const scrollRef = useRef<(target: { path?: string | null; section?: string | null; block?: 'start' | 'center' }) => void>(() => undefined);
  const selectFromSite = useCallback((next: SiteSelection | null) => {
    select(next);
    if (next && window.innerWidth < 768) {
      scrollRef.current(next.kind === 'section' ? { section: next.section, block: 'start' } : { path: next.path, block: 'start' });
    }
  }, [select]);
  const bridge = usePreviewBridge({ iframeRef, siteOrigin, config: draft.value, selection, onSelect: selectFromSite });
  scrollRef.current = bridge.scrollTo;

  const update = useCallback((next: WebConfig, mergeKey?: string) => draft.set(next, mergeKey), [draft]);
  const setField = (path: string, value: unknown) => update(setAt(draft.value, path, value), path);

  // Undo / redo from the keyboard, unless the owner is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (e.shiftKey) draft.redo(); else draft.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft]);

  useEffect(() => {
    if (!draft.dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft.dirty]);

  /** Uploads of this session that `kept` does not use any more go (best effort). */
  const dropUnusedUploads = async (kept: WebConfig) => {
    const used = JSON.stringify(kept);
    const unused = Array.from(uploads.current).filter((name) => !used.includes(name));
    uploads.current = new Set(Array.from(uploads.current).filter((name) => used.includes(name)));
    await Promise.all(unused.map((name) => deleteImage(name).catch(() => undefined)));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const d = draft.value;
      const before = baseRef.current;
      // Services first: the config's answer below brings them back populated.
      const changedServices = (d.appointmentTypes ?? []).filter((s) => {
        const was = (before.appointmentTypes ?? []).find((b) => b._id === s._id);
        return was && (was.name !== s.name || was.price !== s.price || (was.image ?? '') !== (s.image ?? ''));
      });
      await Promise.all(changedServices.map((s) => updateAppointmentType(s._id, { name: s.name, price: s.price, image: s.image })));

      // Only what the editor edits travels: the rest of the config is not ours to resend.
      const payload: Partial<WebConfig> & { _id: string } = {
        _id: saved._id,
        businessName: d.businessName,
        logoImageName: d.logoImageName,
        components: d.components,
        pallete: d.pallete,
        ...(d.design !== undefined ? { design: d.design } : {}),
        ...(d.blocks !== undefined ? { blocks: d.blocks } : {}),
      };
      const result = await dispatch(updateWebConfig(payload));
      if (updateWebConfig.rejected.match(result)) throw new Error(result.error?.message ?? 'Web config update refused');
      const stored = result.payload as WebConfig;

      const removed = removedStoredImages(
        (before.components?.portfolio?.items ?? []).map((i) => i.url),
        (stored.components?.portfolio?.items ?? []).map((i) => i.url),
        globals.imagesUrl
      );
      await Promise.all(removed.map((name) => deleteImage(name).catch(() => undefined)));
      await dropUnusedUploads(stored);

      baseRef.current = stored;
      draft.reset(stored);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Site editor save failed:', err);
      toast.error(t('siteEditor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    setConfirmDiscard(false);
    setSelection(null);
    draft.reset(baseRef.current);
    await dropUnusedUploads(baseRef.current);
  };

  const backToSection = () => {
    if (!selection?.section) return;
    select({
      kind: 'section',
      path: null,
      section: selection.section,
      sectionType: selection.sectionType,
      fields: sectionFieldsFromConfig(draft.value, selection.section, selection.sectionType),
    });
  };

  const openField = (field: SiteField) => {
    const next: SiteSelection = { kind: field.kind, path: field.path, section: selection?.section ?? null, sectionType: selection?.sectionType ?? null };
    select(next);
    bridge.scrollTo({ path: field.path, block: window.innerWidth < 768 ? 'start' : 'center' });
  };

  const panel = () => {
    if (!selection) return <PagePanel config={draft.value} onUpdate={update} initialMessage={initialMessage} />;
    if (selection.kind === 'section' && selection.section) {
      return (
        <SectionPanel
          config={draft.value}
          section={selection.section}
          sectionType={selection.sectionType}
          fields={selection.fields ?? sectionFieldsFromConfig(draft.value, selection.section, selection.sectionType)}
          onUpdate={update}
          onSelectField={openField}
        />
      );
    }
    const path = selection.path ?? '';
    if (selection.kind === 'image' || fieldInfo(path).kind === 'image') {
      const galleryItem = galleryItemPath(path);
      return (
        <ImagePanel
          path={path}
          value={String(getAt(draft.value, path) ?? '')}
          siteImages={siteImagesOf(draft.value)}
          onChange={(name) => setField(path, name)}
          onUploaded={(name) => uploads.current.add(name)}
          onRemove={galleryItem ? () => { update(removeAt(draft.value, galleryItem)); setSelection(null); } : undefined}
        />
      );
    }
    return (
      <TextPanel
        path={path}
        value={String(getAt(draft.value, path) ?? '')}
        onChange={(value) => setField(path, value)}
        onApplyAi={(values) => {
          let next = draft.value;
          for (const [p, v] of Object.entries(values)) next = setAt(next, p, v);
          update(next);
        }}
      />
    );
  };

  const heading = !selection
    ? t('siteEditor.pageSettings')
    : selection.kind === 'section'
      ? sectionLabel(selection.sectionType ?? selection.section, lang)
      : fieldLabel(t, selection.path ?? '');
  const Back = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const sheetOpen = !!selection || pageOpen;
  const iconButton = 'p-2 rounded-full text-gray-500 dark:text-slate-400 hover:text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="flex flex-col h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] -m-4 md:-m-6 overflow-hidden bg-gradient-to-br from-violet-50 via-slate-50 to-indigo-50/70 dark:from-slate-950 dark:via-violet-950/10 dark:to-slate-950">
      {/* ── Top bar ── */}
      <header className="h-14 md:h-16 flex items-center justify-between gap-2 px-3 md:px-6 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Palette className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          <h1 className="font-semibold text-gray-800 dark:text-white text-[15px] truncate">{t('siteEditor.title')}</h1>
          {draft.dirty && <span className="hidden sm:inline text-xs text-amber-600 dark:text-amber-400">• {t('siteEditor.unsaved')}</span>}
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center gap-1 me-2">
            <button type="button" className={`${iconButton} ${device === 'desktop' ? 'text-primary' : ''}`} onClick={() => setDevice('desktop')} title={t('siteEditor.desktop')} aria-label={t('siteEditor.desktop')} aria-pressed={device === 'desktop'}>
              <Monitor className="w-4 h-4" />
            </button>
            <button type="button" className={`${iconButton} ${device === 'phone' ? 'text-primary' : ''}`} onClick={() => setDevice('phone')} title={t('siteEditor.phone')} aria-label={t('siteEditor.phone')} aria-pressed={device === 'phone'}>
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <button type="button" className={iconButton} onClick={draft.undo} disabled={!draft.canUndo} title={t('siteEditor.undo')} aria-label={t('siteEditor.undo')}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" className={iconButton} onClick={draft.redo} disabled={!draft.canRedo} title={t('siteEditor.redo')} aria-label={t('siteEditor.redo')}>
            <Redo2 className="w-4 h-4" />
          </button>
          <button type="button" className={`${iconButton} md:hidden`} onClick={() => { setSelection(null); setPageOpen((v) => !v); }} title={t('siteEditor.pageSettings')} aria-label={t('siteEditor.pageSettings')}>
            <Palette className="w-4 h-4" />
          </button>
          <button type="button" className={iconButton} onClick={() => setConfirmDiscard(true)} disabled={!draft.dirty || saving} title={t('siteEditor.discard')} aria-label={t('siteEditor.discard')}>
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!draft.dirty || saving}
            className={`ms-1 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-md disabled:opacity-50 ${justSaved ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-primary to-violet-500 text-white'}`}
          >
            {justSaved ? <CheckCircle2 className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">{justSaved ? t('siteEditor.saved') : saving ? t('siteEditor.saving') : t('siteEditor.save')}</span>
          </button>
        </div>
      </header>

      {/* ── Workspace ── */}
      <main className="flex-1 flex overflow-hidden md:px-5 md:pb-5 md:gap-4 relative">
        <section className="flex-1 flex flex-col overflow-hidden md:rounded-3xl md:border md:border-white/60 dark:md:border-slate-700/50 bg-white/50 dark:bg-slate-800/50">
          <div className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-slate-900">
            <div
              className="absolute overflow-hidden bg-white"
              style={device === 'phone' ? {
                width: 375, height: 'min(740px, calc(100% - 32px))', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                borderRadius: 28, border: '8px solid #1e1e22', boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
              } : { inset: 0 }}
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                onLoad={bridge.onLoad}
                title={t('siteEditor.previewTitle')}
                className="absolute inset-0 w-full h-full border-0 block"
              />
            </div>
            {!bridge.ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70" role="status">
                <Loader2 className="w-5 h-5 animate-spin text-primary me-2" />
                <span className="text-sm text-gray-500 dark:text-slate-400">{t('siteEditor.loading')}</span>
              </div>
            )}
          </div>
        </section>

        {/* ── Panel: beside the preview from md up, a bottom sheet on phones ── */}
        <aside
          className={`${sheetOpen ? 'flex' : 'hidden'} md:flex flex-col fixed md:static inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-auto z-40 max-h-[62vh] md:max-h-none md:w-[380px] shrink-0 rounded-t-3xl md:rounded-3xl bg-white dark:bg-slate-900 md:bg-white/80 md:dark:bg-slate-800/80 shadow-2xl md:shadow-lg border-t md:border border-gray-100 dark:border-slate-700/50 overflow-hidden`}
          aria-label={heading}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-1 min-w-0">
              {selection && selection.kind !== 'section' && selection.section && (
                <button type="button" onClick={backToSection} className={iconButton} title={t('siteEditor.backToSection')} aria-label={t('siteEditor.backToSection')}>
                  <Back className="w-4 h-4" />
                </button>
              )}
              <div className="min-w-0">
                {selection && selection.kind !== 'section' && selection.sectionType && (
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{sectionLabel(selection.sectionType, lang)}</p>
                )}
                <h2 className="font-semibold text-gray-800 dark:text-white truncate">{heading}</h2>
              </div>
            </div>
            {(selection || pageOpen) && (
              <button type="button" className={iconButton} onClick={() => { setSelection(null); setPageOpen(false); }} title={t('siteEditor.close')} aria-label={t('siteEditor.close')}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!selection && <p className="mb-4 text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.hint')}</p>}
            {panel()}
          </div>
        </aside>
      </main>

      <ConfirmDialog
        open={confirmDiscard}
        title={t('siteEditor.discardTitle')}
        message={t('siteEditor.discardBody')}
        confirmLabel={t('siteEditor.discard')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={() => void discard()}
        onClose={() => setConfirmDiscard(false)}
      />
    </div>
  );
};

export default SiteEditor;
