import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionPanel from '../../components/siteEditor/SectionPanel';

const { t } = vi.hoisted(() => ({ t: (k: string) => k }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr', isDarkMode: false }) }));
// No answer about the plan: no design is held still (LT-570).
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => null) }));

type Block = { id: string; type: string; variant?: string };
type Config = { design: Record<string, unknown>; blocks: Block[]; components: Record<string, unknown> };

const site = (block: Block, design: Record<string, unknown> = {}): Config => ({
  design,
  blocks: [{ id: 'b1', type: 'hero' }, block],
  components: { hero: { visible: true, title: 'Rings' } },
});

const panel = (config: Config, onUpdate = vi.fn()) => {
  const block = config.blocks[1];
  render(
    <MemoryRouter>
      <SectionPanel config={config} section={block.id} sectionType={block.type} fields={[]} onUpdate={onUpdate} onSelectField={vi.fn()} />
    </MemoryRouter>
  );
  return { onUpdate, layouts: within(screen.getByRole('radiogroup', { name: 'siteEditor.section.layout' })) };
};

const lastBlock = (onUpdate: ReturnType<typeof vi.fn>): Block => {
  const config = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as Config;
  return config.blocks[1];
};

/**
 * What the public site draws for the products block: lightor-front ComposedPage
 * passes `variant ?? design.productsLayout`, and Products defaults to 'well'.
 */
const siteDrawsProducts = (block: Block, design: Record<string, unknown>) =>
  block.variant ?? (design.productsLayout as string | undefined) ?? 'well';

/**
 * LT-573: a built site keeps its style's products layout in the design
 * (festive: the conveyor), and the site draws that token whenever the block
 * has no look of its own. The quiet tiles used to be stored as no look, so the
 * pick lit up here and the site went on drawing the conveyor.
 */
describe("the products section's layout", () => {
  it('the quiet tiles stick on a site whose style drew another layout', () => {
    const design = { stylePreset: 'festive', productsLayout: 'belt' };
    const { onUpdate, layouts } = panel(site({ id: 'b3', type: 'products', variant: 'belt' }, design));
    expect(layouts.getByRole('radio', { checked: true })).toHaveTextContent('Conveyor');

    fireEvent.click(layouts.getByRole('radio', { name: 'Quiet tiles' }));
    expect(siteDrawsProducts(lastBlock(onUpdate), design)).toBe('well');
    expect(lastBlock(onUpdate).variant).toBe('well');
  });

  it("with no look of its own, the section shows the design's, as the site draws it", () => {
    // An AI edit of design.productsLayout frees the block's own look (lightor-back carryBlocks).
    const design = { stylePreset: 'atelier', productsLayout: 'hanger' };
    const { onUpdate, layouts } = panel(site({ id: 'b3', type: 'products' }, design));
    expect(layouts.getByRole('radio', { checked: true })).toHaveTextContent('Clothes rail');
    // The rail draws no cards, so there is no card to choose.
    expect(screen.queryByTestId('product-card-choices')).toBeNull();

    fireEvent.click(layouts.getByRole('radio', { name: 'Quiet tiles' }));
    expect(siteDrawsProducts(lastBlock(onUpdate), design)).toBe('well');
  });

  it('with no layout anywhere, the quiet tiles are on, with their card', () => {
    const { onUpdate, layouts } = panel(site({ id: 'b3', type: 'products' }));
    expect(layouts.getByRole('radio', { checked: true })).toHaveTextContent('Quiet tiles');
    expect(screen.getByTestId('product-card-choices')).toBeInTheDocument();

    fireEvent.click(layouts.getByRole('radio', { name: 'Bento' }));
    expect(lastBlock(onUpdate).variant).toBe('bento');
  });
});

/**
 * LT-573: the sections the site draws by a design token when their block has
 * no look of its own (lightor-front ComposedPage) show that token's look.
 */
describe("a section with no look of its own shows the design's", () => {
  it.each([
    ['gallery', { portfolioLayout: 'carousel' }, 'Carousel'],
    ['quote', { testimonialsLayout: 'marquee' }, 'Marquee'],
    ['faq', { faqStyle: 'numbered' }, 'Numbered'],
    ['contact', { contactLayout: 'poster' }, 'Poster'],
    ['footer', { footerLayout: 'ticker' }, 'Ticker'],
    ['schedule', { scheduleStyle: 'inset' }, 'Inset'],
    ['hero', { heroLayout: 'fullbleed' }, 'Full image'],
  ])('%s', (type, design, label) => {
    const { layouts } = panel(site({ id: 'b3', type }, design));
    expect(layouts.getByRole('radio', { checked: true })).toHaveTextContent(label);
  });

  it("the block's own look wins over the design's", () => {
    const { layouts } = panel(site({ id: 'b3', type: 'faq', variant: 'pills' }, { faqStyle: 'numbered' }));
    expect(layouts.getByRole('radio', { checked: true })).toHaveTextContent('Pills');
  });
});

/**
 * The blocks the site draws the same with no look as with their first one
 * (no design token behind them): that look is still stored as none.
 */
describe('a default look the site draws without a token', () => {
  it.each([
    ['interlude', 'split', 'Photo'],
    ['bookingBand', 'poster', 'Plain'],
    ['ledger', 'menu', 'Numbered list'],
    ['manifesto', 'marker', 'Display'],
  ])('%s', (type, other, defaultLabel) => {
    const { onUpdate, layouts } = panel(site({ id: 'b3', type, variant: other }));
    fireEvent.click(layouts.getByRole('radio', { name: defaultLabel }));
    expect(lastBlock(onUpdate)).toEqual({ id: 'b3', type });
  });

  // The styles store 'full' (lightor-back composer); the site draws every interlude but 'split' as the photo.
  it("an interlude the style stored as 'full' shows the photo", () => {
    const { layouts } = panel(site({ id: 'b3', type: 'interlude', variant: 'full' }));
    expect(layouts.getByRole('radio', { checked: true })).toHaveTextContent('Photo');
  });
});
