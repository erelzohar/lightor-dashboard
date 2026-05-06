import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CalendarRange,
  Settings,
  LogOut,
  Tag,
  ChevronRight,
  ChevronLeft,
  Scissors,
  Crown,
  KeyRound,
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, auth } = useAuth();
  const { direction, language, darkMode } = useTheme();

  const sidebarVariants = {
    open: {
      x: 0,
      width: 280,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    closed: {
      x: direction === 'rtl' ? '100%' : '-100%',
      width: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    }
  };

  // Navigation items
  const navItems = [
    {
      path: '/dashboard',
      Icon: LayoutDashboard,
      name: t('common.dashboard'),
    },
    {
      path: '/dashboard/appointments',
      Icon: CalendarRange,
      name: t('common.appointments'),
    },
    {
      path: '/dashboard/schedule-vacations',
      Icon: Calendar,
      name: t('common.scheduleVacations'),
    },
    {
      path: '/dashboard/appointment-types',
      Icon: Tag,
      name: t('common.serviceTypes'),
    },
    {
      path: '/dashboard/portfolio',
      Icon: ImageIcon,
      name: t('common.portfolio'),
    },
    {
      path: '/dashboard/settings',
      Icon: Settings,
      name: t('common.settings'),
    },
  ];

  // Set the sidebar to closed on mobile by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ChevronIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        variants={sidebarVariants}
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        className={`fixed md:sticky top-0 ${direction === 'rtl' ? 'right-0' : 'left-0'} h-[100dvh] 
          bg-light-surface shadow-xl overflow-hidden flex flex-col justify-between z-50
          ${direction === 'rtl' ? 'border-l' : 'border-r'} border-light-gray/10
          transition-colors duration-200`}
      >
        {/* Sidebar Content */}
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 flex items-center justify-between">
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="full-logo"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center space-x-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Scissors size={24} className="text-primary" />
                  </div>
                  <span className="font-semibold text-lg bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                    {auth?.user.name}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="icon-only"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"
                >
                  <Scissors size={24} className="text-primary" />
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-light-gray/10 transition-colors"
              aria-label={isOpen ? t('sidebar.closeSidebar') : t('sidebar.openSidebar')}
            >
              <ChevronIcon size={20} className="text-light-text" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 pt-4 px-3">
            <ul className="space-y-2">
              {navItems.map(({ path, Icon, name }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    end
                    onClick={() => window.innerWidth < 768 && toggleSidebar()}
                    className={({ isActive }) => {
                      const baseClasses = 'flex items-center py-3 px-4 rounded-xl transition-all duration-300 group relative overflow-hidden';
                      const activeClasses = 'bg-primary text-white font-medium shadow-lg shadow-primary/20';
                      const inactiveClasses = 'text-light-text hover:bg-light-gray/10 hover:text-primary';

                      return `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;
                    }}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Background Animation */}
                        {isActive && (
                          <motion.div
                            layoutId="nav-background"
                            className="absolute inset-0 bg-gradient-to-r from-primary to-primary-dark"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          />
                        )}

                        {/* Icon and Text */}
                        <div className="relative flex items-center w-full">
                          <Icon
                            size={22}
                            className={`flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'
                              }`}
                          />
                          {isOpen && (
                            <span className={`${direction === 'rtl' ? 'mr-3' : 'ml-3'} truncate`}>
                              {name}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* User & Logout */}
        <div className="p-4 mt-auto">
          {isOpen && (
            <>
              <div
                onClick={() => {
                  window.innerWidth < 768 && toggleSidebar();
                  navigate('/dashboard/account');
                }}
                className="mb-4 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 backdrop-blur-sm border border-light-gray cursor-pointer"
              >
                <div className="flex items-center mb-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white flex items-center justify-center text-lg font-medium shadow-lg shadow-primary/20">
                      {auth.user?.name.charAt(0).toUpperCase() || 'A'}
                    </div>
                    {/* {auth.user?.subscription === 'premium' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Crown size={12} className="text-yellow-600" />
                      </div>
                    )} */}
                  </div>
                  <div className={`${direction === 'rtl' ? 'mr-3' : 'ml-3'} flex-1 min-w-0`}>
                    <p className="text-sm font-medium text-light-text truncate">
                      {auth.user?.name || 'Admin User'}
                    </p>
                    <p className="text-xs text-light-gray truncate">
                      {t('common.accountSettings')}
                      {/* {auth.user?.email || 'admin@example.com'} */}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-1 rounded-md ${
                    auth.user?.subscription === 'premium' 
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-light-surface text-light-gray'
                  }`}>
                    {auth.user?.subscription === 'premium' 
                      ? t('common.premiumAccount')
                      : t('common.basicAccount')
                    }
                  </span>
                  <button className="text-primary hover:underline">
                    {t('common.upgrade')}
                  </button>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-light-gray/20 to-transparent my-2" />
            </>
          )}

          <button
            onClick={logout}
            className="flex items-center w-full py-3 px-4 rounded-xl transition-all duration-300 
              text-light-text hover:bg-red-50 hover:text-red-500 group"
          >
            <LogOut size={22} className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />
            {isOpen && (
              <span className={`${direction === 'rtl' ? 'mr-3' : 'ml-3'} truncate`}>
                {t('common.logout')}
              </span>
            )}
          </button>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;