import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

const BEAM = '.via-white.to-transparent.opacity-70';

const stubReduceMotion = (on: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null as null,
    dispatchEvent: () => false,
  }));

/**
 * LT-375 — the sign-in card is the first thing the app shows (Apple counts
 * login as a common task): its light beams travel round the card forever, so
 * they stand still when the device asks for less motion.
 */
describe('the sign-in card under reduced motion', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const renderCard = async () => {
    const { SignInCard } = await import('../../components/ui/sign-in-card-2');
    return render(
      <MemoryRouter>
        <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />
      </MemoryRouter>,
    );
  };

  // framer-motion reads the setting once per page, so the case without it
  // (the same selector finds four beams) is its own file: signInBeams.test.
  it('leaves them out when the device asks for less motion', async () => {
    stubReduceMotion(true);
    const { container } = await renderCard();
    expect(container.querySelectorAll(BEAM).length).toBe(0);
  });
});
