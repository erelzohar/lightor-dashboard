import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { facebookSignInAvailable, isFacebookCancel, nativeFacebookSignIn } from '../../lib/facebookSignIn';
import { SignInCard } from '../../components/ui/sign-in-card-2';

/**
 * LT-552 — Sign in with Facebook. In the app it is Facebook's own sheet
 * through the Firebase plugin: the iPhone asks for Limited Login (an ID token
 * and its nonce, no App Tracking Transparency prompt), Android for an access
 * token. The button has its own switch, apart from the photo imports'.
 */

const signInWithFacebookNative = vi.fn();
vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithFacebook: (...args: unknown[]) => signInWithFacebookNative(...args) },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

const w = window as unknown as { Capacitor?: unknown };
const asApp = (platform: 'ios' | 'android') => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => platform };
};

afterEach(() => {
  delete w.Capacitor;
  vi.unstubAllEnvs();
  signInWithFacebookNative.mockReset();
});

describe('the switch', () => {
  it('is off unless VITE_FACEBOOK_LOGIN_ENABLED is "true" and the app id is set', () => {
    vi.stubEnv('VITE_FACEBOOK_LOGIN_ENABLED', 'false');
    expect(facebookSignInAvailable()).toBe(false);
    vi.stubEnv('VITE_FACEBOOK_LOGIN_ENABLED', 'true');
    // The app id is read once at import; the test env sets none.
    expect(facebookSignInAvailable()).toBe(Boolean(import.meta.env.VITE_FACEBOOK_APP_ID));
  });
});

describe('in the app', () => {
  it('the iPhone uses Limited Login and hands over the ID token and raw nonce', async () => {
    asApp('ios');
    signInWithFacebookNative.mockResolvedValue({ credential: { idToken: 'fb.jwt', nonce: 'raw-1' } });
    expect(await nativeFacebookSignIn()).toEqual({ idToken: 'fb.jwt', nonce: 'raw-1' });
    expect(signInWithFacebookNative).toHaveBeenCalledWith({ useLimitedLogin: true });
  });

  it('Android hands over the access token', async () => {
    asApp('android');
    signInWithFacebookNative.mockResolvedValue({ credential: { accessToken: 'fb-access' } });
    expect(await nativeFacebookSignIn()).toEqual({ accessToken: 'fb-access' });
    expect(signInWithFacebookNative).toHaveBeenCalledWith(undefined);
  });

  it('refuses an answer without a token', async () => {
    asApp('ios');
    signInWithFacebookNative.mockResolvedValue({ credential: { accessToken: 'x' } });
    await expect(nativeFacebookSignIn()).rejects.toThrow('Facebook did not return a token');
  });

  it('a closed sheet is not an error', () => {
    expect(isFacebookCancel(new Error('Sign in canceled.'))).toBe(true);
    expect(isFacebookCancel(new Error('Network error'))).toBe(false);
  });
});

describe('the button', () => {
  const card = (onFacebookLogin?: () => void) =>
    render(
      <MemoryRouter>
        <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={onFacebookLogin} />
      </MemoryRouter>,
    );

  it('shows only when given a handler', () => {
    card();
    expect(screen.queryByTestId('facebook-sign-in')).toBeNull();
  });

  it('takes the whole row when it is the third button', () => {
    render(
      <MemoryRouter>
        <SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onAppleLogin={() => {}} onFacebookLogin={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('facebook-sign-in').className).toContain('col-span-2');
    expect(screen.getByTestId('apple-sign-in')).toHaveTextContent(/^Apple$/);
  });

  it('shares the row with Google when it is the second', () => {
    card(() => {});
    expect(screen.getByTestId('facebook-sign-in').className).not.toContain('col-span-2');
  });

  it('calls it', () => {
    const onFacebook = vi.fn();
    card(onFacebook);
    screen.getByTestId('facebook-sign-in').click();
    expect(onFacebook).toHaveBeenCalled();
  });
});
