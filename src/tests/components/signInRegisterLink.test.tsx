import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignInCard } from '../../components/ui/sign-in-card-2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

const renderCard = () =>
  render(<SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />);

/**
 * LT-233: register.lightor.app sells the plans (live Paddle prices and
 * checkout), so inside the iOS app the sign-in card may not link to it —
 * App Store guideline 3.1.1, the same rule as the LT-130 billing surfaces.
 */
describe('sign-in card "Register here"', () => {
  afterEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it('links to the register site on the web', () => {
    renderCard();
    expect(screen.getByText('login.registerHere').closest('a')).toHaveAttribute('href', 'https://register.lightor.app');
  });

  it('is not shown inside the app', () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    renderCard();
    expect(screen.queryByText('login.registerHere')).toBeNull();
    expect(screen.queryByText('login.noAccount', { exact: false })).toBeNull();
    expect(document.querySelector('a[href*="register.lightor.app"]')).toBeNull();
  });
});
