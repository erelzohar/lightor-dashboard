import { isNativeApp, nativePlatform } from './platform';

/**
 * LT-383: Sign in with Apple. In the iPhone app it is Apple's own sheet (the
 * Capacitor Firebase plugin, which already runs Google's, with skipNativeAuth:
 * nothing is signed into Firebase). On the web it is Apple's JS in a popup,
 * shown only once the web Services ID exists (VITE_APPLE_SERVICES_ID). Either
 * way the API gets Apple's ID token, the raw nonce whose SHA-256 the token
 * carries, the one-time code (so deleting the account can revoke it at
 * Apple) and, on the first sign-in only, the user's name.
 */
export interface AppleSignInResult {
  idToken: string;
  nonce: string;
  authorizationCode?: string;
  name?: string;
}

const SERVICES_ID = import.meta.env.VITE_APPLE_SERVICES_ID || '';
const APPLE_JS = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/** Where the button shows: the iPhone app always; the web once its Services ID is set; never on Android. */
export const appleSignInAvailable = (): boolean =>
  isNativeApp() ? nativePlatform() === 'ios' : Boolean(SERVICES_ID);

/** A user closing Apple's sheet or popup is not an error. */
export const isAppleCancel = (err: unknown): boolean => {
  const e = err as { message?: string; code?: string | number; error?: string };
  const text = `${e?.message ?? ''} ${e?.error ?? ''}`;
  return /cancel|popup_closed/i.test(text) || String(e?.code) === '1001';
};

const randomNonce = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

interface AppleIDGlobal {
  auth: {
    init: (config: Record<string, unknown>) => void;
    signIn: () => Promise<{
      authorization: { id_token: string; code?: string };
      user?: { name?: { firstName?: string; lastName?: string } };
    }>;
  };
}

let appleJs: Promise<AppleIDGlobal> | null = null;
const loadAppleJs = (): Promise<AppleIDGlobal> => {
  const existing = (window as unknown as { AppleID?: AppleIDGlobal }).AppleID;
  if (existing) return Promise.resolve(existing);
  appleJs ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = APPLE_JS;
    script.async = true;
    script.onload = () => {
      const loaded = (window as unknown as { AppleID?: AppleIDGlobal }).AppleID;
      if (loaded) resolve(loaded); else reject(new Error('Apple sign-in did not load'));
    };
    script.onerror = () => { appleJs = null; reject(new Error('Apple sign-in did not load')); };
    document.head.appendChild(script);
  });
  return appleJs;
};

const nativeAppleSignIn = async (): Promise<AppleSignInResult> => {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithApple();
  const idToken = result.credential?.idToken ?? '';
  const nonce = result.credential?.nonce ?? '';
  if (!idToken || !nonce) throw new Error('Apple did not return a token');
  return {
    idToken,
    nonce,
    authorizationCode: result.credential?.authorizationCode ?? undefined,
    name: result.user?.displayName ?? undefined,
  };
};

const webAppleSignIn = async (): Promise<AppleSignInResult> => {
  const AppleID = await loadAppleJs();
  const nonce = randomNonce();
  AppleID.auth.init({
    clientId: SERVICES_ID,
    scope: 'name email',
    redirectURI: `${window.location.origin}/login`,
    usePopup: true,
    nonce: await sha256Hex(nonce),
  });
  const res = await AppleID.auth.signIn();
  const first = res.user?.name?.firstName?.trim() ?? '';
  const last = res.user?.name?.lastName?.trim() ?? '';
  return {
    idToken: res.authorization.id_token,
    nonce,
    authorizationCode: res.authorization.code,
    name: [first, last].filter(Boolean).join(' ') || undefined,
  };
};

export const signInWithApple = (): Promise<AppleSignInResult> =>
  isNativeApp() ? nativeAppleSignIn() : webAppleSignIn();
