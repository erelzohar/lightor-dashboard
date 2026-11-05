import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionPanel from '../../components/siteEditor/SectionPanel';
import { FREE_DEFAULTS, PAID_LAYOUTS, isPaidDesign } from '../../utils/editorOptions';

const { t, plan, app } = vi.hoisted(() => ({
  t: (k: string) => k,
  plan: { motionDesigns: false as boolean | undefined },
  app: { native: false },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr', isDarkMode: false }) }));
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: () => Promise.resolve({ plan: 'free', limits: { motionDesigns: plan.motionDesigns }, usage: {} }),
}));
vi.mock('../../lib/platform', async (orig) => ({ ...(await orig<typeof import('../../lib/platform')>()), canOfferPurchases: () => !app.native }));

beforeEach(() => {
  plan.motionDesigns = false;
  app.native = false;
});

const panel = (config: object, section: string, sectionType: string, onUpdate = vi.fn()) => {
  render(
    <MemoryRouter>
      <SectionPanel config={config} section={section} sectionType={sectionType} fields={[]} onUpdate={onUpdate} onSelectField={vi.fn()} />
    </MemoryRouter>
  );
  return onUpdate;
};
const shelf = (variant: string) => ({ design: {}, blocks: [{ id: 'p1', type: 'products', variant }] });
const layouts = () => screen.getByRole('radiogroup', { name: 'siteEditor.section.layout' });
const chipOf = (name: string) => within(layouts()).getByRole('radio', { name });
const crowned = (name: string) => !!chipOf(name).querySelector('[data-testid="paid-mark"]');
// The plan arrives a moment after the panel draws.
const settled = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

describe('the paid designs (LT-570)', () => {
  it('give way to one default per section, which is never paid itself', () => {
    expect(FREE_DEFAULTS).toEqual({ hero: 'fullbleed', gallery: 'masonry', portfolio: 'masonry', products: 'well', features: 'tiles', contact: 'split' });
    for (const [section, paid] of Object.entries(PAID_LAYOUTS)) {
      expect(paid.length).toBeGreaterThan(0);
      expect(isPaidDesign(section, FREE_DEFAULTS[section])).toBe(false);
    }
  });

  it('crowns the contact section with bubbles, not the reviews of the same name (LT-591)', () => {
    expect(isPaidDesign('contact', 'bubbles')).toBe(true);
    expect(isPaidDesign('quote', 'bubbles')).toBe(false);
    expect(isPaidDesign('hero', 'slant')).toBe(false);
  });
});

describe('the section panel on the free plan', () => {
  it('lights the design the site shows, and crowns the paid ones', async () => {
    panel(shelf('belt'), 'p1', 'products');
    await settled();
    expect(chipOf('Quiet tiles')).toHaveAttribute('aria-checked', 'true');
    expect(chipOf('Conveyor')).toHaveAttribute('aria-checked', 'false');
    expect(crowned('Conveyor')).toBe(true);
    expect(crowned('Clothes rail')).toBe(true);
    expect(crowned('Coverflow')).toBe(true);
    expect(crowned('Orbit')).toBe(true);
    expect(crowned('Quiet tiles')).toBe(false);
  });

  it('does not put a paid design on the site: it says where it is, with the way to the plans', async () => {
    const onUpdate = panel(shelf('list'), 'p1', 'products');
    await settled();
    expect(screen.queryByTestId('paid-note')).toBeNull();
    fireEvent.click(chipOf('Clothes rail'));
    expect(onUpdate).not.toHaveBeenCalled();
    const note = screen.getByTestId('paid-note');
    expect(note).toHaveTextContent('siteEditor.paidDesign.note');
    expect(within(note).getByRole('link', { name: 'siteEditor.paidDesign.upgrade' })).toHaveAttribute('href', '/account');
    // A design of the plan goes on as ever, and the note goes.
    fireEvent.click(chipOf('Bento'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('paid-note')).toBeNull();
  });

  it('lights the masonry for a curve, and the full image for an opening hero', async () => {
    panel({ design: {}, blocks: [{ id: 'g1', type: 'gallery', variant: 'curve' }] }, 'g1', 'gallery');
    await settled();
    expect(chipOf('Masonry')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the hero\'s own background for a paid backdrop, and holds the paid ones back', async () => {
    const onUpdate = panel({ design: { decor: 'sonar' }, components: { hero: { visible: true, bgType: 'clouds' } } }, 'hero', 'hero');
    await settled();
    const group = screen.getByRole('radiogroup', { name: 'siteEditor.section.heroBackground' });
    expect(within(group).getByRole('radio', { name: 'Clouds' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Sonar' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(within(group).getByRole('radio', { name: 'Liquid metal' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('paid-note')).toBeTruthy();
  });

  it('in the app offers no paid design, marks nothing and sells nothing', async () => {
    app.native = true;
    panel(shelf('belt'), 'p1', 'products');
    await settled();
    expect(within(layouts()).queryByRole('radio', { name: 'Conveyor' })).toBeNull();
    expect(within(layouts()).queryByRole('radio', { name: 'Clothes rail' })).toBeNull();
    expect(chipOf('Quiet tiles')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('paid-mark')).toBeNull();
    expect(screen.queryByRole('link', { name: 'siteEditor.paidDesign.upgrade' })).toBeNull();
  });
});

describe('on a plan with the paid designs', () => {
  it('crowns them and puts them on like any other', async () => {
    plan.motionDesigns = true;
    const onUpdate = panel(shelf('list'), 'p1', 'products');
    await settled();
    expect(crowned('Conveyor')).toBe(true);
    fireEvent.click(chipOf('Conveyor'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('paid-note')).toBeNull();
  });

  it('lights the paid design the site has', async () => {
    plan.motionDesigns = true;
    panel(shelf('belt'), 'p1', 'products');
    await settled();
    expect(chipOf('Conveyor')).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps them all in the app', async () => {
    plan.motionDesigns = true;
    app.native = true;
    panel(shelf('belt'), 'p1', 'products');
    await settled();
    expect(within(layouts()).getByRole('radio', { name: 'Coverflow' })).toBeTruthy();
  });
});
