import { describe, it, expect } from 'vitest';
import { getAt, setAt, removeAt, patchBlock, moveBlock, removeBlock, blockById } from '../../utils/editorPaths';

/** LT-249 — the site editor reads and writes the config by the site's paths. */
const config = () => ({
  businessName: 'Nails',
  components: {
    hero: { title: 'Old', subtitle: 's' },
    about: { features: [{ title: 'A' }, { title: 'B' }] },
    portfolio: { items: [{ url: 'one.webp' }, { url: 'two.webp' }, { url: 'three.webp' }] },
  },
  blocks: [
    { id: 'b1', type: 'hero' },
    { id: 'k7', type: 'manifesto', props: { text: 'We care', items: [{ value: '7', label: 'years' }] } },
    { id: 'b3', type: 'faq', variant: 'lines' },
  ],
  appointmentTypes: [{ _id: 'svc1', name: 'Gel', price: '140' }],
});

describe('editor paths (LT-249)', () => {
  it('reads plain paths, list items, blocks and services by id', () => {
    const c = config();
    expect(getAt(c, 'components.hero.title')).toBe('Old');
    expect(getAt(c, 'components.about.features.1.title')).toBe('B');
    expect(getAt(c, 'blocks.k7.props.text')).toBe('We care');
    expect(getAt(c, 'blocks.k7.props.items.0.label')).toBe('years');
    expect(getAt(c, 'services.svc1.name')).toBe('Gel');
    expect(getAt(c, 'businessName')).toBe('Nails');
    expect(getAt(c, 'blocks.nope.props.text')).toBeUndefined();
    expect(getAt(c, 'components.faq.items.0.answer')).toBeUndefined();
  });

  it('writes a copy along the path and leaves the rest shared', () => {
    const c = config();
    const next = setAt(c, 'components.hero.title', 'New');
    expect(next.components.hero.title).toBe('New');
    expect(c.components.hero.title).toBe('Old');                 // the original is untouched
    expect(next.components.about).toBe(c.components.about);      // untouched branches are shared
    expect(setAt(c, 'components.about.features.0.title', 'Z').components.about.features.map((f) => f.title)).toEqual(['Z', 'B']);
    expect(setAt(c, 'blocks.k7.props.text', 'Hi').blocks[1]).toEqual({ id: 'k7', type: 'manifesto', props: { text: 'Hi', items: [{ value: '7', label: 'years' }] } });
    expect(setAt(c, 'services.svc1.price', '150').appointmentTypes[0].price).toBe('150');
    // A field that did not exist yet is created (an optional section's first text).
    expect(getAt(setAt(c, 'components.faq.items.0.answer', 'Yes'), 'components.faq.items.0.answer')).toBe('Yes');
    // A block or service that is gone: no change.
    expect(setAt(c, 'blocks.gone.props.text', 'x')).toBe(c);
  });

  it('removes a gallery photo; patches, moves and removes blocks', () => {
    const c = config();
    expect(removeAt(c, 'components.portfolio.items.1').components.portfolio.items.map((i) => i.url)).toEqual(['one.webp', 'three.webp']);
    const patched = patchBlock(c, 'b3', { variant: undefined, mod: { tone: 'surface' } });
    expect(blockById(patched, 'b3')).toEqual({ id: 'b3', type: 'faq', mod: { tone: 'surface' } });
    expect(moveBlock(c, 'k7', -1).blocks.map((b) => b.id)).toEqual(['k7', 'b1', 'b3']);
    expect(moveBlock(c, 'b1', -1)).toBe(c);                      // already first
    expect(removeBlock(c, 'k7').blocks.map((b) => b.id)).toEqual(['b1', 'b3']);
  });
});
