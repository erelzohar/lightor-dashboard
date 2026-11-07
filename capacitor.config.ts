import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'fs';

/**
 * LT-608: the over-the-air bundles' public key, from .env.production (the
 * one place the dashboard's public keys live). Read here because the native
 * plugin takes it from this config at `cap sync`, not from the bundle - a
 * bundle cannot change the key that checks it.
 */
const liveUpdatePublicKey = (): string | undefined => {
  try {
    const line = readFileSync('.env.production', 'utf8').split('\n').find((l) => l.startsWith('VITE_LIVE_UPDATE_PUBLIC_KEY='));
    return line?.slice('VITE_LIVE_UPDATE_PUBLIC_KEY='.length).trim() || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Capacitor shell for the dashboard (LT-128, mobile plan phase 1).
 *
 * `server.hostname` sets the WebView's local origin. `app.lightor.app` never
 * needs to resolve: it is the WebView's own origin, not a server anyone
 * contacts.
 *
 * The two schemes below do NOT produce the same origin, which cost a full
 * debugging round trip (LT-128). Android honours `androidScheme: 'https'` and
 * lands on `https://app.lightor.app`, which the API's `*.lightor.app` wildcard
 * already admits. iOS does not: WKWebView reserves https, so Capacitor's
 * `normalize()` silently resets the scheme to its own default and the app runs
 * on `capacitor://app.lightor.app` — an origin the API had to be taught
 * explicitly (see `IOS_APP_ORIGIN` in lightor-back's `app.ts`). Leaving
 * `iosScheme: 'https'` here is harmless but inert; it is kept only so the
 * intent, and the fact that iOS ignores it, stay visible.
 */
const config: CapacitorConfig = {
  appId: 'app.lightor.dashboard',
  appName: 'Lightor',
  webDir: 'dist',
  server: {
    hostname: 'app.lightor.app',
    iosScheme: 'https',
    androidScheme: 'https',
  },
  // Whatever sits behind the web view shows through during keyboard
  // transitions. Left unset it is black; match the page instead.
  backgroundColor: '#ffffff',
  ios: {
    // The page draws edge to edge and keeps clear of the notch and the home
    // indicator itself, with env(safe-area-inset-*) (LT-210). 'automatic'
    // inset the whole web view as well, so the safe areas were counted twice:
    // a white native band above the page's own status-bar padding and another
    // below the tab bar's home-indicator padding.
    contentInset: 'never',
    backgroundColor: '#ffffff',
  },
  plugins: {
    // LT-608: over-the-air updates from our own server (src/lib/liveUpdate.ts
    // decides when); a bundle must carry our signature, must call ready()
    // within 30 s or it is rolled back, and a rolled-back bundle is never
    // tried again.
    LiveUpdate: {
      autoUpdateStrategy: 'none',
      readyTimeout: 30000,
      autoBlockRolledBackBundles: true,
      publicKey: liveUpdatePublicKey(),
    },
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    FirebaseAuthentication: {
      // We only need Google's (LT-128) and Apple's (LT-383) ID tokens and
      // Facebook's token (LT-552), which our own API verifies.
      // Signing the user into Firebase Auth as well would create a Firebase
      // user record nothing reads and, on iOS, write to the keychain — which
      // fails outright on unsigned simulator builds ("keychain error").
      skipNativeAuth: true,
      providers: ['google.com', 'apple.com', 'facebook.com'],
    },
  },
  // iOS uses Swift Package Manager (CocoaPods is not installed on the build
  // Mac). The two capawesome packages both depend on firebase-ios-sdk, which
  // trips a SwiftPM package-identity collision unless they are symlinked in
  // (capawesome-team/capacitor-firebase#959). The `Google` and `Facebook`
  // traits link the GoogleSignIn and Facebook SDKs (Facebook since LT-552).
  experimental: {
    ios: {
      spm: {
        swiftToolsVersion: '6.1',
        packageOptions: {
          '@capacitor-firebase/authentication': { symlink: true },
          '@capacitor-firebase/messaging': { symlink: true },
        },
        packageTraits: {
          '@capacitor-firebase/authentication': ['Google', 'Facebook'],
        },
      },
    },
  },
};

export default config;
