import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import { PhoneBarProvider } from '../../contexts/PhoneBarContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchWebConfig } from '../../store/slices/webConfigSlice';
import OnboardingWelcome from '../onboarding/OnboardingWelcome';
import PhoneGate from '../onboarding/PhoneGate';
import BuildingBar from '../onboarding/BuildingBar';
import { FloatingAiAssistant } from '../ui/glowing-ai-chat-assistant';
import PageTour from '../tour/PageTour';
import AccountBanners from './AccountBanners';
import { ReportProblemHost } from '../support/ReportProblem';
import { useDeepLinkLeaveGuard } from '../../hooks/useAppUrlOpen';
import { bindNotificationTaps } from '../../services/pushClient';
import { useTranslation } from 'react-i18next';
import { greetingEmoji, greetingFor } from '../../lib/greeting';
import { useMomentum } from '../../hooks/useMomentum';
import { useLightySuggestions } from '../../hooks/useLightySuggestions';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';

// Pages that deliberately bleed to the edges: they already cancel the
// layout's own padding with negative margins and size themselves, so the
// shared bottom padding would only add a dead gap under them.
// Pages that size themselves off the pane and keep their own bottom room.
// The appointments page (LT-307): its calendar scrolls inside a bounded box,
// so the day row stays on top — in a growable box the grid was as tall as
// its day and the page scrolled the dates away.
const FULL_BLEED_ROUTES = ['/design', '/lighty', '/appointments'];

