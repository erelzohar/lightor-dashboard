import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import AdminSidebar from './AdminSidebar';
import TopBar from '../layout/TopBar';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Shell for the operator admin panel (LT-058). Deliberately NOT the owner
 * Layout: that component is entangled with tenant concerns — the webConfig
 * fetch, the onboarding welcome, the restricted-mode redirect to
 * /ai (which would fight /admin paths), the floating AI assistant.
 * This is just sidebar + topbar + outlet with the same flex/dark/RTL shell.
 */
const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const { direction } = useTheme();
  const location = useLocation();

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
      <AdminSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

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

export default AdminLayout;
