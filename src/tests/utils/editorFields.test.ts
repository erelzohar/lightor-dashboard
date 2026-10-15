import { describe, it, expect } from 'vitest';
import { fieldInfo, aiEditable, galleryItemPath, sectionFieldsFromConfig } from '../../utils/editorFields';
import { changedLabels } from '../../utils/editorDiff';

/** LT-249 — what the editor knows about each annotated field. */
describe('editor fields (LT-249)', () => {
  it('names fields, with the item number for lists, and knows their limits', () => {
    expect(fieldInfo('components.hero.cta')).toEqual({ kind: 'text', label: 'heroCta', multiline: false, maxLength: 24, store: 'site' });
    expect(fieldInfo('components.faq.items.2.answer')).toMatchObject({ label: 'faqAnswer', n: 3, multiline: true, maxLength: 2000 });
    expect(fieldInfo('components.portfolio.items.0.url')).toMatchObject({ kind: 'image', label: 'galleryImage', n: 1 });
    expect(fieldInfo('blocks.k7.props.items.1.value')).toMatchObject({ label: 'statValue', n: 2 });
    expect(fieldInfo('services.svc1.name')).toMatchObject({ label: 'serviceName', store: 'service' });
    expect(fieldInfo('components.hero.bgType').label).toBe('text');   // not a field the owner edits
  });

  it('hands the AI texts only - never a picture, a price or an unknown path', () => {
    expect(aiEditable('components.hero.title')).toBe(true);
    expect(aiEditable('blocks.k7.props.text')).toBe(true);
    expect(aiEditable('components.hero.heroImageSrc')).toBe(false);
    expect(aiEditable('services.svc1.price')).toBe(false);
    expect(aiEditable('components.hero.bgType')).toBe(false);
    expect(galleryItemPath('components.portfolio.items.3.url')).toBe('components.portfolio.items.3');
    expect(galleryItemPath('components.hero.heroImageSrc')).toBeNull();
  });

  it("reads a section's fields off the config when the site has not listed them", () => {
    const config = {
      businessName: 'Nails',
      components: {
        hero: { title: 'T', subtitle: 'S', bgType: 'fog', heroImageSrc: 'h.webp', cta: 'Book' },
        faq: { visible: true, title: 'FAQ', items: [{ question: 'Q', answer: 'A' }] },
      },
      blocks: [{ id: 'k7', type: 'manifesto', props: { text: 'We care' } }],
    };
    expect(sectionFieldsFromConfig(config, 'hero', 'hero').map((f) => f.path)).toEqual([
      'components.hero.title', 'components.hero.subtitle', 'components.hero.heroImageSrc', 'components.hero.cta',
    ]);
    expect(sectionFieldsFromConfig(config, 'b9', 'faq').map((f) => f.path)).toEqual([
      'components.faq.title', 'components.faq.items.0.question', 'components.faq.items.0.answer',
    ]);
    expect(sectionFieldsFromConfig(config, 'k7', 'manifesto')).toEqual([{ path: 'blocks.k7.props.text', kind: 'text' }]);
  });

  it('names what an AI answer changed: texts by field, then the look', () => {
    const before = { components: { hero: { title: 'A', subtitle: 'B', bgType: 'fog' } }, design: { stylePreset: 'luxe' } };
    const after = { components: { hero: { title: 'A2', subtitle: 'B', bgType: 'gradient' } }, design: { stylePreset: 'bistro' } };
    expect(changedLabels(before, after, (p) => fieldInfo(p).label, 'look')).toEqual(['heroTitle', 'look']);
    expect(changedLabels(before, before, (p) => p, 'look')).toEqual([]);
  });
});
