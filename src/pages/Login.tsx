import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGoogleLogin } from '@react-oauth/google';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';
import { SignInCard } from '../components/ui/sign-in-card-2';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const { auth, login, loginWithGoogle, loginWithFacebook, loading } = useAuth();
  const { t } = useTranslation();

  const googleLogin = useGoogleLogin({
    onSuccess: (codeResponse) => loginWithGoogle(codeResponse.access_token),
    onError: (error) => console.log('Login Failed:', error),
  });

  if (auth.isLoading) return null;
  if (auth.isAuthenticated) return <Navigate to="/dashboard" />;

  document.title = t('login.title');

  return (
    <FacebookLogin
      appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
      callback={(response: { accessToken: string }) => {
        if (response.accessToken) loginWithFacebook(response.accessToken);
      }}
      render={(renderProps: { onClick: () => void }) => (
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
                className="inline-flex rounded-full p-3 bg-white/10 backdrop-blur-sm"
              >
                <img
                  src="/lightor.svg"
                  alt="Lightor"
                  className="w-14 h-14 object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
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
              bg-gradient-to-br from-slate-100 via-purple-50 to-white
              dark:from-slate-900 dark:via-purple-950/40 dark:to-slate-900
              transition-colors duration-200
            "
          >
            <SignInCard
              onSubmit={login}
              onGoogleLogin={() => googleLogin()}
              onFacebookLogin={renderProps.onClick}
              isLoading={loading}
              error={auth.error}
            />
          </div>

        </div>
      )}
    />
  );
};

export default Login;
