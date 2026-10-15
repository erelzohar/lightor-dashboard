import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Layers, Loader2, Monitor, Palette, Redo2, RotateCcw, Save, Smartphone, Undo2, X, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnsavedChangesGuard } from '../contexts/LeaveGuardContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import { updateAppointmentType } from '../services/appointmentsApi';
import { deleteImage } from '../services/imagesApi';
import globals from '../services/globals';
import { removedStoredImages, unreferencedImages } from '../utils/aiReconcile';
import { useDraft, type DraftUpdate } from '../hooks/useDraft';
import { usePreviewBridge, type SiteField, type SiteSelection } from '../hooks/usePreviewBridge';
import { switchFade, useDeviceSwitch } from '../hooks/useDeviceSwitch';
import { PhoneScreenMarks, PhoneSurround, phoneBox } from '../components/siteEditor/phoneShell';
import { getAt, patchBlock, removeAt, setAt } from '../utils/editorPaths';
import { fieldInfo, galleryItemPath, sectionFieldsFromConfig } from '../utils/editorFields';
import { addGalleryPhoto, addSection, availabilityOf, cleanForSave, moveBlockTo, rowsOf, withBlocks, type SectionRow } from '../utils/siteSections';
import { aiService } from '../services/aiApi';
import { fetchMyEntitlements } from '../services/entitlementsApi';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import TextPanel from '../components/siteEditor/TextPanel';
import ImagePanel from '../components/siteEditor/ImagePanel';
import SectionPanel from '../components/siteEditor/SectionPanel';
import PagePanel from '../components/siteEditor/PagePanel';
import SectionsPanel from '../components/siteEditor/SectionsPanel';
import AddSectionPanel from '../components/siteEditor/AddSectionPanel';
import { fieldLabel, sectionLabel, vocabLang } from '../components/siteEditor/labels';
import AiBuilder from './AiBuilder';
import type { WebConfig } from '../types';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/segmented-tabs';
import { siteUrlOf } from '../utils/siteUrl';
import { pop } from '../components/ui/pop-button';

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
  const { device, picked: pickedDevice, hidden: switchingDevice, switchTo: setDevice } = useDeviceSwitch<'desktop' | 'phone'>('desktop');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const uploads = useRef<Set<string>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // A request typed in the floating assistant (it still lands here until Lighty, phase 2).
  // Forgotten once sent (LT-315): the design tab re-mounts its chat on every
  // tab switch or selection, and each new chat would send it again.
  const [initialMessage, setInitialMessage] = useState(() => (location.state as { floatingMessage?: string } | null)?.floatingMessage);
  const initialMessageSent = useCallback(() => setInitialMessage(undefined), []);
  // LT-252: with nothing selected the panel is the whole site — its sections, or its design.
  const [siteTab, setSiteTab] = useState<'sections' | 'design'>(initialMessage ? 'design' : 'sections');
  // The add-section list, placed below a section (`after`) or where each one belongs (null).
  const [adding, setAdding] = useState<{ after: string | null } | null>(null);
  // The section the AI is drafting for the owner.
  const [drafting, setDrafting] = useState<string | null>(null);
  // An add waits for its draft; it lands on the draft as it is by then.
  const draftRef = useRef(draft.value);
  draftRef.current = draft.value;
  useEffect(() => {
    if (initialMessage) {
      window.history.replaceState({}, '');
      setPageOpen(true);
    }
  }, [initialMessage]);

  // Built safely (LT-315, L2): the preview's origin is also the only origin
  // the editor's bridge trusts.
  const liveSite = siteUrlOf(saved.subDomain);
  const previewUrl = import.meta.env.PROD && liveSite ? liveSite : CLIENT_APP_URL;
  const siteOrigin = useMemo(() => new URL(previewUrl).origin, [previewUrl]);

  const select = useCallback((next: SiteSelection | null) => {
    setSelection(next);
    setAdding(null);
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
  // LT-312: a Plus site's corner is Lighty, not the contact button — the
  // preview shows it as the live site does (the draft itself carries no plan).
  const [plus, setPlus] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchMyEntitlements().then((e) => { if (live) setPlus(e?.plan === 'plus'); });
    return () => { live = false; };
  }, []);
  const previewConfig = useMemo(() => (plus ? { ...draft.value, assistant: true } : draft.value), [draft.value, plus]);
  const bridge = usePreviewBridge({ iframeRef, siteOrigin, config: previewConfig, selection, onSelect: selectFromSite });
  scrollRef.current = bridge.scrollTo;

  const update = useCallback((next: DraftUpdate<WebConfig>, mergeKey?: string) => draft.set(next, mergeKey), [draft]);
  // LT-320: a gallery photo uploaded here lands on the draft as it is once the
  // upload is done — through the updater (LT-315), so edits made while it
  // uploaded stay.
  const addPhoto = (imageName: string) => {
    uploads.current.add(imageName);
    update((prev) => addGalleryPhoto(prev, imageName));
  };
  // On the draft as it is when the value lands (LT-315): an upload or an AI
  // answer can arrive after other edits, which must not be reverted.
  const setField = (path: string, value: unknown) => update((prev) => setAt(prev, path, value), path);

  // ── LT-252: the page's sections ──
  const rows = useMemo(() => rowsOf(draft.value, bridge.layout), [draft.value, bridge.layout]);

  // A selection whose section is gone (removed, or undone back to a legacy page) closes.
  useEffect(() => {
    const id = selection?.kind === 'section' ? selection.section : null;
    if (!id || id === 'navbar' || id === 'contactButton') return;
    const blocks = draft.value.blocks;
    if (blocks?.length ? !blocks.some((b) => b.id === id) : /^b\d+$/.test(id)) setSelection(null);
  }, [draft.value, selection]);

  /**
   * The draft with blocks — a legacy page turns into the blocks it is drawn
   * as — with the selection following its section to its new block.
   */
  const blocksNow = () => {
    const { config, idOf } = withBlocks(draftRef.current, bridge.layout);
    const idFor = (section: string | null | undefined) => (section ? idOf[section] ?? section : null);
    if (selection?.section && idOf[selection.section]) {
      const id = idOf[selection.section];
      const type = config.blocks?.find((b) => b.id === id)?.type ?? null;
      setSelection((s) => (s ? { ...s, section: id, sectionType: type } : s));
    }
    return { config, idFor };
  };

  const selectRow = (row: SectionRow) => {
    // A legacy page's sections are drawn under their own names until it has blocks.
    const section = row.key ?? row.id;
    const sectionType = row.key ?? row.type;
    select({ kind: 'section', path: null, section, sectionType, fields: sectionFieldsFromConfig(draft.value, section, sectionType) });
    bridge.scrollTo({ section, block: 'start' });
  };

  const toggleRow = (row: SectionRow) => {
    const { config } = blocksNow();
    const block = config.blocks?.find((b) => b.id === row.id);
    if (!block) return;
    const mod = { ...(block.mod ?? {}) };
    if (mod.hidden) delete mod.hidden; else mod.hidden = true;
    update(patchBlock(config, block.id, { mod }));
  };

  const moveRow = (row: SectionRow, to: number) => update(moveBlockTo(blocksNow().config, row.id, to));

  /** The selected section one place up or down — never above the opening or below the footer. */
  const moveSelected = (by: -1 | 1) => {
    const { config, idFor } = blocksNow();
    const blocks = config.blocks ?? [];
    const id = idFor(selection?.section);
    const at = blocks.findIndex((b) => b.id === id);
    if (!id || at === -1) return;
    const lo = blocks[0]?.type === 'hero' ? 1 : 0;
    const hi = blocks[blocks.length - 1]?.type === 'footer' ? blocks.length - 2 : blocks.length - 1;
    const to = Math.min(Math.max(at + by, lo), hi);
    if (to !== at) update(moveBlockTo(config, id, to));
    else if (config !== draftRef.current) update(config);
  };

  const addNewSection = async (type: string, at: number) => {
    if (drafting || !availabilityOf(draftRef.current, type, rows.length).ok) return;
    let content: Record<string, unknown> | null = null;
    if (availabilityOf(draftRef.current, type, 0).source === 'ai') {
      setDrafting(type);
      try {
        content = await aiService.draftSection(type);
      } catch (err) {
        // The section still comes, with its fields open for the owner.
        const status = (err as AxiosError)?.response?.status;
        toast.error(t(status === 429 ? 'siteEditor.sections.aiBudget' : 'siteEditor.sections.aiFailed'));
      } finally {
        setDrafting(null);
      }
    }
    const { config } = blocksNow();
    const added = addSection(config, type, at, content);
    update(added.config);
    select(added.openPath
      ? { kind: 'text', path: added.openPath, section: added.id, sectionType: type }
      : { kind: 'section', path: null, section: added.id, sectionType: type, fields: sectionFieldsFromConfig(added.config, added.id, type) });
    bridge.scrollTo({ section: added.id, block: 'start' });
  };

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
  // Leaving for another page of the dashboard asks first too (LT-267).
  useUnsavedChangesGuard(draft.dirty);

  /** Uploads of this session that none of `kept` uses any more go (best effort). */
  const dropUnusedUploads = async (...kept: WebConfig[]) => {
    const used = kept.map((k) => JSON.stringify(k)).join('\n');
    const unused = Array.from(uploads.current).filter((name) => !used.includes(name));
    uploads.current = new Set(Array.from(uploads.current).filter((name) => used.includes(name)));
    await Promise.all(unused.map((name) => deleteImage(name).catch(() => undefined)));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    // What this save sends. The owner may go on editing while it runs.
    const sent = draft.value;
    try {
      // Empty FAQ items, reviews and steps left by an added section stay behind (LT-252).
      const d = cleanForSave(sent);
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

      // A photo gone from the gallery may still be the hero, the logo or a
      // service's picture: only what nothing saved uses any more is deleted
      // (LT-315). The draft rides along for the services' pictures.
      const removed = unreferencedImages(
        removedStoredImages(
          (before.components?.portfolio?.items ?? []).map((i) => i.url),
          (stored.components?.portfolio?.items ?? []).map((i) => i.url),
          globals.imagesUrl
        ),
        stored,
        d,
        draftRef.current
      );
      await Promise.all(removed.map((name) => deleteImage(name).catch(() => undefined)));
      // Edits made while saving count as in use too (LT-315).
      await dropUnusedUploads(stored, draftRef.current);

      baseRef.current = stored;
      // Nothing changed meanwhile: start over from the stored config. Edits
      // made while saving stay, with their undo history, and still need a
      // save (LT-315 — the reset used to throw them away).
      if (draftRef.current === sent) {
        draft.reset(stored);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      } else {
        draft.rebase(stored);
      }
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
    setAdding(null);
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
    if (adding) {
      return <AddSectionPanel config={draft.value} rows={rows} after={adding.after} drafting={drafting} onAdd={(type, at) => void addNewSection(type, at)} />;
    }
    if (!selection) {
      return (
        <>
          <Tabs value={siteTab} onValueChange={(key) => setSiteTab(key as 'sections' | 'design')} className="mb-4">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="sections">{t('siteEditor.sections.tab')}</TabsTrigger>
              <TabsTrigger value="design">{t('siteEditor.pageSettings')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {siteTab === 'sections' ? (
            <SectionsPanel
              rows={rows}
              selectedId={null}
              onSelect={selectRow}
              onToggleHidden={toggleRow}
              onMove={moveRow}
              onAdd={() => setAdding({ after: null })}
            />
          ) : (
            <PagePanel config={draft.value} onUpdate={update} initialMessage={initialMessage} onInitialMessageSent={initialMessageSent} />
          )}
        </>
      );
    }
    if (selection.kind === 'section' && selection.section) {
      const section = selection.section;
      return (
        <SectionPanel
          config={draft.value}
          section={section}
          sectionType={selection.sectionType}
          fields={selection.fields ?? sectionFieldsFromConfig(draft.value, section, selection.sectionType)}
          onUpdate={update}
          onSelectField={openField}
          onMove={moveSelected}
          onAddBelow={() => setAdding({ after: section })}
          onAddPhoto={addPhoto}
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
          onRemove={galleryItem ? () => { update((prev) => removeAt(prev, galleryItem)); setSelection(null); } : undefined}
          onAddPhoto={galleryItem ? addPhoto : undefined}
        />
      );
    }
    return (
      <TextPanel
        path={path}
        value={String(getAt(draft.value, path) ?? '')}
        onChange={(value) => setField(path, value)}
        onApplyAi={(values) => update((prev) => {
          let next = prev;
          for (const [p, v] of Object.entries(values)) next = setAt(next, p, v);
          return next;
        })}
      />
    );
  };

  const heading = adding
    ? t('siteEditor.sections.add')
    : !selection
      ? t('siteEditor.site')
      : selection.kind === 'section'
        ? sectionLabel(selection.sectionType ?? selection.section, lang)
        : fieldLabel(t, selection.path ?? '');
  const Back = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const sheetOpen = !!selection || pageOpen || !!adding;
  // Back: from the add list to where it opened, from a field to its section, from a section to the site's sections.
  const goBack = () => {
    if (adding) setAdding(null);
    else if (selection && selection.kind !== 'section' && selection.section) backToSection();
    else {
      setSelection(null);
      setSiteTab('sections');
      setPageOpen(true);
    }
  };
  const closePanel = () => {
    setSelection(null);
    setAdding(null);
    setPageOpen(false);
  };
  // Another panel opens at its top (on a phone the sheet kept the last one's
  // scroll), and unfolded: on a phone the sheet folds down to its header, to
  // see the page behind it (LT-252).
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState(false);
  const panelKey = `${adding ? 'add' : ''}|${selection?.kind ?? ''}|${selection?.section ?? ''}|${selection?.path ?? ''}|${siteTab}`;
  useEffect(() => {
    if (panelScrollRef.current) panelScrollRef.current.scrollTop = 0;
    setFolded(false);
  }, [panelKey]);
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
            <button type="button" className={`${iconButton} ${pickedDevice === 'desktop' ? 'text-primary' : ''}`} onClick={() => setDevice('desktop')} title={t('siteEditor.desktop')} aria-label={t('siteEditor.desktop')} aria-pressed={pickedDevice === 'desktop'}>
              <Monitor className="w-4 h-4" />
            </button>
            <button type="button" className={`${iconButton} ${pickedDevice === 'phone' ? 'text-primary' : ''}`} onClick={() => setDevice('phone')} title={t('siteEditor.phone')} aria-label={t('siteEditor.phone')} aria-pressed={pickedDevice === 'phone'}>
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <button type="button" className={iconButton} onClick={draft.undo} disabled={!draft.canUndo} title={t('siteEditor.undo')} aria-label={t('siteEditor.undo')}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" className={iconButton} onClick={draft.redo} disabled={!draft.canRedo} title={t('siteEditor.redo')} aria-label={t('siteEditor.redo')}>
            <Redo2 className="w-4 h-4" />
          </button>
          <button type="button" className={`${iconButton} md:hidden`} onClick={() => { setSelection(null); setAdding(null); setPageOpen((v) => !v); }} title={t('siteEditor.site')} aria-label={t('siteEditor.site')}>
            <Layers className="w-4 h-4" />
          </button>
          <button type="button" className={iconButton} onClick={() => setConfirmDiscard(true)} disabled={!draft.dirty || saving} title={t('siteEditor.discard')} aria-label={t('siteEditor.discard')}>
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!draft.dirty || saving}
            className={`ms-1 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 ${justSaved ? pop('success') : pop()}`}
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
            {/* LT-324: the register's iPhone. One box around the iframe in both
                modes (a remount would reload the site): the phone restyles it
                and adds its marks; the glow and buttons sit behind it. */}
            {device === 'phone' && <PhoneSurround style={switchFade(switchingDevice)} />}
            <div
              className="absolute overflow-hidden bg-white"
              data-testid="preview-box"
              style={{
                ...(device === 'phone' ? phoneBox : { inset: 0 }),
                ...switchFade(switchingDevice),
              }}
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                onLoad={bridge.onLoad}
                title={t('siteEditor.previewTitle')}
                className="absolute inset-0 w-full h-full border-0 block"
              />
              {device === 'phone' && <PhoneScreenMarks />}
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
          className={`${sheetOpen ? 'flex' : 'hidden'} md:flex flex-col fixed md:static inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-auto z-40 max-h-[62vh] md:max-h-none md:w-[380px] shrink-0 rounded-t-3xl md:rounded-3xl bg-white dark:bg-slate-900 md:bg-white/80 md:dark:bg-slate-800/80 shadow-2xl md:shadow-lg border-t md:border border-gray-100 dark:border-slate-700/50 overflow-hidden`}
          aria-label={heading}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-1 min-w-0">
              {(adding || selection) && (
                <button type="button" onClick={goBack} className={iconButton} title={t('siteEditor.back')} aria-label={t('siteEditor.back')}>
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
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className={`${iconButton} md:hidden`}
                onClick={() => setFolded((f) => !f)}
                aria-expanded={!folded}
                title={t(folded ? 'siteEditor.unfold' : 'siteEditor.fold')}
                aria-label={t(folded ? 'siteEditor.unfold' : 'siteEditor.fold')}
              >
                {folded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {(selection || pageOpen || adding) && (
                <button type="button" className={iconButton} onClick={closePanel} title={t('siteEditor.close')} aria-label={t('siteEditor.close')}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div ref={panelScrollRef} className={`flex-1 overflow-y-auto p-4 ${folded ? 'hidden md:block' : ''}`}>
            {!selection && !adding && <p className="mb-4 text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.hint')}</p>}
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
