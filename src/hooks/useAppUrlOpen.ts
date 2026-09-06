import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNativeApp } from '../lib/platform';

/**
 * Native deep links and the Android back button (LT-128 §6).
 *
 * Universal links (iOS) / App Links (Android) for dashboard.lightor.app open
 * the app instead of the browser and arrive as `appUrlOpen` events with the
 * full URL — the verify-email and signup-handoff links from email/SMS, and
 * any /appointments or /customers link. We route the path + query client-side
 * (the fragment is kept too: `/handoff#t=…` carries its token there).
 *
 * The Android hardware/gesture back button is not wired to the WebView's
 * history by default; without this it closes the app from every screen.
 *
 * No-op on the web: the browser already does both.
 */
export const useAppUrlOpen = (): void => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    const handles: Promise<PluginListenerHandle>[] = [];

    handles.push(
      App.addListener('appUrlOpen', ({ url }) => {
        try {
          const parsed = new URL(url);
          navigate(parsed.pathname + parsed.search + parsed.hash);
        } catch {
          // Not a URL we can route; ignore rather than crash the shell.
        }
      })
    );

    handles.push(
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.exitApp();
      })
    );

    return () => {
      for (const h of handles) void h.then((handle) => handle.remove()).catch(() => {});
    };
  }, [navigate]);
};
