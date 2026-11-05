import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInCard } from '../../components/ui/sign-in-card-2';
import { clearSessionHint, hasSessionHint, hasSignedInBefore, setSessionHint } from '../../services/sessionHint';

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
 * LT-593 (Erel): the login card said "welcome back" to someone signing in for
 * the first time. It says so only on a device that has signed in before; a
 * logout keeps that, it only drops the session hint (LT-164).
 */
describe('the login card greets a first visit and a returning one apart', () => {
  beforeEach(() => localStorage.clear());

  it('a device that never signed in is welcomed, not welcomed back', () => {
    renderCard();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('login.welcome');
    expect(screen.queryByText('login.welcomeBack')).toBeNull();
  });

  it('after a sign-in and a logout, the device is welcomed back', () => {
    setSessionHint();
    clearSessionHint();
    expect(hasSessionHint()).toBe(false);
    expect(hasSignedInBefore()).toBe(true);
    renderCard();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('login.welcomeBack');
  });

  it('a session from before the flag (only the hint) counts as signed in before', () => {
    localStorage.setItem('lightor.signedIn', '1');
    expect(hasSignedInBefore()).toBe(true);
  });
});
