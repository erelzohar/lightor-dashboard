import { useState } from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, ShoppingBag, Trash2, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import ToggleSwitch from '../ui/ToggleSwitch';
import { blockById, getAt, moveBlock, patchBlock, removeBlock, setAt } from '../../utils/editorPaths';
import { aiEditable, fieldInfo } from '../../utils/editorFields';
import { CARD_LAYOUTS, DECOR_BACKGROUNDS, DEFAULT_VARIANT, FREE_DEFAULTS, HERO_BACKGROUNDS, HERO_BACKGROUND_NAMES, OWN_BACKDROP_HEROES, PAID_BACKGROUNDS, blockLookOf, heroBackgroundOf, isPaidDesign, optionLabel, sectionDef, sectionLabel, variantToStore } from '../../utils/editorOptions';
import { canOfferPurchases } from '../../lib/platform';
import { PaidNote, usePaidDesignsHeld } from './MotionPlan';
import { ProductCardPicker } from './ProductDesign';
import type { SiteField } from '../../hooks/usePreviewBridge';
import AiBox from './AiBox';
import AddPhotoButton from './AddPhotoButton';
import { fieldLabel, vocabLang } from './labels';
import DesignChoices, { pictureGroup } from './DesignChoices';

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
  /** LT-320: a photo uploaded for the gallery. */
  onAddPhoto?: (imageName: string) => void;
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
function SectionPanel<T>({ config, section, sectionType, fields, onUpdate, onSelectField, onMove, onAddBelow, onAddPhoto }: SectionPanelProps<T>) {
  const { t, i18n } = useTranslation();
  const { guardLinkClick } = useLeaveGuard();
  const lang = vocabLang(i18n.language);
  const type = sectionType ?? section;
  const def = sectionDef(type);
  const block = blockById(config, section);
  const composed = !!block && !def.outsideBlocks;
  const design = (getAt(config, 'design') ?? {}) as Record<string, unknown>;
  // LT-570: a plan without the paid designs (the free one) shows each one's
  // section default, so the lit chip is that one, as on the site; a paid
  // design tapped there is not put on the site, its note says where it is.
  // In the app (nothing is sold there, LT-130) that plan is not offered them.
  const held = usePaidDesignsHeld();
  const sells = canOfferPurchases();
  const offered = (paid: boolean) => !paid || !held || sells;
  const marked = (paid: boolean) => paid && (!held || sells);
  const [asked, setAsked] = useState<string | null>(null);

  // The look the site draws (LT-573), so the lit chip is the one on screen.
  const drawn: string | undefined = composed
    ? blockLookOf(type, block?.variant, design)
    : def.designToken ? ((design[def.designToken] as string | undefined) ?? DEFAULT_VARIANT[type]) : undefined;
  const current = held && isPaidDesign(type, drawn) ? FREE_DEFAULTS[type] : drawn;

  const setVariant = (value: string) => {
    if (composed && block) {
      onUpdate(patchBlock(config, block.id, { variant: variantToStore(type, value) }));
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

  // A service's fields read the same for every service: the list names the service too (LT-429).
  const listLabel = (path: string) => {
    const id = /^services\.([^.]+)\./.exec(path)?.[1];
    const services = getAt(config, 'appointmentTypes');
    const service = id && Array.isArray(services) ? (services as Array<{ _id?: string; name?: string }>).find((s) => s._id === id)?.name : null;
    return service ? `${fieldLabel(t, path)} - ${service}` : fieldLabel(t, path);
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

      {/* LT-320: the gallery's own action — a photo from the phone or the computer. */}
      {onAddPhoto && (type === 'gallery' || type === 'portfolio') && <AddPhotoButton onAdded={onAddPhoto} />}

      {/* LT-540: products are records of their own, kept on their page. */}
      {type === 'products' && (
        <Link
          to="/products"
          onClick={(e) => guardLinkClick(e, '/products')}
          data-testid="manage-products"
          className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          {t('siteEditor.section.manageProducts')}
        </Link>
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
          {/* LT-595: a picture of each look, drawn by the site, its name under it. */}
          <DesignChoices
            name={t('siteEditor.section.layout')}
            group={pictureGroup(type)}
            values={def.variants.filter((v) => offered(isPaidDesign(type, v)))}
            current={current}
            labelOf={(v) => sectionLabel(type, v, lang)}
            marked={(v) => marked(isPaidDesign(type, v))}
            language={i18n.language || 'he'}
            onPick={(v) => {
              if (held && isPaidDesign(type, v)) return setAsked(v);
              setAsked(null);
              setVariant(v);
            }}
            testId="layout-choices"
          />
          {asked && isPaidDesign(type, asked) && (
            <div className="mt-2">
              <PaidNote />
            </div>
          )}
        </div>
      )}

      {/* LT-545: the products' card, where the layout draws one per product. */}
      {type === 'products' && CARD_LAYOUTS.includes(current ?? DEFAULT_VARIANT.products) && <ProductCardPicker config={config} onUpdate={onUpdate} />}

      {/* LT-287: the hero's animated background, which the editor never offered. */}
      {type === 'hero' && !OWN_BACKDROP_HEROES.includes(String(block?.variant ?? getAt(config, 'design.heroLayout'))) && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('siteEditor.section.heroBackground')}</p>
          {(() => {
            const decor = getAt(config, 'design.decor');
            // LT-570: a paid backdrop on the free plan shows the hero's own background.
            const shown = held && PAID_BACKGROUNDS.includes(String(decor)) ? 'none' : decor;
            // LT-531: the two that live in design.decor, and the others clear them.
            const pick = (v: string) => {
              if (held && PAID_BACKGROUNDS.includes(v)) return setAsked(v);
              setAsked(null);
              if (DECOR_BACKGROUNDS.includes(v)) return onUpdate(setAt(config, 'design.decor', v));
              const plain = DECOR_BACKGROUNDS.includes(String(decor)) ? setAt(config, 'design.decor', 'none') : config;
              return onUpdate(setAt(plain, 'components.hero.bgType', v));
            };
            return (
              <DesignChoices
                name={t('siteEditor.section.heroBackground')}
                group="herobg"
                values={HERO_BACKGROUNDS.filter((v) => offered(PAID_BACKGROUNDS.includes(v)))}
                current={heroBackgroundOf(getAt(config, 'components.hero.bgType'), shown)}
                labelOf={(v) => optionLabel(HERO_BACKGROUND_NAMES, v, lang)}
                marked={(v) => marked(PAID_BACKGROUNDS.includes(v))}
                language={i18n.language || 'he'}
                onPick={pick}
                testId="hero-background-choices"
              />
            );
          })()}
          {asked && PAID_BACKGROUNDS.includes(asked) && (
            <div className="mt-2">
              <PaidNote />
            </div>
          )}
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
                  <span className="truncate">{listLabel(f.path)}</span>
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
