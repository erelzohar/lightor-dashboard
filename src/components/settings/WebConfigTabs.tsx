import React from 'react';
import { Store, Compass, MessageSquare, Globe } from 'lucide-react';
import Tabs from '../ui/Tabs';
import { useTranslation } from 'react-i18next';

interface WebConfigTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const WebConfigTabs: React.FC<WebConfigTabsProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const tabs = [
    {
      id: 'general',
      label: t('settings.tabs.general'),
      icon: <Store size={18} />
    },
    {
      id: 'address',
      label: t('settings.tabs.address'),
      icon: <Compass size={18} />
    },
    {
      id: 'contact',
      label: t('settings.tabs.contact'),
      icon: <MessageSquare size={18} />
    },
    // What the site does and its main button's text (LT-199).
    {
      id: 'site',
      label: t('settings.tabs.site'),
      icon: <Globe size={18} />
    },
  ];

  return <Tabs tabs={tabs} defaultTab={activeTab} onChange={onTabChange} />;
};

export default WebConfigTabs;
