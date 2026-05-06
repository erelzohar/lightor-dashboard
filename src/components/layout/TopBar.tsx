import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface TopBarProps {
  toggleSidebar: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ toggleSidebar }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { direction, language, darkMode, toggleDarkMode } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications] = useState([
    {
      id: 1,
      title: t('notifications.newAppointment'),
      message: t('notifications.newAppointmentMsg', { time: '12:30' }),
      time: '5m'
    },
    {
      id: 2,
      title: t('notifications.appointmentCancelled'),
      message: t('notifications.appointmentCancelledMsg', { time: '15:00' }),
      time: '1h'
    }
  ]);

  // Page titles based on route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return t('common.dashboard');
      case '/dashboard/appointments':
        return t('common.appointments');
      case '/dashboard/schedule-vacations':
        return t('common.scheduleVacations');
      case '/dashboard/appointment-types':
        return t('common.serviceTypes');
      case '/dashboard/settings':
        return t('common.settings');
      case '/dashboard/portfolio':
        return t('common.portfolio');
      case '/dashboard/account':
        return t('common.account');
      default:
        return t('common.dashboard');
    }
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-light-surface shadow-sm z-[20]"
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md text-light-text hover:bg-light-gray/10 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          <h1 className={`font-semibold text-xl md:text-2xl text-light-text ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}>
            {getPageTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* <button
            onClick={toggleDirection}
            className="p-2 text-light-text hover:bg-light-gray/10 rounded-full transition-colors"
            title={direction === 'rtl' ? 'Switch to English' : 'החלף לעברית'}
          >
            <Globe size={20} />
          </button> */}

          <button
            onClick={toggleDarkMode}
            className="p-2 text-light-text hover:bg-light-gray/10 rounded-full transition-colors"
            title={darkMode ? t('topbar.switchToLight') : t('topbar.switchToDark')}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="relative">
            {/* <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-light-text hover:bg-light-gray/10 rounded-full transition-colors"
              title={language === 'he' ? 'התראות' : 'Notifications'}
            >
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full"></span>
            </button> */}

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-80 bg-light-surface rounded-lg shadow-lg border border-light-gray/10 overflow-hidden z-50`}
                >
                  <div className="p-4 border-b border-light-gray/10">
                    <div className="flex items-center justify-between" style={{ direction }}>
                      <h3 className="font-semibold text-light-text">
                        {t('common.notifications')}
                      </h3>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="p-1 hover:bg-light-gray/10 rounded-full text-light-text"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-light-gray/10">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-4 hover:bg-light-gray/5 transition-colors cursor-pointer"
                        style={{ direction }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-light-text">{notification.title}</h4>
                          <span className="text-xs text-light-gray">{notification.time}</span>
                        </div>
                        <p className="text-sm text-light-gray">{notification.message}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 text-center border-t border-light-gray/10">
                    <button className="text-sm text-primary hover:underline">
                      {t('common.viewAllNotifications')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default TopBar;