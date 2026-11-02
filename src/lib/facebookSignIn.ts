import { nativePlatform } from './platform';

/**
 * LT-552: Sign in with Facebook. On the web it is Facebook's JS popup (the
 * Login page mounts the SDK only when the button shows). In the app the
 * browser popup cannot work - Facebook refuses logins inside embedded web
 * views - so it is the Facebook SDK through the Capacitor Firebase plugin, as
 * for Google and Apple (skipNativeAuth: nothing is signed into Firebase).
 *
 * The API gets one of two things:
 * - an access token: the web and Android;
 * - on the iPhone, a Limited Login ID token and the raw nonce whose SHA-256
 *   it carries. iOS gives an access token only to an app the user let track
 *   them (App Tracking Transparency), and Lightor does not ask for that.
 *
 * The button shows only when VITE_FACEBOOK_LOGIN_ENABLED is "true" and the
 * app id is set: the server refuses Facebook until its own keys are in place,
 * and a button that always fails should not be on screen. The photo imports
 * keep their own switch (metaFeatures, LT-091), still waiting on Meta's review.
 */
export type FacebookCredential = { accessToken: string } | { idToken: string; nonce: string };

export const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';

export const facebookSignInAvailable = (): boolean =>
  import.meta.env.VITE_FACEBOOK_LOGIN_ENABLED === 'true' && Boolean(FACEBOOK_APP_ID);

/**
 * A user closing Facebook's sheet or popup is not an error. Android says
 * "Sign in canceled."; the iPhone's Limited Login rejects a cancel with no
 * message at all (the plugin passes neither text nor error for `.cancelled`),
 * while every real failure carries the error's description.
 */
export const isFacebookCancel = (err: unknown): boolean => {
  const e = err as { message?: string; code?: string | number };
  const message = (e?.message ?? '').trim();
  return !message || /cancel/i.test(message) || /cancel/i.test(String(e?.code ?? ''));
};

export const nativeFacebookSignIn = async (): Promise<FacebookCredential> => {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const ios = nativePlatform() === 'ios';
  const result = await FirebaseAuthentication.signInWithFacebook(ios ? { useLimitedLogin: true } : undefined);
  if (ios) {
    const idToken = result.credential?.idToken ?? '';
    const nonce = result.credential?.nonce ?? '';
    if (!idToken || !nonce) throw new Error('Facebook did not return a token');
    return { idToken, nonce };
  }
  const accessToken = result.credential?.accessToken ?? '';
  if (!accessToken) throw new Error('Facebook did not return a token');
  return { accessToken };
};
