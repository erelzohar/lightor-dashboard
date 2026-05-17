import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { fetchWebConfig } from '../../store/slices/webConfigSlice';
import OnboardingWelcome from '../onboarding/OnboardingWelcome';
import { FloatingAiAssistant } from '../ui/glowing-ai-chat-assistant';

const ALLOWED_WHEN_RESTRICTED = ['/dashboard', '/dashboard/ai'];

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [webConfigChecked, setWebConfigChecked] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const { direction } = useTheme();
  const { auth, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  const webConfigData = useAppSelector((state) => state.webConfig.data);
  const webConfigLoading = useAppSelector((state) => state.webConfig.loading);

  const boardingStatus = auth.user?.boardingStatus;

  // For new users, fetch their webConfig so we can determine if they have one
  useEffect(() => {
    if (boardingStatus !== 'new') {
      setWebConfigChecked(true);
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

  // Guard restricted users away from locked pages
  useEffect(() => {
    if (!isRestricted) return;
    const allowed = ALLOWED_WHEN_RESTRICTED.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + '/')
    );
    if (!allowed) navigate('/dashboard/ai', { replace: true });
  }, [isRestricted, location.pathname, navigate]);

  const handleGetStarted = async () => {
    if (isRestricted) {
      // No webConfig yet — just navigate to AI builder, don't advance status
      setWelcomeDismissed(true);
      navigate('/dashboard/ai');
      return;
    }
    // Has existing webConfig — advance status and go to dashboard
    setWelcomeLoading(true);
    try {
      await updateUser({ boardingStatus: 'onboarded' });
      navigate('/dashboard');
    } finally {
      setWelcomeLoading(false);
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div
      className={`h-[100dvh] w-full flex bg-light-bg dark:bg-dark-bg transition-colors duration-200 ${
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
          onSend={(msg) => navigate('/dashboard/ai', { state: { floatingMessage: msg } })}
        />
      )}

      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} isRestricted={isRestricted} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar toggleSidebar={toggleSidebar} />

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
