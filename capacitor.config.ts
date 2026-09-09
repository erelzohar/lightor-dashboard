import type { CapacitorConfig } from '@capacitor/cli';

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
  // Whatever sits behind the web view shows through during overscroll bounce
  // and keyboard transitions. Left unset it is black, which reads as bars at
  // the top and bottom of the app; match the page instead.
  backgroundColor: '#ffffff',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },
  plugins: {
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    FirebaseAuthentication: {
      // We only need Google's ID token, which our own API verifies (LT-128).
      // Signing the user into Firebase Auth as well would create a Firebase
      // user record nothing reads and, on iOS, write to the keychain — which
      // fails outright on unsigned simulator builds ("keychain error").
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
  // iOS uses Swift Package Manager (CocoaPods is not installed on the build
  // Mac). The two capawesome packages both depend on firebase-ios-sdk, which
  // trips a SwiftPM package-identity collision unless they are symlinked in
  // (capawesome-team/capacitor-firebase#959). The `Google` trait keeps the
  // GoogleSignIn SDK and drops the Facebook SDK — Facebook login is parked
  // behind `metaFeatures` (LT-090) and would only add binary size here.
  experimental: {
    ios: {
      spm: {
        swiftToolsVersion: '6.1',
        packageOptions: {
          '@capacitor-firebase/authentication': { symlink: true },
          '@capacitor-firebase/messaging': { symlink: true },
        },
        packageTraits: {
          '@capacitor-firebase/authentication': ['Google'],
        },
      },
    },
  },
};

export default config;
