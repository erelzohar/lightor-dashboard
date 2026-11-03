import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionPanel from '../../components/siteEditor/SectionPanel';
import PagePanel from '../../components/siteEditor/PagePanel';
import { motionDesignsOf } from '../../utils/editorOptions';

const { t, plan, app } = vi.hoisted(() => ({
  t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
  plan: { motionDesigns: false as boolean | undefined },
  app: { native: false },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr', isDarkMode: false }) }));
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: () => Promise.resolve({ plan: 'free', limits: { motionDesigns: plan.motionDesigns, aiTokensPerMonth: null }, usage: {} }),
}));
vi.mock('../../lib/platform', async (orig) => ({ ...(await orig<typeof import('../../lib/platform')>()), canOfferPurchases: () => !app.native }));
vi.mock('../../components/siteEditor/SiteChat', () => ({ default: (): null => null }));

beforeEach(() => {
  plan.motionDesigns = false;
  app.native = false;
});

const panel = (config: object, section: string, sectionType: string) => render(
  <MemoryRouter>
    <SectionPanel config={config} section={section} sectionType={sectionType} fields={[]} onUpdate={vi.fn()} onSelectField={vi.fn()} />
  </MemoryRouter>
);
const shelf = (variant: string) => ({ design: {}, blocks: [{ id: 'p1', type: 'products', variant }] });
const layouts = () => screen.getByRole('radiogroup', { name: 'siteEditor.section.layout' });
const marked = (name: string) => !!within(layouts()).getByRole('radio', { name }).querySelector('[data-testid="plus-mark"]');

describe('the moving designs a site draws (LT-570)', () => {
  it('reads them as the live site does: a shown block\'s variant, else the design\'s own', () => {
    expect(motionDesignsOf({
      design: { portfolioLayout: 'cascade', decor: 'sonar' },
      blocks: [
        { type: 'hero', variant: 'parallax' },
        { type: 'gallery' },
        { type: 'products', variant: 'belt' },
        { type: 'gallery', variant: 'curve', mod: { hidden: true } },
      ],
    })).toEqual(['parallax', 'cascade', 'belt']);
  });

  it('counts a backdrop only where the hero draws one', () => {
    expect(motionDesignsOf({ design: { decor: 'metal' }, blocks: [{ type: 'hero', variant: 'centered' }] })).toEqual(['metal']);
    expect(motionDesignsOf({ design: { decor: 'metal' }, blocks: [{ type: 'hero', variant: 'expand' }] })).toEqual(['expand']);
  });

  it('reads a page from before the blocks by its design', () => {
    expect(motionDesignsOf({ design: { heroLayout: 'expand', portfolioLayout: 'clothesline', productsLayout: 'hanger' } })).toEqual(['expand', 'clothesline', 'hanger']);
    expect(motionDesignsOf({ design: { heroLayout: 'split', portfolioLayout: 'grid' } })).toEqual([]);
  });
});

describe('the section panel on the free plan', () => {
  it('marks the moving layouts and says what the live site shows, with the way to the plans', async () => {
    panel(shelf('belt'), 'p1', 'products');
    const note = await screen.findByTestId('motion-note');
    expect(note).toHaveTextContent('siteEditor.motion.stillNote');
    expect(within(note).getByRole('link', { name: 'siteEditor.motion.upgrade' })).toHaveAttribute('href', '/account');
    expect(marked('Conveyor')).toBe(true);
    expect(marked('Clothes rail')).toBe(true);
    expect(marked('Coverflow')).toBe(true);
    expect(marked('Quiet tiles')).toBe(false);
  });

  it('says the curve shows as a masonry', async () => {
    panel({ design: {}, blocks: [{ id: 'g1', type: 'gallery', variant: 'curve' }] }, 'g1', 'gallery');
    expect(await screen.findByTestId('motion-note')).toHaveTextContent('siteEditor.motion.curveNote');
  });

  it('says nothing under a still layout', async () => {
    panel(shelf('list'), 'p1', 'products');
    await screen.findAllByTestId('plus-mark');
    expect(screen.queryByTestId('motion-note')).toBeNull();
  });

  it('marks the two moving backdrops and speaks of the one in use', async () => {
    panel({ design: { decor: 'sonar' }, components: { hero: { visible: true } } }, 'hero', 'hero');
    const group = screen.getByRole('radiogroup', { name: 'siteEditor.section.heroBackground' });
    expect(await screen.findByTestId('motion-note')).toHaveTextContent('siteEditor.motion.stillNote');
    expect(within(group).getByRole('radio', { name: 'Sonar' }).querySelector('[data-testid="plus-mark"]')).not.toBeNull();
    expect(within(group).getByRole('radio', { name: 'Liquid metal' }).querySelector('[data-testid="plus-mark"]')).not.toBeNull();
    expect(within(group).getByRole('radio', { name: 'Fog' }).querySelector('[data-testid="plus-mark"]')).toBeNull();
  });

  it('in the app offers none it holds still but the current pick, unmarked, and sells nothing', async () => {
    app.native = true;
    panel(shelf('belt'), 'p1', 'products');
    const note = await screen.findByTestId('motion-note');
    expect(within(note).queryByRole('link')).toBeNull();
    expect(within(layouts()).queryByRole('radio', { name: 'Clothes rail' })).toBeNull();
    expect(within(layouts()).queryByRole('radio', { name: 'Coverflow' })).toBeNull();
    expect(marked('Conveyor')).toBe(false);
    expect(within(layouts()).getByRole('radio', { name: 'Quiet tiles' })).toBeTruthy();
  });
});

describe('on a plan with motion', () => {
  it('marks the moving layouts and says nothing more', async () => {
    plan.motionDesigns = true;
    panel(shelf('belt'), 'p1', 'products');
    await screen.findAllByTestId('plus-mark');
    expect(marked('Conveyor')).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('motion-note')).toBeNull();
  });

  it('keeps them all in the app', async () => {
    plan.motionDesigns = true;
    app.native = true;
    panel(shelf('belt'), 'p1', 'products');
    await new Promise((r) => setTimeout(r, 0));
    expect(within(layouts()).getByRole('radio', { name: 'Coverflow' })).toBeTruthy();
  });
});

describe('the page panel', () => {
  const page = (config: object) => render(<MemoryRouter><PagePanel config={config} onUpdate={vi.fn()} /></MemoryRouter>);
  const festive = { design: { stylePreset: 'festive', decor: 'metal' }, blocks: [{ id: 'h', type: 'hero', variant: 'centered' }, { id: 'p', type: 'products', variant: 'belt' }] };

  it('names the site\'s moving designs on the free plan', async () => {
    page(festive);
    const notice = await screen.findByTestId('motion-notice');
    expect(notice).toHaveTextContent('siteEditor.motion.notice');
    expect(notice).toHaveTextContent('Conveyor, Liquid metal');
    expect(within(notice).getByRole('link', { name: 'siteEditor.motion.upgrade' })).toBeTruthy();
  });

  it('says nothing on a plan with motion, or on a site with none', async () => {
    plan.motionDesigns = true;
    const paid = page(festive);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('motion-notice')).toBeNull();
    paid.unmount();
    plan.motionDesigns = false;
    page({ design: {}, blocks: [{ id: 'p', type: 'products', variant: 'well' }] });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('motion-notice')).toBeNull();
  });
});
