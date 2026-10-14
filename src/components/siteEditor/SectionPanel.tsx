import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from '../ui/ToggleSwitch';
import { blockById, getAt, moveBlock, patchBlock, removeBlock, setAt } from '../../utils/editorPaths';
import { aiEditable, fieldInfo } from '../../utils/editorFields';
import { DEFAULT_VARIANT, HERO_BACKGROUNDS, HERO_BACKGROUND_NAMES, LAYOUTS, heroBackgroundOf, optionLabel, sectionDef } from '../../utils/editorOptions';
import type { SiteField } from '../../hooks/usePreviewBridge';
import AiBox from './AiBox';
import { fieldLabel, vocabLang } from './labels';

interface SectionPanelProps<T> {
  config: T;
  /** The block id on a composed page, the legacy section key otherwise. */
  section: string;
  sectionType: string | null;
  fields: SiteField[];
  /** A value, or an updater for answers that land late (LT-315). */
  onUpdate: (next: T | ((prev: T) => T), mergeKey?: string) => void;
  onSelectField: (field: SiteField) => void;
  /**
   * LT-252: move the section one place — on a legacy page too, which the
   * editor first turns into blocks. Without it a composed page moves its block.
   */
  onMove?: (by: -1 | 1) => void;
  /** LT-252: open the add-section list, placed below this section. */
  onAddBelow?: () => void;
}

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    on
      ? 'bg-primary text-white border-primary'
      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-primary/50'
  }`;

/**
 * LT-249: a whole section — its look (the block's variant on a composed page,
 * the design token on a legacy one), whether it shows, its background and
 * place on a composed page, the fields inside it, and AI over all its texts.
 */
function SectionPanel<T>({ config, section, sectionType, fields, onUpdate, onSelectField, onMove, onAddBelow }: SectionPanelProps<T>) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  const type = sectionType ?? section;
  const def = sectionDef(type);
  const block = blockById(config, section);
  const composed = !!block && !def.outsideBlocks;
  const design = (getAt(config, 'design') ?? {}) as Record<string, unknown>;

  const current: string | undefined = composed
    ? (block?.variant ?? DEFAULT_VARIANT[type])
    : def.designToken ? (design[def.designToken] as string | undefined) : undefined;

  const setVariant = (value: string) => {
    if (composed && block) {
      onUpdate(patchBlock(config, block.id, { variant: value === DEFAULT_VARIANT[type] ? undefined : value }));
    } else if (def.designToken) {
      onUpdate(setAt(config, `design.${def.designToken}`, value));
    }
  };

  const visiblePath = !composed && def.visibleKey ? `components.${def.visibleKey}.visible` : null;
  const mod = (block?.mod ?? {}) as Record<string, unknown>;
  // Shown or hidden: the section's own switch on a legacy page; on a composed
  // page the block stays, with its copy, marked hidden (LT-249) — the site
  // skips it, the editor draws it faded so it can come back.
  const canHide = !!visiblePath || composed;
  const visible = visiblePath ? getAt(config, visiblePath) !== false : !mod.hidden;
  const setVisible = (on: boolean) => {
    if (visiblePath) onUpdate(setAt(config, visiblePath, on));
    else if (block) onUpdate(patchBlock(config, block.id, { mod: { ...mod, hidden: on ? undefined : true } }));
  };

  // The opening and the footer stay where they are; the navbar and the
  // contact button are not in the page's order at all.
  const inFlow = !def.outsideBlocks;
  const pinned = type === 'hero' || type === 'footer';
  const move = onMove ?? (composed && block ? (by: -1 | 1) => onUpdate(moveBlock(config, block.id, by)) : undefined);

  const textFields = fields.filter((f) => f.kind === 'text' && aiEditable(f.path));
  const aiFields = textFields.map((f) => ({
    path: f.path,
    value: String(getAt(config, f.path) ?? ''),
    label: fieldLabel(t, f.path),
    maxLength: fieldInfo(f.path).maxLength,
  }));

  return (
    <div className="flex flex-col gap-5" data-testid="section-panel">
      {/* LT-286: whether the section shows at all comes first, above Lighty. */}
      {canHide && (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('siteEditor.section.visible')}</p>
            {!visible && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{t('siteEditor.section.hiddenNote')}</p>}
          </div>
          <ToggleSwitch checked={visible} onChange={setVisible} ariaLabel={t('siteEditor.section.visible')} />
        </div>
      )}

      {/* LT-256: then Lighty's line — every text of the section at once. */}
      {aiFields.length > 0 && (
        <AiBox
          fields={aiFields}
          placeholder={t('siteEditor.ai.askSection')}
          // On the draft as it is when the answer lands, not as it was
          // when asked: a switch flipped meanwhile stays flipped (LT-315).
          onApply={(values) => onUpdate((prev) => {
            let next = prev;
            for (const [path, value] of Object.entries(values)) next = setAt(next, path, value);
            return next;
          })}
        />
      )}
      {def.variants && def.variants.length > 0 && (composed || def.designToken) && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('siteEditor.section.layout')}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('siteEditor.section.layout')}>
            {def.variants.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={current === v} className={chip(current === v)} onClick={() => setVariant(v)}>
                {optionLabel(LAYOUTS, v, lang)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LT-287: the hero's animated background, which the editor never offered. */}
      {type === 'hero' && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('siteEditor.section.heroBackground')}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('siteEditor.section.heroBackground')}>
            {HERO_BACKGROUNDS.map((v) => {
              const on = heroBackgroundOf(getAt(config, 'components.hero.bgType')) === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={on} className={chip(on)} onClick={() => onUpdate(setAt(config, 'components.hero.bgType', v))}>
                  {optionLabel(HERO_BACKGROUND_NAMES, v, lang)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {composed && block && (
        <>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('siteEditor.section.tone')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(['bg', 'surface'] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={chip(mod.tone === tone)}
                  onClick={() => onUpdate(patchBlock(config, block.id, { mod: { ...mod, tone: mod.tone === tone ? undefined : tone } }))}
                >
                  {t(`siteEditor.section.tone_${tone}`)}
                </button>
              ))}
              <button
                type="button"
                className={chip(!!mod.invert)}
                onClick={() => onUpdate(patchBlock(config, block.id, { mod: { ...mod, invert: !mod.invert || undefined } }))}
              >
                {t('siteEditor.section.dark')}
              </button>
            </div>
          </div>
        </>
      )}

      {inFlow && !pinned && (move || (composed && block)) && (
        <div className="flex flex-wrap gap-2">
          {move && (
            <>
              <button type="button" className={chip(false)} onClick={() => move(-1)} aria-label={t('siteEditor.section.moveUp')}>
                <span className="inline-flex items-center gap-1"><ArrowUp className="w-3.5 h-3.5" />{t('siteEditor.section.moveUp')}</span>
              </button>
              <button type="button" className={chip(false)} onClick={() => move(1)} aria-label={t('siteEditor.section.moveDown')}>
                <span className="inline-flex items-center gap-1"><ArrowDown className="w-3.5 h-3.5" />{t('siteEditor.section.moveDown')}</span>
              </button>
            </>
          )}
          {composed && block && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400"
              onClick={() => onUpdate(removeBlock(config, block.id))}
            >
              <span className="inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />{t('siteEditor.section.remove')}</span>
            </button>
          )}
        </div>
      )}

      {onAddBelow && inFlow && type !== 'footer' && (
        <button
          type="button"
          onClick={onAddBelow}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 text-sm font-medium text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t('siteEditor.sections.addBelow')}
        </button>
      )}

      {!def.variants && !canHide && (
        <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.section.noOptions')}</p>
      )}

      {fields.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('siteEditor.section.fields')}</p>
          <ul className="flex flex-col gap-1">
            {fields.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => onSelectField(f)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-start text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  {f.kind === 'image' ? <ImageIcon className="w-4 h-4 shrink-0 text-gray-400" /> : <Type className="w-4 h-4 shrink-0 text-gray-400" />}
                  <span className="truncate">{fieldLabel(t, f.path)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

export default SectionPanel;
