import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';

/**
 * The way to the Notifications page (LT-527), beside the account's name in
 * the sidebar and the phone's menu; red while any wait unread. Erel: not a
 * page of its own in the menu.
 */
const NotificationBell: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirmLeave } = useLeaveGuard();
  const unread = useUnreadNotifications();
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        confirmLeave(() => navigate('/notifications'), '/notifications');
      }}
      aria-label={unread ? `${t('common.notifications')} (${unread})` : t('common.notifications')}
      title={t('common.notifications')}
      data-testid="notification-bell"
      className="relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700/50 transition-colors"
    >
      <Bell className="h-5 w-5" />
      {!!unread && (
        <span
          className="absolute -top-0.5 -end-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center"
          data-testid="notification-bell-count"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
