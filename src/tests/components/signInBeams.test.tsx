import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInCard } from '../../components/ui/sign-in-card-2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

/** LT-375: the positive control for signInReducedMotion.test — without the setting, the four beams are there. */
describe('the sign-in card with motion allowed', () => {
  it('draws the four travelling beams', () => {
    const { container } = render(
      <MemoryRouter>
        <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('.via-white.to-transparent.opacity-70').length).toBe(4);
  });
});
