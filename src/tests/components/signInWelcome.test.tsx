import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInCard } from '../../components/ui/sign-in-card-2';
import { clearSessionHint, setSessionHint } from '../../services/sessionHint';
import he from '../../i18n/locales/he.json';
import en from '../../i18n/locales/en.json';
import ar from '../../i18n/locales/ar.json';
import es from '../../i18n/locales/es.json';
import fr from '../../i18n/locales/fr.json';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr', exists: () => false } }),
}));

const renderCard = () =>
  render(
    <MemoryRouter>
      <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} />
    </MemoryRouter>
  );

/**
 * LT-653 (Erel 2026-11-12, "בכל השפות"): the login card always says
 * "Welcome" - a first visit and a returning device alike, in every language.
 * It replaces LT-593's "welcome back" for a device that had signed in before.
 */
describe('the login card always says "Welcome"', () => {
  beforeEach(() => localStorage.clear());

  it('on a device that never signed in', () => {
    renderCard();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^login\.welcome$/);
  });

  it('on a device that signed in and out before', () => {
    setSessionHint();
    clearSessionHint();
    // A flag LT-593 left on phones that signed in before changes nothing.
    localStorage.setItem('lightor.signedInBefore', '1');
    renderCard();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^login\.welcome$/);
  });

  it.each([
    ['he', he, 'ברוכים הבאים'],
    ['en', en, 'Welcome'],
    ['ar', ar, 'مرحبًا بك'],
    ['es', es, 'Te damos la bienvenida'],
    ['fr', fr, 'Bienvenue'],
  ])('%s: "Welcome" is there and no "welcome back" is left', (_lang, locale, welcome) => {
    const login = (locale as { login: Record<string, unknown> }).login;
    expect(login.welcome).toBe(welcome);
    expect(login).not.toHaveProperty('welcomeBack');
  });
});
