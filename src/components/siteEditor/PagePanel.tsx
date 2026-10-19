import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ColorPicker from '../ui/ColorPicker';
import Select from '../ui/Select';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { getAt, setAt } from '../../utils/editorPaths';
import { BUTTON_STYLES, CARD_STYLES, FONTS, PRESETS, RADII, THEMES, optionLabel } from '../../utils/editorOptions';
import SiteChat from './SiteChat';
import { aiService } from '../../services/aiApi';
import { STYLES, stylePicture, withLook } from '../../lib/styles';
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
 * LT-426: the styles are the register's pictures (LT-330), and a tap dresses
 * the site in one as the register's try-on does (LT-326): the style's canvas
 * colours and composition too, not only its name.
 */
function PagePanel<T>({ config, onUpdate, initialMessage, onInitialMessageSent }: PagePanelProps<T>) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  const design = (getAt(config, 'design') ?? {}) as Record<string, string | undefined>;
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchMyEntitlements().then((e) => {
      // A partial answer (no limits or usage) shows no bar rather than breaking the panel.
      const limit = e?.limits?.aiTokensPerMonth;
      const used = e?.usage?.aiTokensThisMonth;
      if (alive && limit && typeof used === 'number') setUsage(Math.min(100, Math.round((used / limit) * 100)));
    });
    return () => { alive = false; };
  }, []);

  // LT-426: the style being fetched, and whether the last try failed.
  const [restyling, setRestyling] = useState<string | null>(null);
  const [styleFailed, setStyleFailed] = useState(false);
  // One site keeps one look per style, try after try.
  const seed = String(getAt(config, '_id') ?? getAt(config, 'subDomain') ?? getAt(config, 'businessName') ?? 'site');

  const setToken = (key: string, value: string) => onUpdate(setAt(config, `design.${key}`, value || undefined));

  const tryStyle = async (style: string) => {
    if (restyling || style === design.stylePreset) return;
    setRestyling(style);
    setStyleFailed(false);
    try {
      const look = await aiService.restyle(getAt(config, 'pallete') ?? {}, style, seed);
      // On the draft as it is by now: the owner may have gone on editing.
      onUpdate((prev) => withLook(prev, look));
    } catch {
      setStyleFailed(true);
    } finally {
      setRestyling(null);
    }
  };
  // A style of the site's that has no picture (an AI pick, or one chosen before LT-426) stays offered first.
  const current = design.stylePreset;
  const extra = current && !(STYLES as readonly string[]).includes(current) ? current : null;
  const styleCard = (style: string, picture: boolean) => {
    const selected = style === current;
    return (
      <button
        key={style}
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={!!restyling}
        onClick={() => void tryStyle(style)}
        className="relative flex flex-col items-center gap-1 shrink-0 snap-start disabled:cursor-wait"
        data-style={style}
      >
        {picture ? (
          <img
            src={stylePicture(style, i18n.language || 'he')}
            alt=""
            loading="lazy"
            width={64}
            height={89}
            className={`w-16 h-[89px] rounded-xl object-cover object-top border-2 ${selected ? 'border-violet-500 ring-2 ring-violet-300/60' : 'border-gray-200 dark:border-slate-700'}`}
          />
        ) : (
          <span className={`w-16 h-[89px] rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-100 to-violet-300 dark:from-violet-900/60 dark:to-slate-800 border-2 ${selected ? 'border-violet-500 ring-2 ring-violet-300/60' : 'border-gray-200 dark:border-slate-700'}`}>
            <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
          </span>
        )}
        {restyling === style && (
          <span className="absolute top-0 inset-x-0 h-[89px] rounded-xl flex items-center justify-center bg-white/60 dark:bg-slate-900/60" aria-hidden="true">
            <span className="block w-5 h-5 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
          </span>
        )}
        <span className={`text-[11px] whitespace-nowrap ${selected ? 'font-semibold text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-slate-300'}`}>
          {optionLabel(PRESETS, style, lang)}
        </span>
      </button>
    );
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
      {/* LT-384: the style and the main colour together; LT-426: the style as the register's pictures. */}
      <div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p id="site-theme-preset" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('siteEditor.theme.preset')}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.theme.tryStyle')}</p>
          </div>
          <ColorPicker
            label={t('siteEditor.theme.color')}
            color={primary}
            onChange={(color) => onUpdate(setAt(setAt(config, 'pallete.colorPrimary', color), 'pallete.colorPrimaryDark', color), 'pallete.colorPrimary')}
          />
        </div>
        <div role="radiogroup" aria-labelledby="site-theme-preset" className="mt-2 -mx-1 px-1 flex gap-2 overflow-x-auto pb-1 snap-x" data-testid="style-cards">
          {extra && styleCard(extra, false)}
          {STYLES.map((style) => styleCard(style, true))}
        </div>
        {styleFailed && <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">{t('siteEditor.theme.styleFailed')}</p>}
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
