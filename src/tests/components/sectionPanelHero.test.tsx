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

  it('is offered for the hero only', () => {
    render(<SectionPanel config={config()} section="about" sectionType="about" fields={[]} onUpdate={vi.fn()} onSelectField={vi.fn()} />);
    expect(screen.queryByRole('radiogroup', { name: 'siteEditor.section.heroBackground' })).toBeNull();
  });
});