const Layout: React.FC = () => {
  const { pathname } = useLocation();
  const fullBleed = FULL_BLEED_ROUTES.includes(pathname);
  const [webConfigChecked, setWebConfigChecked] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const { t } = useTranslation();

  const { direction } = useTheme();
  const { auth, updateUser } = useAuth();
  // LT-385: how the week is going against last week - Lighty's mood, on every screen.
  const momentum = useMomentum(!!auth.user);
  // LT-566: the floating Lighty's ready questions, worked out while his card is open.
  const [floatingOpen, setFloatingOpen] = useState(false);
  const floatingSuggestions = useLightySuggestions(floatingOpen && !!auth.user);
  const momentumNote = momentum.mood > 0 && momentum.kind && momentum.pct !== null
    ? t(`lighty.momentum.${momentum.kind}`, { pct: momentum.pct })
    : undefined;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // Leaving a page with unsaved work asks first (LT-267).
  const { confirmLeave } = useLeaveGuard();
  const leaveTo = useCallback(
    (to: string, state?: unknown) => confirmLeave(() => navigate(to, { state }), to),
    [confirmLeave, navigate]
  );

  const webConfigData = useAppSelector((state) => state.webConfig.data);
  const webConfigLoading = useAppSelector((state) => state.webConfig.loading);
  const webConfigError = useAppSelector((state) => state.webConfig.error);

  const boardingStatus = auth.user?.boardingStatus;

  // Native shell (LT-128 §6 / LT-129): deep links (listened for at the app
  // root since LT-315; here they only pass the unsaved-work guard), and
  // notification taps routed to their `data.url`. Both no-ops on the web.
  useDeepLinkLeaveGuard();
  useEffect(() => {
    void bindNotificationTaps(leaveTo);
  }, [leaveTo]);

  // For new users, fetch their webConfig so we can determine if they have one
  useEffect(() => {
    if (boardingStatus !== 'new') {
      setWebConfigChecked(true);
      // The sidebar header shows the business logo + name from webConfig, so
      // load it once for everyone — previously only 'new' users and a few
      // pages fetched it. The error guard stops retrying a failing API (the
      // effect re-runs on every loading flip).
      if (auth.user?.webConfig_id && !webConfigLoading && !webConfigData && !webConfigError) {
        dispatch(fetchWebConfig(auth.user.webConfig_id));
      }
      return;
    }
    if (webConfigData) {
      setWebConfigChecked(true);
      return;
    }
    if (auth.user?.webConfig_id && !webConfigLoading && !webConfigData) {
      dispatch(fetchWebConfig(auth.user.webConfig_id))
        .finally(() => setWebConfigChecked(true));
    } else if (!auth.user?.webConfig_id) {
      setWebConfigChecked(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardingStatus, auth.user?.webConfig_id, webConfigLoading]);

  // A user is "restricted" if they're new AND have no website config yet
  const isRestricted =
    boardingStatus === 'new' && webConfigChecked && !webConfigData?.businessName;

  // LT-500: an account made by Apple or Google sign-in proves its phone before
  // anything else. Only before a site exists: older accounts keep their card.
  // LT-634: the iOS app too (its "later" is gone).
  const needsPhone = isRestricted && auth.user?.freePeriod?.state === 'pending';

  // LT-502: with no site there is one thing to do: build it. The builder opens
  // at once, with no card and no navbar until a site is saved; the only other
  // page is the account's, where it can be deleted (BuildingBar). Hidden from
  // the first frame, before the check for a site has answered.
  const hideNav = boardingStatus === 'new' && (!webConfigChecked || isRestricted);
  const offBuilder = isRestricted && pathname !== '/design' && pathname !== '/account';

  // The card waits for accounts that arrive with a site, not for one just built here.
  useEffect(() => {
    if (isRestricted) setWelcomeDismissed(true);
  }, [isRestricted]);

  // The card used to say this: the phone just proven had its free period already.
  const askedPhone = useRef(false);
  const freePeriodState = auth.user?.freePeriod?.state;
  useEffect(() => {
    if (needsPhone) askedPhone.current = true;
    else if (askedPhone.current && freePeriodState === 'withheld') {
      askedPhone.current = false;
      toast(t('billing.freePeriodUsed'));
    }
  }, [needsPhone, freePeriodState, t]);

  // No webConfig-less account reaches this card (LT-502). Advance the status and
  // go to the dashboard. LT-454: the card goes at once and the status is saved
  // behind it; it waited for the server with a spinner first. If the save
  // fails, the card is back next time - nothing else depends on it.
  const handleGetStarted = () => {
    setWelcomeDismissed(true);
    navigate('/');
    void updateUser({ boardingStatus: 'onboarded' }).catch(() => {});
  };

  return (
    <PhoneBarProvider>
    <div
      // pt: the status bar. The app draws under it (LT-210), and on phones
      // there is no top bar any more to hold that space; zero in a browser.
      className={`h-[100dvh] w-full flex flex-col md:flex-row pt-[env(safe-area-inset-top)] bg-light-bg dark:bg-dark-bg transition-colors duration-200 ${
        direction === 'rtl' ? 'rtl-dir' : 'ltr-dir'
      }`}
    >
      {/* LT-362: the first Tab lands here; it skips the sidebar's links. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[10100] focus:rounded-xl focus:px-4 focus:py-3 focus:bg-white focus:text-gray-900 focus:font-semibold focus:shadow-lg"
      >
        {t('a11y.skip')}
      </a>

      {/* Ambient tint the glass cards blur against — over a flat colour a
          backdrop-filter is invisible. Fixed and paint-only. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60rem 60rem at 12% 8%, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 68%),' +
            'radial-gradient(70rem 70rem at 88% 92%, color-mix(in srgb, var(--color-primary-dark) 14%, transparent), transparent 68%),' +
            'radial-gradient(50rem 50rem at 75% 20%, color-mix(in srgb, #4cd7f6 8%, transparent), transparent 70%)',
        }}
      />

      {/* LT-454: it fades out (0.15s) as it goes. LT-500: the phone comes first. */}
      <AnimatePresence mode="wait">
        {needsPhone ? (
          <PhoneGate key="phone" />
        ) : boardingStatus === 'new' && !welcomeDismissed && webConfigChecked && !isRestricted ? (
          <OnboardingWelcome
            key="welcome"
            userName={auth.user?.name || ''}
            onGetStarted={handleGetStarted}
            isLoading={false}
          />
        ) : null}
      </AnimatePresence>

      {/* LT-253: Lighty, a tap away — not over his own page, nor over the
          site editor, where he already sits in the panel. LT-269: on the home
          page he also says the greeting the page used to print at its top, so
          there he shows for every owner (not only active, verified ones) —
          except under the first-run welcome overlay. */}
      {pathname !== '/design' && pathname !== '/lighty' && auth.user && !hideNav && (
        (auth.user.isVerified && auth.user.boardingStatus === 'active') ||
        (pathname === '/' && !(boardingStatus === 'new' && !welcomeDismissed))
      ) && (
        <FloatingAiAssistant
          direction={direction}
          greeting={pathname === '/' ? `${t('common.greetingWithName', { greeting: greetingFor(t), name: auth.user.name })} ${greetingEmoji()}` : undefined}
          mood={momentum.mood}
          note={momentumNote}
          onSend={(msg) => leaveTo('/lighty', { lightyMessage: msg })}
          onOpenPage={() => leaveTo('/lighty')}
          suggestions={floatingSuggestions}
          onOpenChange={setFloatingOpen}
        />
      )}

      {!hideNav && <Sidebar isRestricted={isRestricted} />}

      {/* Lighty's page tours (LT-389): not while the account is still being
          set up, nor under the first-run welcome. */}
      {/* LT-448: "report a problem", opened from the sidebar or the phone's More. */}
      <ReportProblemHost />

      <PageTour enabled={!!auth.user && !isRestricted && !(boardingStatus === 'new' && !welcomeDismissed)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {isRestricted && !needsPhone && <BuildingBar />}
        <motion.main
          // data-scroll-root: PullToRefresh listens on this scroller. The
          // phone bottom padding clears the fixed BottomTabBar (h≈3.5rem) plus
          // the home indicator; md+ has no bar (LT-127).
          data-scroll-root
          id="main-content"
          tabIndex={-1}
          className="flex-1 focus:outline-none overflow-x-hidden overflow-y-auto overscroll-y-none p-4 md:p-6 bg-light-bg dark:bg-dark-bg transition-colors duration-200"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* Bottom room for every page lives here, once. It CANNOT sit on the
              scrolling <main>: a scroll container drops its padding-bottom as soon
              as content overflows, which is why cards sat flush against the edge
              (and why content could slide under the phone tab bar). A growable
              min-h-full flex column keeps short pages filling the pane while the
              padding still renders below overflowing content. */}
          <div
            className={`container mx-auto flex flex-col ${
              // Full-bleed pages size themselves off this box (the AI builder is
              // h-[calc(100%+3rem)] with negative margins), and a percentage
              // height cannot resolve against an auto-height min-h-full parent —
              // it collapses to nothing. They get a definite height; everyone
              // else gets the growable box that makes the bottom padding render.
              fullBleed
                ? 'h-full'
                : 'min-h-full pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8'
            }`}
          >
            {/* LT-458: a failed payment, or a free month's bookings used up.
                Not on the Account page, which says it beside the subscription,
                nor over the pages that size themselves off this box. */}
            {!fullBleed && pathname !== '/account' && <AccountBanners go={leaveTo} />}
            {/* Behind the phone step nothing runs: the builder takes the proven phone when it opens. */}
            {needsPhone ? null : offBuilder ? <Navigate to="/design" replace /> : <Outlet />}
          </div>
        </motion.main>
      </div>
    </div>
    </PhoneBarProvider>
  );
};

export default Layout;
