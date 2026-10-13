import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import he from '../../i18n/locales/he.json';
import en from '../../i18n/locales/en.json';
import ar from '../../i18n/locales/ar.json';

/**
 * LT-291 — after a language switch the menu kept a stale group of nameless
 * icons above it. Its groups were keyed by their captions, and Arabic's
 * "manage" and "admin" read the same: a duplicate key, and React left the
 * old group behind. Any two captions may coincide in some language, so the
 * test makes them coincide itself.
 */
const { lang } = vi.hoisted(() => ({ lang: { current: 'he' } }));
const clash = { ...ar, sidebar: { ...ar.sidebar, admin: ar.sidebar.manage } };
const tables: Record<string, unknown> = { he, en, clash };
const t = (key: string, fallback?: string) => {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], tables[lang.current]);
  return typeof v === 'string' ? v : fallback ?? key;
};
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: lang.current } }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn(), auth: { user: { _id: 'u1', name: 'Erel', role: 'admin' }, isAuthenticated: true, isLoading: false } }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false, toggleDarkMode: vi.fn() }),
}));
vi.mock('../../hooks/useAppSelector', () => ({ useAppSelector: (): unknown => undefined }));

const tree = () => (
  <MemoryRouter>
    <Sidebar />
  </MemoryRouter>
);

describe('the sidebar across a language switch (LT-291)', () => {
  it('keeps one group per section, even through two captions that read the same', () => {
    lang.current = 'he';
    const { rerender } = render(tree());
    // The calendar is "יומן" in Hebrew — in the menu and the phone's tab bar.
    for (const link of screen.getAllByRole('link', { name: 'יומן' })) expect(link).toHaveAttribute('href', '/appointments');
    for (const next of ['clash', 'en']) {
      lang.current = next;
      rerender(tree());
    }
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Navigation', 'Manage', 'Admin']);
    const named = screen.getAllByRole('group').flatMap((g) => Array.from(g.querySelectorAll('a'), (a) => a.textContent));
    expect(named.filter((n) => n === 'Settings')).toHaveLength(1);
  });
});
