import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNativeApp } from '../lib/platform';
import { useLeaveGuard } from '../contexts/LeaveGuardContext';

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
 *
 * LT-315: the listener used to live in the signed-in Layout, so a link that
 * opened a signed-out app (the signup handoff, the verify link behind the
 * verify-email gate, a password reset) found nobody listening and the app
 * stayed on the login page. It now runs for every route, from the app root
 * (`AppUrlOpenListener`); the signed-in Layout only lends it the leave guard,
 * so a link that opens the app mid-edit still asks before leaving (LT-267).
 */
let guardedNavigate: ((to: string) => void) | null = null;

/** The signed-in Layout: route deep links through the unsaved-work guard. */
export const useDeepLinkLeaveGuard = (): void => {
  const navigate = useNavigate();
  const { confirmLeave } = useLeaveGuard();
  useEffect(() => {
    const go = (to: string) => confirmLeave(() => navigate(to), to);
    guardedNavigate = go;
    return () => {
      if (guardedNavigate === go) guardedNavigate = null;
    };
  }, [navigate, confirmLeave]);
};

/** The app root: listen once, for the app's whole life. */
export const useAppUrlOpen = (): void => {
  const navigate = useNavigate();
  // Read through a ref: react-router hands out a new navigate on every page,
  // and the listeners should not be torn down and re-added each time.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!isNativeApp()) return;
    const handles: Promise<PluginListenerHandle>[] = [];

    handles.push(
      App.addListener('appUrlOpen', ({ url }) => {
        try {
          const parsed = new URL(url);
          const to = parsed.pathname + parsed.search + parsed.hash;
          (guardedNavigate ?? navigateRef.current)(to);
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
  }, []);
};
