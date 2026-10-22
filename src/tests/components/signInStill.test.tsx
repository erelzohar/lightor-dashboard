import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

// Every motion element hands its `transition` here, so the test can see what
// framer would run (jsdom never animates anything itself).
const { transitions } = vi.hoisted(() => ({ transitions: [] as unknown[] }));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const React = await import('react');
  const MOTION_PROPS = ['initial', 'animate', 'exit', 'whileTap', 'whileHover', 'layout'];
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (_target, tag: string) =>
      React.forwardRef<HTMLElement, Record<string, unknown>>(({ transition, ...props }, ref) => {
        transitions.push(transition);
        for (const p of MOTION_PROPS) delete props[p];
        return React.createElement(tag, { ...props, ref });
      }),
  });
  return { ...actual, motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

const repeatsForever = (t: unknown): boolean =>
  !!t && typeof t === 'object' &&
  Object.entries(t as Record<string, unknown>).some(([k, v]) => (k === 'repeat' && v === Infinity) || repeatsForever(v));

const renderCard = async (isLoading: boolean) => {
  const { SignInCard } = await import('../../components/ui/sign-in-card-2');
  return render(
    <MemoryRouter>
      <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} isLoading={isLoading} />
    </MemoryRouter>,
  );
};

/**
 * LT-433 — the card sits behind a backdrop blur, so anything on it that moves
 * forever redraws the blur every frame: ~45% CPU on an idle login screen in
 * the Android emulator, and an ANR on a 2 GB one. It may move as it opens,
 * then it stands still.
 */
describe('the sign-in card at rest', () => {
  beforeEach(() => { transitions.length = 0; });

  it('runs no endless animation', async () => {
    await renderCard(false);
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.filter(repeatsForever)).toEqual([]);
  });

  // Positive control: the detector does find an endless animation, the
  // button's shimmer, which runs only while signing in.
  it('shimmers the button only while signing in', async () => {
    await renderCard(true);
    expect(transitions.filter(repeatsForever)).toHaveLength(1);
  });
});
