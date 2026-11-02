import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * LT-552 — the sign-in page's Facebook button: in the app it opens Facebook's
 * own sheet and never mounts the web SDK; off its switch it is not there.
 */

const state = vi.hoisted(() => ({ native: true, enabled: true }));
const loginWithFacebook = vi.fn();
const nativeFacebookSignIn = vi.fn();
const sdkMounted = vi.fn();

vi.mock('../../lib/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/platform')>()),
  isNativeApp: () => state.native,
  nativePlatform: () => (state.native ? 'ios' : 'web'),
}));
vi.mock('../../lib/facebookSignIn', () => ({
  FACEBOOK_APP_ID: 'fb-app',
  facebookSignInAvailable: () => state.enabled,
  isFacebookCancel: (err: { message?: string } | undefined) => /cancel/i.test(err?.message ?? ''),
  nativeFacebookSignIn: () => nativeFacebookSignIn(),
}));
vi.mock('@greatsumini/react-facebook-login', () => ({
  default: (props: { render: (p: { onClick: () => void }) => React.ReactNode }) => {
    sdkMounted();
    return props.render({ onClick: () => {} });
  },
}));
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => () => {} }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { isLoading: false, isAuthenticated: false, error: null as string | null },
    login: vi.fn(), loginWithGoogle: vi.fn(), loginWithGoogleIdToken: vi.fn(), loginWithApple: vi.fn(),
    loginWithFacebook, loading: false,
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr', language: 'en', exists: () => true } }),
}));

import Login from '../../pages/Login';

const page = () => render(<MemoryRouter><Login /></MemoryRouter>);

beforeEach(() => {
  state.native = true;
  state.enabled = true;
  loginWithFacebook.mockReset();
  nativeFacebookSignIn.mockReset();
  sdkMounted.mockReset();
});

describe('the Facebook button on the sign-in page', () => {
  it('in the app: the native sheet, its credential to the API, no web SDK', async () => {
    nativeFacebookSignIn.mockResolvedValue({ idToken: 'fb.jwt', nonce: 'raw' });
    page();
    expect(sdkMounted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('facebook-sign-in'));
    await waitFor(() => expect(loginWithFacebook).toHaveBeenCalledWith({ idToken: 'fb.jwt', nonce: 'raw' }));
  });

  it('in the app: a closed sheet says nothing, a failure says so', async () => {
    nativeFacebookSignIn.mockRejectedValueOnce(new Error('Sign in canceled.'));
    page();
    fireEvent.click(screen.getByTestId('facebook-sign-in'));
    await waitFor(() => expect(nativeFacebookSignIn).toHaveBeenCalled());
    expect(screen.queryByText('login.facebookFailed')).toBeNull();
    nativeFacebookSignIn.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByTestId('facebook-sign-in'));
    expect(await screen.findByText('login.facebookFailed')).toBeTruthy();
    expect(loginWithFacebook).not.toHaveBeenCalled();
  });

  it('on the web: through the SDK component', () => {
    state.native = false;
    page();
    expect(sdkMounted).toHaveBeenCalled();
    expect(screen.getByTestId('facebook-sign-in')).toBeTruthy();
  });

  it('off its switch: no button and no SDK', () => {
    state.enabled = false;
    page();
    expect(screen.queryByTestId('facebook-sign-in')).toBeNull();
    state.native = false;
    page();
    expect(sdkMounted).not.toHaveBeenCalled();
  });
});
