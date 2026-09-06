import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { handoffLogin } from '../services/authApi';
import { saveSession } from '../services/nativeSession';
import Button from '../components/ui/Button';

/**
 * Lands a fresh signup from register.lightor.app already signed in. (LT-030)
 *
 * The handoff token arrives in the URL fragment (`/handoff#t=…`) — fragments
 * never reach the server or its logs. It is traded for a real session, which
 * *overwrites* whatever session this browser held: without that, a returning
 * tester registers a new business and silently lands in an old account.
 *
 * On success we leave with `location.replace`, which also swaps this
 * token-bearing entry out of the browser history.
 */
const Handoff: React.FC = () => {
  const { t } = useTranslation();
  const { direction } = useTheme();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    // StrictMode mounts twice in dev; the second exchange would race the first.
    if (ran.current) return;
    ran.current = true;

    const match = window.location.hash.match(/[#&]t=([^&]+)/);
    if (!match) {
      setFailed(true);
      return;
    }

    handoffLogin(match[1])
      // Native app (LT-128): the body token becomes the Bearer the reload
      // below hydrates from; no-op on the web.
      .then(({ token }) => saveSession(token))
      .then(() => {
        // Full navigation, not client-side routing: the exchange set the
        // HttpOnly session cookie (LT-009), and a fresh load makes
        // AuthContext initialise from it everywhere at once.
        window.location.replace('/');
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 bg-light-bg dark:bg-dark-bg transition-colors duration-200 ${
        direction === 'rtl' ? 'rtl-dir' : 'ltr-dir'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        {failed ? (
          <>
            <XCircle className="w-12 h-12 text-red-500" />
            <p className="text-lg font-medium text-light-text dark:text-dark-text">
              {t('handoff.failed', 'The sign-in link has expired')}
            </p>
            <Button onClick={() => window.location.replace('/login')}>
              {t('handoff.goToLogin', 'Sign in')}
            </Button>
          </>
        ) : (
          <>
            <Loader className="w-12 h-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-light-text dark:text-dark-text">
              {t('handoff.connecting', 'Signing you in to your account...')}
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Handoff;
