import React from 'react';
import { Store, MessageSquare, Globe, CalendarCheck } from 'lucide-react';
import Tabs from '../ui/Tabs';
import { useTranslation } from 'react-i18next';

interface WebConfigTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  /** A booking site's own tab: its rules, questions and calendars (LT-316). */
  bookings?: boolean;
}

/**
 * The settings page's topics (LT-316): the business (name, logo, address),
 * how customers reach it, the site itself, and — on a booking site — the
 * bookings. "Profile" used to hold a bit of everything.
 */
const WebConfigTabs: React.FC<WebConfigTabsProps> = ({ activeTab, onTabChange, bookings = true }) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'general', label: t('settings.tabs.general'), icon: <Store size={18} /> },
    { id: 'contact', label: t('settings.tabs.contact'), icon: <MessageSquare size={18} /> },
    { id: 'site', label: t('settings.tabs.site'), icon: <Globe size={18} /> },
    ...(bookings ? [{ id: 'bookings', label: t('settings.tabs.bookings'), icon: <CalendarCheck size={18} /> }] : []),
  ];

  return <Tabs tabs={tabs} defaultTab={activeTab} onChange={onTabChange} />;
};

export default WebConfigTabs;
