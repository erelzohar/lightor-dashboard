import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface TopBarProps {
  toggleSidebar: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ toggleSidebar }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { direction } = useTheme();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return t('common.dashboard');
      case '/ai': return t('common.aiBuilder');
      case '/appointments': return t('common.appointments');
      case '/schedule-vacations': return t('common.scheduleVacations');
      case '/appointment-types': return t('common.serviceTypes');
      case '/settings': return t('common.settings');
      case '/portfolio': return t('common.portfolio');
      case '/account': return t('common.account');
      case '/admin': return t('admin.nav.overview');
      case '/admin/users': return t('admin.nav.users');
      case '/admin/appointments': return t('admin.nav.appointments');
      case '/admin/subscriptions': return t('admin.nav.subscriptions');
      case '/admin/costs': return t('admin.nav.costs');
      default:
        if (location.pathname.startsWith('/admin/users/')) return t('admin.nav.userDetail');
        return t('common.dashboard');
    }
  };

  return (
    <header className="h-14 bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-gray-800/60 flex items-center px-4 gap-3 flex-shrink-0 z-20">
      <button
        onClick={toggleSidebar}
        className="p-2 -ml-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors md:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <h1 className="text-base font-semibold text-gray-800 dark:text-dark-text">
        {getPageTitle()}
      </h1>

    </header>
  );
};

export default TopBar;
