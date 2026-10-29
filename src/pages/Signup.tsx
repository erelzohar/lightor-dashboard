import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import globals from '../services/globals';

/**
 * LT-486 — a new account made inside the app. The page frames the signup form
 * of register.lightor.app (`?embed=signup`): no prices and no checkout there
 * (App Store 3.1.1 forbids steering to a purchase, not making an account), and
 * no Google or Facebook buttons (the sign-in page has the app's own). The
 * frame runs Cloudflare's check, the phone code and the signup itself, then
 * hands back the two-minute handoff token the web signup redirects with;
 * /handoff trades it for the app's session, as after a signup on the web.
 *
 * Messages are taken only from the frame itself, on the register's origin,
 * and sent only there.
 */
const Signup: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  // Fixed once: a new address would reload the frame and lose what was typed.
  const [src] = useState(
    () => `${globals.registerOrigin}/?embed=signup&lang=${encodeURIComponent((i18n.language || 'he').slice(0, 2))}`,
  );

  // The frame learns which page is around it, so it hands the account only here.
  const hello = () => frameRef.current?.contentWindow?.postMessage({ type: 'LT_SIGNUP_HELLO' }, globals.registerOrigin);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.origin !== globals.registerOrigin) return;
      const data = event.data as { type?: unknown; handoffToken?: unknown } | null;

      if (data?.type === 'LT_SIGNUP_READY') {
        frame.postMessage({ type: 'LT_SIGNUP_HELLO' }, globals.registerOrigin);
        return;
      }
      if (data?.type === 'LT_SIGNUP_LOGIN') {
        navigate('/login');
        return;
      }
      if (data?.type === 'LT_SIGNUP_DONE') {
        const token = typeof data.handoffToken === 'string' ? data.handoffToken : '';
        // A full load, as the web signup's redirect is; without a token (an
        // older backend) the account exists, and signing in opens it.
        if (token) window.location.replace(`/handoff#t=${encodeURIComponent(token)}`);
        else navigate('/login');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate]);

  const BackArrow = i18n.dir?.() === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    // Edge to edge in the app (contentInset never): the page keeps clear of
    // the notch and the home indicator itself (LT-210).
    <div
      className="fixed inset-0 flex flex-col bg-black"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="signup-page"
    >
      <div className="flex items-center px-4 py-2 shrink-0">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white">
          <BackArrow size={16} aria-hidden="true" />
          {t('signup.back')}
        </Link>
      </div>
      <div className="relative flex-1 min-h-0">
        <iframe
          ref={frameRef}
          src={src}
          title={t('signup.frameTitle')}
          className="absolute inset-0 w-full h-full border-0 bg-black"
          onLoad={() => {
            setLoaded(true);
            hello();
          }}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-white/70" aria-hidden="true" />
            <span className="sr-only">{t('signup.loading')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
