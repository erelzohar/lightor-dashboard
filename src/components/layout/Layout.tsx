import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchWebConfig } from '../../store/slices/webConfigSlice';
import OnboardingWelcome from '../onboarding/OnboardingWelcome';
import { FloatingAiAssistant } from '../ui/glowing-ai-chat-assistant';

const Layout: React.FC = () => {
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [webConfigChecked, setWebConfigChecked] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const { direction } = useTheme();
  const { auth, updateUser } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const webConfigData = useAppSelector((state) => state.webConfig.data);
  const webConfigLoading = useAppSelector((state) => state.webConfig.loading);
  const webConfigError = useAppSelector((state) => state.webConfig.error);

  const boardingStatus = auth.user?.boardingStatus;

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

  // No route guard for restricted users: the one that used to sit here never
  // fired. Its allow-list was ['/dashboard', '/dashboard/ai'] tested with
  // `pathname.startsWith(p + '/')`, and every page in this Layout lived under
  // /dashboard — so everything matched the first entry and nothing was ever
  // redirected. Rewriting it for the LT-087 root paths would have switched it
  // on for the first time and locked new accounts out of pages they can reach
  // today, so it went instead. Sidebar still hides the nav entries for
  // restricted users (exact match, no prefix bug), which is the half that
  // works. Re-add a real guard here deliberately if the restriction is wanted.

  const handleGetStarted = async () => {
    if (isRestricted) {
      // No webConfig yet — just navigate to AI builder, don't advance status
      setWelcomeDismissed(true);
      navigate('/ai');
      return;
    }
    // Has existing webConfig — advance status and go to dashboard
    setWelcomeLoading(true);
    try {
      await updateUser({ boardingStatus: 'onboarded' });
      navigate('/');
    } finally {
      setWelcomeLoading(false);
    }
  };

  return (
    <div
      className={`h-[100dvh] w-full flex flex-col md:flex-row bg-light-bg dark:bg-dark-bg transition-colors duration-200 ${
        direction === 'rtl' ? 'rtl-dir' : 'ltr-dir'
      }`}
    >
      {boardingStatus === 'new' && !welcomeDismissed && webConfigChecked && (
        <OnboardingWelcome
          userName={auth.user?.name || ''}
          onGetStarted={handleGetStarted}
          isLoading={welcomeLoading}
          isLightyMode={isRestricted}
        />
      )}

      {auth.user?.isVerified && auth.user?.boardingStatus === 'active' && (
        <FloatingAiAssistant
          direction={direction}
          onSend={(msg) => navigate('/ai', { state: { floatingMessage: msg } })}
        />
      )}

      <Sidebar isRestricted={isRestricted} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <motion.main
          className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-none p-4 md:p-6 bg-light-bg dark:bg-dark-bg transition-colors duration-200"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className="container mx-auto h-full">
            <Outlet />
          </div>
        </motion.main>
      </div>
    </div>
  );
};

export default Layout;
