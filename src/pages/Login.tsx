import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGoogleLogin } from '@react-oauth/google';
import FacebookLoginPkg from '@greatsumini/react-facebook-login';
import { SignInCard } from '../components/ui/sign-in-card-2';
import { META_FEATURES_ENABLED } from '../config/metaFeatures';
import { isNativeApp } from '../lib/platform';

// CJS/ESM interop: Vite may expose the whole module object as the default
const FacebookLogin =
  (FacebookLoginPkg as { default?: typeof FacebookLoginPkg }).default ?? FacebookLoginPkg;
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const { auth, login, loginWithGoogle, loginWithGoogleIdToken, loginWithFacebook, loading } = useAuth();
  const { t } = useTranslation();
  const [nativeError, setNativeError] = React.useState<string | null>(null);

  const googleLogin = useGoogleLogin({
    onSuccess: (codeResponse) => loginWithGoogle(codeResponse.access_token),
    onError: (error) => console.log('Login Failed:', error),
  });

  // Native app (LT-128 §3): Google refuses its OAuth pages inside embedded
  // WebViews, so the popup above cannot work there. The Firebase plugin runs
  // the system sign-in sheet and yields an ID token. Loaded on demand so the
  // web bundle never carries firebase/auth. Without a Firebase config file
  // (not in the repo yet) the plugin throws — that is the ordinary login
  // error, not a crash.
  const nativeGoogleLogin = async () => {
    setNativeError(null);
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error('No ID token');
      await loginWithGoogleIdToken(idToken);
    } catch {
      setNativeError('Google login failed');
    }
  };
  const onGoogleLogin = isNativeApp() ? nativeGoogleLogin : () => googleLogin();

  if (auth.isLoading) return null;
  if (auth.isAuthenticated) return <Navigate to="/" />;

  document.title = t('login.title');

  const page = (onFacebookLogin?: () => void) => (
        <div className="min-h-screen flex flex-col lg:flex-row w-full">

          {/* ── Left panel: Lightor hero (desktop only) ── */}
          <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">

            {/* Animated blobs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500/30 rounded-full mix-blend-screen filter blur-xl opacity-70 animate-blob" />
            <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-500/30 rounded-full mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-2000" />
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500/30 rounded-full mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-4000" />

            {/* SVG wave overlay */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 560">
                <defs>
                  <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#wave-gradient)"
                  d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,186.7C1248,181,1344,203,1392,213.3L1440,224L1440,560L1392,560C1344,560,1248,560,1152,560C1056,560,960,560,864,560C768,560,672,560,576,560C480,560,384,560,288,560C192,560,96,560,48,560L0,560Z"
                />
              </svg>
            </div>

            {/* Brand content */}
            <div className="relative z-10 flex flex-col items-center gap-4 px-12 text-center max-w-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, type: 'spring' }}
                className="inline-flex"
              >
                <img
                  src="/lightor-purple.png"
                  alt="Lightor"
                  className="w-20 h-20 object-contain"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7 }}
                className="space-y-3"
              >
                <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                  Lightor
                </h2>
                <p className="text-lg text-white/75 leading-relaxed">
                  {t('login.subtitle')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex justify-center gap-2 pt-2"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === 2 ? 'bg-white w-6' : i === 1 ? 'bg-white/60' : 'bg-white/30'
                    }`}
                  />
                ))}
              </motion.div>
            </div>
          </div>

          {/* ── Right panel: sign-in form (full width on mobile, half on desktop) ── */}
          <div
            className="
              flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8
              bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900
            "
          >
            <div className="w-full flex flex-col items-center gap-6">
              <SignInCard
                onSubmit={login}
                onGoogleLogin={() => void onGoogleLogin()}
                onFacebookLogin={onFacebookLogin ?? (() => {})}
                isLoading={loading}
                error={auth.error ?? nativeError}
                hideRememberMe={isNativeApp()}
              />
              <div className="flex gap-6">
                <a
                  href="https://register.lightor.app/terms.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
                >
                  {t('legal.terms')}
                </a>
                <a
                  href="https://register.lightor.app/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
                >
                  {t('legal.privacy')}
                </a>
              </div>
            </div>
          </div>

        </div>
  );

  // While the Meta integration is parked (LT-090) the Facebook SDK is not
  // mounted at all — hiding the button but still loading Meta's script on
  // every visit to the sign-in page would be the worst of both.
  if (!META_FEATURES_ENABLED) return page();

  return (
    <FacebookLogin
      appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
      onSuccess={(response: { accessToken?: string }) => {
        if (response.accessToken) loginWithFacebook(response.accessToken);
      }}
      render={(renderProps: { onClick?: () => void }) => page(renderProps.onClick)}
    />
  );
};

export default Login;
