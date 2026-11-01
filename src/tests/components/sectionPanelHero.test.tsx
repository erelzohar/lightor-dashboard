import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SectionPanel from '../../components/siteEditor/SectionPanel';

const { t } = vi.hoisted(() => ({ t: (k: string) => k }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr', isDarkMode: false }) }));

const config = (bgType?: string) => ({
  design: {},
  components: { hero: { visible: true, title: 'Sharp cuts', ...(bgType !== undefined ? { bgType } : {}) } },
});

/** LT-287 — the hero's animated background can be chosen in the editor. */
describe("the hero's background effect", () => {
  it('shows the stored effect, reads legacy values as fog, and writes the choice', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <SectionPanel config={config('clouds')} section="hero" sectionType="hero" fields={[]} onUpdate={onUpdate} onSelectField={vi.fn()} />
    );
    const group = screen.getByRole('radiogroup', { name: 'siteEditor.section.heroBackground' });
    expect(within(group).getByRole('radio', { name: 'Clouds' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(within(group).getByRole('radio', { name: 'Birds' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      components: { hero: expect.objectContaining({ bgType: 'birds', title: 'Sharp cuts' }) },
    }));

    // 'gradient' (and nothing stored) render fog on the site, so fog is the one on.
    rerender(<SectionPanel config={config('gradient')} section="hero" sectionType="hero" fields={[]} onUpdate={onUpdate} onSelectField={vi.fn()} />);
    expect(within(screen.getByRole('radiogroup', { name: 'siteEditor.section.heroBackground' })).getByRole('radio', { name: 'Fog' })).toHaveAttribute('aria-checked', 'true');
  });

  // LT-531: these two are design.decor, which the site draws in place of bgType.
  it('writes the two backdrops of the design to its decor, and the others clear them', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <SectionPanel config={config('clouds')} section="hero" sectionType="hero" fields={[]} onUpdate={onUpdate} onSelectField={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Liquid metal' }));
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ design: { decor: 'metal' } }));

    rerender(<SectionPanel config={{ ...config('clouds'), design: { decor: 'sonar' } }} section="hero" sectionType="hero" fields={[]} onUpdate={onUpdate} onSelectField={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Sonar' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Clouds' })).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('radio', { name: 'Birds' }));
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      design: { decor: 'none' },
      components: { hero: expect.objectContaining({ bgType: 'birds' }) },
    }));
  });

  it('leaves another decor alone', () => {
    const onUpdate = vi.fn();
    render(<SectionPanel config={{ ...config('clouds'), design: { decor: 'stamp' } }} section="hero" sectionType="hero" fields={[]} onUpdate={onUpdate} onSelectField={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Birds' }));
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ design: { decor: 'stamp' } }));
  });

  it('is not offered on a hero that draws its own backdrop', () => {
    render(<SectionPanel config={{ ...config('clouds'), design: { heroLayout: 'parallax' } }} section="hero" sectionType="hero" fields={[]} onUpdate={vi.fn()} onSelectField={vi.fn()} />);
    expect(screen.queryByRole('radiogroup', { name: 'siteEditor.section.heroBackground' })).toBeNull();
  });

  it('is offered for the hero only', () => {
    render(<SectionPanel config={config()} section="about" sectionType="about" fields={[]} onUpdate={vi.fn()} onSelectField={vi.fn()} />);
    expect(screen.queryByRole('radiogroup', { name: 'siteEditor.section.heroBackground' })).toBeNull();
  });
});
