import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ColorPicker from '../ui/ColorPicker';
import Select from '../ui/Select';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { getAt, setAt } from '../../utils/editorPaths';
import { BUTTON_STYLES, CARD_STYLES, FONTS, PRESETS, RADII, THEMES, optionLabel } from '../../utils/editorOptions';
import SiteChat from './SiteChat';
import { vocabLang } from './labels';

interface PagePanelProps<T> {
  config: T;
  /** A value, or an updater for answers that land late (LT-315). */
  onUpdate: (next: T | ((prev: T) => T), mergeKey?: string) => void;
  initialMessage?: string;
  onInitialMessageSent?: () => void;
}

/**
 * LT-249: the whole site — its style, main colour, fonts, buttons, corners,
 * cards and light/dark — and the whole-site AI chat. Picking a style starts
 * the look over: the other design choices and every section's own layout
 * give way to the style's (the AI editor does the same on a style change).
 */
function PagePanel<T>({ config, onUpdate, initialMessage, onInitialMessageSent }: PagePanelProps<T>) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  const design = (getAt(config, 'design') ?? {}) as Record<string, string | undefined>;
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchMyEntitlements().then((e) => {
      const limit = e?.limits.aiTokensPerMonth;
      if (alive && e && limit) setUsage(Math.min(100, Math.round((e.usage.aiTokensThisMonth / limit) * 100)));
    });
    return () => { alive = false; };
  }, []);

  const setToken = (key: string, value: string) => onUpdate(setAt(config, `design.${key}`, value || undefined));

  const choosePreset = (preset: string) => {
    const root = config as unknown as Record<string, unknown>;
    const blocks = Array.isArray(root.blocks)
      ? (root.blocks as Record<string, unknown>[]).map(({ variant: _drop, ...b }) => { void _drop; return b; })
      : root.blocks;
    onUpdate({ ...root, design: { stylePreset: preset }, ...(blocks ? { blocks } : {}) } as unknown as T);
  };

  const select = (key: string, names: Record<string, { he: string; en: string }>, label: string) => (
    <Select
      id={`site-theme-${key}`}
      label={label}
      value={design[key] ?? ''}
      onChange={(e) => setToken(key, e.target.value)}
      options={[
        { value: '', label: t('siteEditor.theme.byStyle') },
        ...Object.keys(names).map((v) => ({ value: v, label: optionLabel(names, v, lang) })),
      ]}
    />
  );

  const primary = String(getAt(config, 'pallete.colorPrimary') ?? '#7c3aed');

  return (
    <div className="flex flex-col gap-5" data-testid="page-panel">
      {/* LT-256: Lighty's line first; the design controls below it. */}
      <SiteChat config={config} onApply={(update) => onUpdate(update)} initialMessage={initialMessage} onInitialMessageSent={onInitialMessageSent} />
      {/* LT-384: the style and the main colour side by side, the hint under both. */}
      <div>
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <Select
              id="site-theme-preset"
              label={t('siteEditor.theme.preset')}
              value={design.stylePreset ?? ''}
              onChange={(e) => e.target.value && choosePreset(e.target.value)}
              options={[
                { value: '', label: t('siteEditor.theme.pickPreset'), disabled: true },
                ...Object.keys(PRESETS).map((v) => ({ value: v, label: optionLabel(PRESETS, v, lang) })),
              ]}
            />
          </div>
          <ColorPicker
            label={t('siteEditor.theme.color')}
            color={primary}
            onChange={(color) => onUpdate(setAt(setAt(config, 'pallete.colorPrimary', color), 'pallete.colorPrimaryDark', color), 'pallete.colorPrimary')}
          />
        </div>
        <p className="mt-1 text-sm text-light-gray">{t('siteEditor.theme.presetHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {select('headingFont', FONTS, t('siteEditor.theme.headingFont'))}
        {select('bodyFont', FONTS, t('siteEditor.theme.bodyFont'))}
        {select('buttonStyle', BUTTON_STYLES, t('siteEditor.theme.buttons'))}
        {select('borderRadius', RADII, t('siteEditor.theme.corners'))}
        {select('cardStyle', CARD_STYLES, t('siteEditor.theme.cards'))}
        {select('defaultTheme', THEMES, t('siteEditor.theme.mode'))}
      </div>

      {usage !== null && (
        <div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-violet-500" style={{ width: `${usage}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.ai.usage', { percent: usage })}</p>
        </div>
      )}
    </div>
  );
}

export default PagePanel;
