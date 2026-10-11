import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import Select from '../ui/Select';
import type { WebConfig } from '../../types';
import {
  MAX_BLOCKS, SECTION_CATALOG, availabilityOf, clampIndex, defaultInsertIndex, type SectionGroup, type SectionRow,
} from '../../utils/siteSections';
import { SECTION_HINTS, optionLabel } from '../../utils/editorOptions';
import { SECTION_ICONS } from './sectionIcons';
import { sectionLabel, vocabLang } from './labels';

interface AddSectionPanelProps {
  config: WebConfig;
  rows: SectionRow[];
  /** Add below this row (a section's "add below"); null = each section's recommended place. */
  after: string | null;
  /** The section the AI is drafting now. */
  drafting: string | null;
  onAdd: (type: string, at: number) => void;
}

const GROUPS: SectionGroup[] = ['content', 'images', 'services', 'info'];

/**
 * LT-252: the sections this page does not have yet, grouped, each with a line
 * on what it is and where its content comes from; the ones it cannot have
 * yet say what they need. "Where" is the recommended place for each, or
 * below any section the owner picks.
 */
function AddSectionPanel({ config, rows, after, drafting, onAdd }: AddSectionPanelProps) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  const types = rows.map((r) => r.type);
  const below = (id: string | null) => rows.reduce((at, r, i) => (id && (r.id === id || r.key === id) ? i + 1 : at), -1);
  const [where, setWhere] = useState<string>(() => (after && below(after) > 0 ? String(below(after)) : 'auto'));
  const full = rows.length >= MAX_BLOCKS;

  const options = [
    { value: 'auto', label: t('siteEditor.sections.recommended') },
    ...rows
      .map((r, i) => ({ value: String(i + 1), label: t('siteEditor.sections.after', { name: sectionLabel(r.type, lang) }), type: r.type, i }))
      .filter((o) => !(o.type === 'footer' && o.i === rows.length - 1))
      .map(({ value, label }) => ({ value, label })),
  ];
  const positionFor = (type: string) => (where === 'auto' ? defaultInsertIndex(types, type) : clampIndex(types, Number(where)));

  return (
    <div className="flex flex-col gap-5" data-testid="add-section-panel">
      <Select id="add-section-where" label={t('siteEditor.sections.where')} value={where} onChange={(e) => setWhere(e.target.value)} options={options} />
      {full && <p className="text-xs text-amber-700 dark:text-amber-300">{t('siteEditor.sections.reasons.max', { n: MAX_BLOCKS })}</p>}
      {GROUPS.map((group) => {
        const entries = SECTION_CATALOG.filter((e) => e.group === group && !types.includes(e.type));
        if (!entries.length) return null;
        return (
          <div key={group}>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t(`siteEditor.sections.groups.${group}`)}</p>
            <ul className="flex flex-col gap-1">
              {entries.map(({ type }) => {
                const avail = availabilityOf(config, type, rows.length);
                const Icon = SECTION_ICONS[type];
                const busy = drafting === type;
                return (
                  <li key={type}>
                    <button
                      type="button"
                      disabled={!avail.ok || !!drafting}
                      onClick={() => onAdd(type, positionFor(type))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start hover:bg-gray-100 dark:hover:bg-slate-800 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      {Icon && <Icon className={`w-5 h-5 shrink-0 ${avail.ok ? 'text-primary' : 'text-gray-300 dark:text-slate-600'}`} aria-hidden="true" />}
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-medium ${avail.ok ? 'text-gray-800 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500'}`}>
                          {sectionLabel(type, lang)}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-slate-400">
                          {busy
                            ? t('siteEditor.sections.drafting')
                            : avail.ok || !avail.reason || avail.reason === 'max'
                              ? optionLabel(SECTION_HINTS, type, lang)
                              : t(`siteEditor.sections.reasons.${avail.reason}`)}
                        </span>
                      </span>
                      {busy ? (
                        <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                      ) : avail.ok && avail.source !== 'ready' ? (
                        <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${avail.source === 'ai' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {t(`siteEditor.sections.badge.${avail.source}`)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default AddSectionPanel;
