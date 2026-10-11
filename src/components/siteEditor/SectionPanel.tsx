import { ArrowDown, ArrowUp, Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from '../ui/ToggleSwitch';
import { blockById, getAt, moveBlock, patchBlock, removeBlock, setAt } from '../../utils/editorPaths';
import { aiEditable, fieldInfo } from '../../utils/editorFields';
import { DEFAULT_VARIANT, LAYOUTS, optionLabel, sectionDef } from '../../utils/editorOptions';
import type { SiteField } from '../../hooks/usePreviewBridge';
import AiBox from './AiBox';
import { fieldLabel, vocabLang } from './labels';

interface SectionPanelProps<T> {
  config: T;
  /** The block id on a composed page, the legacy section key otherwise. */
  section: string;
  sectionType: string | null;
  fields: SiteField[];
  onUpdate: (next: T, mergeKey?: string) => void;
  onSelectField: (field: SiteField) => void;
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
function SectionPanel<T>({ config, section, sectionType, fields, onUpdate, onSelectField }: SectionPanelProps<T>) {
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

  const textFields = fields.filter((f) => f.kind === 'text' && aiEditable(f.path));
  const aiFields = textFields.map((f) => ({
    path: f.path,
    value: String(getAt(config, f.path) ?? ''),
    label: fieldLabel(t, f.path),
    maxLength: fieldInfo(f.path).maxLength,
  }));

  return (
    <div className="flex flex-col gap-5" data-testid="section-panel">
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

      {canHide && (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('siteEditor.section.visible')}</p>
            {!visible && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{t('siteEditor.section.hiddenNote')}</p>}
          </div>
          <ToggleSwitch checked={visible} onChange={setVisible} ariaLabel={t('siteEditor.section.visible')} />
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
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(false)} onClick={() => onUpdate(moveBlock(config, block.id, -1))} aria-label={t('siteEditor.section.moveUp')}>
              <span className="inline-flex items-center gap-1"><ArrowUp className="w-3.5 h-3.5" />{t('siteEditor.section.moveUp')}</span>
            </button>
            <button type="button" className={chip(false)} onClick={() => onUpdate(moveBlock(config, block.id, 1))} aria-label={t('siteEditor.section.moveDown')}>
              <span className="inline-flex items-center gap-1"><ArrowDown className="w-3.5 h-3.5" />{t('siteEditor.section.moveDown')}</span>
            </button>
            {type !== 'hero' && type !== 'footer' && (
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400"
                onClick={() => onUpdate(removeBlock(config, block.id))}
              >
                <span className="inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />{t('siteEditor.section.remove')}</span>
              </button>
            )}
          </div>
        </>
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

      {aiFields.length > 0 && (
        <AiBox
          fields={aiFields}
          hint={t('siteEditor.ai.sectionHint')}
          onApply={(values) => {
            let next = config;
            for (const [path, value] of Object.entries(values)) next = setAt(next, path, value);
            onUpdate(next);
          }}
        />
      )}
    </div>
  );
}

export default SectionPanel;
