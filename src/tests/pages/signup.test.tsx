import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Signup from '../../pages/Signup';
import globals from '../../services/globals';
import { stubLocation, restoreLocation } from '../helpers/location';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'he', dir: () => 'rtl' } }),
}));

/**
 * LT-486 - a new account made inside the app: register.lightor.app's signup
 * form, framed with no prices; the frame hands back the handoff token and
 * /handoff signs the account in. Only the frame, on the register's origin, is
 * listened to.
 */
const frame = () => screen.getByTitle('signup.frameTitle') as HTMLIFrameElement;
const fromFrame = (data: unknown, origin = globals.registerOrigin, source: Window | null = frame().contentWindow) =>
  act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
  });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => restoreLocation());

describe('the signup page in the app', () => {
  it("frames the signup form alone, in the owner's language, with a spinner until it loads", () => {
    renderPage();
    expect(frame().src).toBe(`${globals.registerOrigin}/?embed=signup&lang=he`);
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.load(frame());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells the frame which page is around it, on the register origin only', async () => {
    renderPage();
    const post = vi.spyOn(frame().contentWindow!, 'postMessage');
    fireEvent.load(frame());
    await fromFrame({ type: 'LT_SIGNUP_READY' });
    expect(post).toHaveBeenCalledWith({ type: 'LT_SIGNUP_HELLO' }, globals.registerOrigin);
    expect(post.mock.calls.every(([, origin]) => origin === globals.registerOrigin)).toBe(true);
  });

  it('signs the new account in through /handoff with the token the frame hands back', async () => {
    const { replace } = stubLocation('capacitor://app.lightor.app/signup');
    renderPage();
    await fromFrame({ type: 'LT_SIGNUP_DONE', handoffToken: 'ho.abc-1' });
    expect(replace).toHaveBeenCalledWith('/handoff#t=ho.abc-1');
  });

  it("goes to the app's sign-in for a registered email, or when no token came", async () => {
    renderPage();
    await fromFrame({ type: 'LT_SIGNUP_LOGIN' });
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('ignores another origin, and any window but the frame', async () => {
    const { replace } = stubLocation('capacitor://app.lightor.app/signup');
    renderPage();
    await fromFrame({ type: 'LT_SIGNUP_DONE', handoffToken: 'stolen' }, 'https://evil.example');
    await fromFrame({ type: 'LT_SIGNUP_DONE', handoffToken: 'stolen' }, globals.registerOrigin, window);
    await fromFrame({ type: 'LT_SIGNUP_LOGIN' }, 'https://evil.example');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('login page')).toBeNull();
  });

  it('offers the way back to sign in', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'signup.back' })).toHaveAttribute('href', '/login');
  });
});
