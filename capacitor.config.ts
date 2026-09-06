import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shell for the dashboard (LT-128, mobile plan phase 1).
 *
 * `server.hostname` + the https schemes make the WebView's local origin
 * `https://app.lightor.app`. The API's CORS allowlist already admits
 * `https://*.lightor.app`, so the app passes it with zero backend change —
 * and `app.lightor.app` never needs to resolve: it is the WebView's own
 * origin, not a server anyone contacts.
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
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
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
