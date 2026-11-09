import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { currentAccount, handoffAccount, handoffLogin } from '../services/authApi';
import { saveSession } from '../services/nativeSession';
import { setSessionHint } from '../services/sessionHint';
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
 *
 * LT-635 (LT-631 M4): a link that would replace ANOTHER account signed in here
 * asks first. Any page can open the app's links, and the owner would go on
 * working, unaware, in a stranger's account. A fresh signup, or a link to the
 * account already signed in, goes straight through as before.
 */
const Handoff: React.FC = () => {
  const { t } = useTranslation();
  const { direction } = useTheme();
  const [failed, setFailed] = useState(false);
  const [ask, setAsk] = useState<{ current?: string; next?: string } | null>(null);
  const ran = useRef(false);
  const handoff = useRef<string | null>(null);

  const exchange = (token: string) =>
    handoffLogin(token)
      // Native app (LT-128): the body token becomes the Bearer the reload
      // below hydrates from; no-op on the web.
      .then(({ token: session }) => saveSession(session))
      .then(() => {
        // The next load must probe /auth/me: without the hint (LT-164) a
        // browser that never signed in before skips it and lands a brand
        // new signup on the login page (LT-315).
        setSessionHint();
        // Full navigation, not client-side routing: the exchange set the
        // HttpOnly session cookie (LT-009), and a fresh load makes
        // AuthContext initialise from it everywhere at once.
        window.location.replace('/');
      })
      .catch(() => setFailed(true));

  useEffect(() => {
    // StrictMode mounts twice in dev; the second exchange would race the first.
    if (ran.current) return;
    ran.current = true;

    const match = window.location.hash.match(/[#&]t=([^&]+)/);
    if (!match) {
      setFailed(true);
      return;
    }

    handoff.current = match[1];
    void (async () => {
      const current = await currentAccount();
      if (current) {
        const next = await handoffAccount(match[1]);
        if (!next) {
          setFailed(true);
          return;
        }
        if (next._id !== current._id) {
          setAsk({ current: current.email, next: next.email });
          return;
        }
      }
      await exchange(match[1]);
    })();
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
        {ask && !failed ? (
          <div className="flex flex-col items-center gap-4 max-w-sm" data-testid="handoff-switch">
            <p className="text-lg font-semibold text-light-text dark:text-dark-text">
              {t('handoff.switch.title', 'Switch accounts?')}
            </p>
            <p className="text-sm text-light-text/80 dark:text-dark-text/80 break-words" dir="auto">
              {t('handoff.switch.body', {
                defaultValue: 'This device is signed in to {{current}}. The link opens the account {{next}}.',
                current: ask.current ?? '',
                next: ask.next ?? '',
              })}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => handoff.current && void exchange(handoff.current)}>
                {t('handoff.switch.confirm', 'Switch to the new account')}
              </Button>
              <Button variant="outline" onClick={() => window.location.replace('/')}>
                {t('handoff.switch.stay', 'Stay in my account')}
              </Button>
            </div>
          </div>
        ) : failed ? (
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
