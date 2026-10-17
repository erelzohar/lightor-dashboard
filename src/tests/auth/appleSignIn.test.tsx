import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import { appleLogin } from '../../services/authApi';
import { appleSignInAvailable, isAppleCancel, signInWithApple } from '../../lib/appleSignIn';
import { SignInCard } from '../../components/ui/sign-in-card-2';

/**
 * LT-383 — Sign in with Apple (App Store guideline 4.8, beside Google): the
 * button in the iPhone app (Apple's sheet through the Firebase plugin), on the
 * web once a Services ID exists, never on Android; what reaches the API.
 */

const signInWithAppleNative = vi.fn();
vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithApple: (...args: unknown[]) => signInWithAppleNative(...args) },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

const w = window as unknown as { Capacitor?: unknown; AppleID?: unknown };
const asApp = (platform: 'ios' | 'android') => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => platform };
};

afterEach(() => {
  delete w.Capacitor;
  delete w.AppleID;
  vi.restoreAllMocks();
  signInWithAppleNative.mockReset();
});

describe('where the Apple button shows', () => {
  it('in the iPhone app', () => {
    asApp('ios');
    expect(appleSignInAvailable()).toBe(true);
  });

  it('not in the Android app (Apple sign-in there would be a web flow nobody configured)', () => {
    asApp('android');
    expect(appleSignInAvailable()).toBe(false);
  });

  it('not on the web until the Services ID is set (VITE_APPLE_SERVICES_ID is empty in tests)', () => {
    expect(appleSignInAvailable()).toBe(false);
  });
});

describe('the iPhone app', () => {
  beforeEach(() => asApp('ios'));

  it("hands the API Apple's token, the raw nonce, the one-time code and the first-time name", async () => {
    signInWithAppleNative.mockResolvedValue({
      credential: { idToken: 'apple.jwt', nonce: 'raw-nonce', authorizationCode: 'code-1' },
      user: { displayName: 'Noa Levi' },
    });
    expect(await signInWithApple()).toEqual({ idToken: 'apple.jwt', nonce: 'raw-nonce', authorizationCode: 'code-1', name: 'Noa Levi' });
  });

  it('refuses a result without a token', async () => {
    signInWithAppleNative.mockResolvedValue({ credential: { nonce: 'n' }, user: null });
    await expect(signInWithApple()).rejects.toThrow();
  });

  it('treats closing the sheet as no error', () => {
    expect(isAppleCancel({ message: 'The user canceled the sign-in flow.' })).toBe(true);
    expect(isAppleCancel({ code: 1001 })).toBe(true);
    expect(isAppleCancel({ error: 'popup_closed_by_user' })).toBe(true);
    expect(isAppleCancel(new Error('Invalid Apple token'))).toBe(false);
  });
});

describe('the API call', () => {
  it('posts to /auth/apple with the session cookie', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, token: 'jwt', data: { _id: 'u1' } } } as never);
    const payload = { idToken: 'apple.jwt', nonce: 'raw', authorizationCode: 'c', name: 'Noa' };
    expect(await appleLogin(payload)).toEqual({ token: 'jwt', user: { _id: 'u1' } });
    expect(post).toHaveBeenCalledWith(`${globals.authUrl}apple`, payload, { withCredentials: true });
  });
});

describe('the sign-in card', () => {
  const renderCard = (onAppleLogin?: () => void) =>
    render(
      <MemoryRouter>
        <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} onAppleLogin={onAppleLogin} />
      </MemoryRouter>,
    );

  it('shows "Continue with Apple" beside Google, as tall, and calls back on a tap', () => {
    const onApple = vi.fn();
    renderCard(onApple);
    const button = screen.getByTestId('apple-sign-in');
    expect(button).toHaveTextContent('login.apple');
    expect(button.parentElement?.className).toContain('grid-cols-2');
    fireEvent.click(button);
    expect(onApple).toHaveBeenCalledTimes(1);
  });

  it('has no Apple button where Apple sign-in is not offered', () => {
    renderCard(undefined);
    expect(screen.queryByTestId('apple-sign-in')).toBeNull();
  });
});

describe('the web (Apple JS in a popup)', () => {
  it("puts the nonce's SHA-256 in the request and hands the raw nonce, the code and the name to the API", async () => {
    let initConfig: Record<string, unknown> = {};
    w.AppleID = {
      auth: {
        init: (config: Record<string, unknown>) => { initConfig = config; },
        signIn: async () => ({ authorization: { id_token: 'web.jwt', code: 'code-w' }, user: { name: { firstName: 'Noa', lastName: 'Levi' } } }),
      },
    };
    const result = await signInWithApple();
    expect(result).toMatchObject({ idToken: 'web.jwt', authorizationCode: 'code-w', name: 'Noa Levi' });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.nonce));
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    expect(initConfig.nonce).toBe(hex);
    expect(initConfig).toMatchObject({ usePopup: true, scope: 'name email', redirectURI: `${window.location.origin}/login` });
  });
});
