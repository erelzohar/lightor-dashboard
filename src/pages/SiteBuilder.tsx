import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchWebConfig } from '../store/slices/webConfigSlice';
import { builderPass } from '../services/authApi';
import globals from '../services/globals';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import LightyIcon from '../components/lighty/LightyIcon';

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
 * place (SiteEditor). Framed like this, the wizard wears the dashboard's dark
 * look: this page and it share one colour, so nothing shows where they meet
 * (LT-513; `html[data-embed='app']` in the register's index.css).
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
  // A new account builds with no navbar at all (LT-502).
  const noTabBar = auth.user?.boardingStatus === 'new';
  const [loaded, setLoaded] = useState(false);
  // Fixed once: a new address would reload the frame and lose the site built so far.
  const [src] = useState(
    () => `${globals.registerOrigin}/?embed=app&lang=${encodeURIComponent((i18n.language || 'he').slice(0, 2))}`,
  );

  // The listener reads these as they are now, without being added again.
  const owner = () => ({
    phone: auth.user?.phone,
    email: auth.user?.email,
    // First name only: the wizard greets with it.
    name: auth.user?.name?.trim().split(/\s+/)[0],
    refreshUser,
  });
  const live = useRef(owner());
  useEffect(() => {
    live.current = owner();
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.origin !== globals.registerOrigin) return;
      const data = event.data as { type?: unknown; webConfigId?: unknown } | null;

      if (data?.type === 'LT_BUILDER_NEED_PASS') {
        const { phone, email, name } = live.current;
        builderPass()
          .then((token) => frame.postMessage({ type: 'LT_BUILDER_PASS', token, phone, email, name }, globals.registerOrigin))
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
      className={`relative flex flex-col h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] -m-4 md:-m-6 overflow-hidden bg-[#1e293b] ${keyboardOpen ? 'pb-0' : noTabBar ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'} md:pb-0`}
      data-testid="site-builder"
    >
      <iframe
        ref={frameRef}
        src={src}
        title={t('siteBuilder.frameTitle')}
        className="flex-1 w-full border-0 bg-[#1e293b]"
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1e293b]" role="status">
          <LightyIcon className="w-16 h-16" />
          <span className="text-sm text-slate-300">{t('siteBuilder.loading')}</span>
        </div>
      )}
    </div>
  );
};

export default SiteBuilder;
