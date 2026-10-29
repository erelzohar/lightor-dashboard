import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInCard } from '../../components/ui/sign-in-card-2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

const renderCard = () =>
  // The card links to /forgot-password (LT-315), so it needs a router.
  render(
    <MemoryRouter>
      <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />
    </MemoryRouter>
  );

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

  // LT-486: inside the app it is the app's own signup page, which frames the
  // signup form alone - still never a link to the register site.
  it("inside the app, goes to the app's own signup page", () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    renderCard();
    expect(screen.getByText('login.registerHere').closest('a')).toHaveAttribute('href', '/signup');
    expect(screen.getByText('login.noAccount', { exact: false })).toBeInTheDocument();
    expect(document.querySelector('a[href*="register.lightor.app"]')).toBeNull();
  });
});
