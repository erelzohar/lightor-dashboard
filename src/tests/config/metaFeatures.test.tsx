import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SignInCard } from '../../components/ui/sign-in-card-2';

vi.mock('react-i18next', () => ({
  // The card asks i18n for the writing direction as well as the strings.
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

/**
 * LT-091 — the Facebook and Instagram surfaces are hidden until App Review
 * approves user_photos and instagram_business_basic (LT-089). Every one of
 * them ends at a consent dialog refusing the scope for anyone without a role
 * on the Meta app, so a business owner clicking them only ever gets an error.
 *
 * The flag is read at module load, so switching it means re-importing the
 * module under test — hence the resetModules dance rather than a plain stub.
 */
const noop = () => {};

const renderCard = () =>
  render(
    <SignInCard
      onSubmit={async () => {}}
      onGoogleLogin={noop}
      onFacebookLogin={noop}
    />
  );

describe('LT-091 Meta feature switch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to off when the variable is absent', async () => {
    vi.stubEnv('VITE_META_FEATURES_ENABLED', '');
    vi.resetModules();
    const { META_FEATURES_ENABLED } = await import('../../config/metaFeatures');
    expect(META_FEATURES_ENABLED).toBe(false);
  });

  it('stays off for any value other than the exact string "true"', async () => {
    for (const value of ['false', 'TRUE', '1', 'yes']) {
      vi.stubEnv('VITE_META_FEATURES_ENABLED', value);
      vi.resetModules();
      const { META_FEATURES_ENABLED } = await import('../../config/metaFeatures');
      expect(META_FEATURES_ENABLED, `value: ${value}`).toBe(false);
    }
  });

  it('turns on for "true"', async () => {
    vi.stubEnv('VITE_META_FEATURES_ENABLED', 'true');
    vi.resetModules();
    const { META_FEATURES_ENABLED } = await import('../../config/metaFeatures');
    expect(META_FEATURES_ENABLED).toBe(true);
  });
});

describe('LT-091 sign-in card while Meta is parked', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('offers Google but not Facebook', () => {
    renderCard();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.queryByText('Facebook')).not.toBeInTheDocument();
  });

  it('still renders the email and password fields', () => {
    renderCard();
    expect(screen.getByPlaceholderText('login.enterEmail')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('login.enterPassword')).toBeInTheDocument();
  });
});
