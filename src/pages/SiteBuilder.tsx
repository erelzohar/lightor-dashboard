import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchWebConfig } from '../store/slices/webConfigSlice';
import { builderPass } from '../services/authApi';
import globals from '../services/globals';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';

/**
 * LT-388 — a business with no site yet builds it here with the signup wizard
 * itself (register.lightor.app?embed=app), framed: Lighty's start screen, the
 * focused questions and the styles, with no prices and no signup. It replaced
 * the dashboard's own builder (AiBuilder), which had none of those.
 *
 * The frame is on another origin, where this page's session never reaches,
 * so it asks here for a builder pass (with the owner's phone and email, the
 * fallbacks signup takes from its form) and builds and saves the site with it.
 * Once saved, the account is reloaded and the site editor takes this page's
 * place (SiteEditor).
 *
 * Messages are taken only from the frame itself, on the register's origin,
 * and sent only there.
 */
const SiteBuilder: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { auth, refreshUser } = useAuth();
  const dispatch = useAppDispatch();
  const frameRef = useRef<HTMLIFrameElement>(null);
  // The tab bar hides while the keyboard is up, so its room goes too (LT-485):
  // left in, it was a black band right above the keys.
  const keyboardOpen = useVirtualKeyboard();
  const [loaded, setLoaded] = useState(false);
  // Fixed once: a new address would reload the frame and lose the site built so far.
  const [src] = useState(
    () => `${globals.registerOrigin}/?embed=app&lang=${encodeURIComponent((i18n.language || 'he').slice(0, 2))}`,
  );

  // The listener reads these as they are now, without being added again.
  const live = useRef({ phone: auth.user?.phone, email: auth.user?.email, refreshUser });
  useEffect(() => {
    live.current = { phone: auth.user?.phone, email: auth.user?.email, refreshUser };
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.origin !== globals.registerOrigin) return;
      const data = event.data as { type?: unknown; webConfigId?: unknown } | null;

      if (data?.type === 'LT_BUILDER_NEED_PASS') {
        const { phone, email } = live.current;
        builderPass()
          .then((token) => frame.postMessage({ type: 'LT_BUILDER_PASS', token, phone, email }, globals.registerOrigin))
          // No pass: the wizard's own request fails, and it says so.
          .catch(() => undefined);
        return;
      }

      if (data?.type === 'LT_BUILDER_DONE') {
        const siteId = typeof data.webConfigId === 'string' ? data.webConfigId : '';
        // The account now names its site, and the editor opens on it. Should
        // the account not load, the site itself still does.
        void live.current.refreshUser().then((user) => {
          if (!user?.webConfig_id && siteId) void dispatch(fetchWebConfig(siteId));
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [dispatch]);

  return (
    // Edge to edge like the editor it hands over to; on a phone it stops above
    // the tab bar, which floats over the bottom and would cover the wizard's box.
    <div
      className={`relative flex flex-col h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] -m-4 md:-m-6 overflow-hidden bg-black ${keyboardOpen ? 'pb-0' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'} md:pb-0`}
      data-testid="site-builder"
    >
      <iframe
        ref={frameRef}
        src={src}
        title={t('siteBuilder.frameTitle')}
        className="flex-1 w-full border-0 bg-black"
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-white/70" aria-hidden="true" />
          <span className="sr-only">{t('siteBuilder.loading')}</span>
        </div>
      )}
    </div>
  );
};

export default SiteBuilder;
