import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInCard } from '../../components/ui/sign-in-card-2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

const INTERACTIVE = 'a, button, input, label, select, textarea, [role="button"]';

/**
 * LT-397 — "Forgot password?" could not be tapped: the card's texture is a
 * positioned full-cover layer, so it painted over the link and the "Remember
 * me" label (neither is positioned) and took their taps. jsdom has no hit
 * testing, so this checks the rule instead: a layer that covers the whole card
 * and holds nothing to tap lets taps through.
 */
describe('the sign-in card', () => {
  it('has no decorative layer that takes taps', () => {
    const { container } = render(
      <MemoryRouter>
        <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />
      </MemoryRouter>,
    );
    const covers = [...container.querySelectorAll<HTMLElement>('.absolute.inset-0')].filter(
      (el) => !el.closest(INTERACTIVE) && !el.querySelector(INTERACTIVE) && !el.classList.contains('-z-10'),
    );
    expect(covers.length).toBeGreaterThan(0);
    for (const el of covers) expect(el.className).toContain('pointer-events-none');
  });

  it('links "Forgot password?" to its page', () => {
    render(
      <MemoryRouter>
        <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'login.forgotPassword' }).getAttribute('href')).toBe('/forgot-password');
  });
});
