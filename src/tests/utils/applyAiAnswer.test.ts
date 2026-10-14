import { describe, it, expect } from 'vitest';
import { applyAiAnswer } from '../../utils/editorDiff';

/**
 * LT-315 (M8) — a whole-site AI answer lands on the draft as it is when it
 * arrives: only the parts it changed travel, everything else stays as the
 * owner left it meanwhile.
 */
describe('applyAiAnswer', () => {
  const before = {
    businessName: 'Nails',
    design: { stylePreset: 'boutique' },
    blocks: [{ id: 'b1', type: 'hero' }],
    components: { hero: { title: 'Old' }, faq: { title: 'FAQ' } },
  };

  it('takes the sections the answer changed and keeps the rest of the newer draft', () => {
    const prev = { ...before, design: { stylePreset: 'boutique', headingFont: 'playfair' }, components: { ...before.components, faq: { title: 'Typed meanwhile' } } };
    const after = { ...before, components: { ...before.components, hero: { title: 'New' } } };
    expect(applyAiAnswer(prev, before, after)).toEqual({
      ...prev,
      components: { hero: { title: 'New' }, faq: { title: 'Typed meanwhile' } },
    });
  });

  it('takes a changed top-level key whole, and drops one the answer removed', () => {
    const after = { ...before, design: { stylePreset: 'bold' }, businessName: undefined as string | undefined };
    const result = applyAiAnswer(before, before, after) as Record<string, unknown>;
    expect(result.design).toEqual({ stylePreset: 'bold' });
    expect('businessName' in result).toBe(false);
    expect(result.blocks).toBe(before.blocks);
  });

  it('with nothing done meanwhile, is the answer', () => {
    const after = { ...before, components: { ...before.components, faq: { title: 'Q&A' } }, blocks: [] as unknown[] };
    expect(applyAiAnswer(before, before, after)).toEqual(after);
  });
});
