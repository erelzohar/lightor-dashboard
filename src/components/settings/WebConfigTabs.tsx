import React from 'react';
import { Palette, Store, Calendar, Compass, MessageSquare, Smartphone, Layout } from 'lucide-react';
import Tabs from '../ui/Tabs';
import { useTheme } from '../../contexts/ThemeContext';

interface WebConfigTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const WebConfigTabs: React.FC<WebConfigTabsProps> = ({ activeTab, onTabChange }) => {
  const { language } = useTheme();

  const tabs = [
    {
      id: 'general',
      label: language === 'he' ? 'פרופיל' : 'Profile',
      icon: <Store size={18} />
    },
    // {
    //   id: 'theme',
    //   label: language === 'he' ? 'עיצוב' : 'Theme',
    //   icon: <Palette size={18} />
    // },
    // {
    //   id: 'schedule',
    //   label: language === 'he' ? 'לו"ז' : 'Schedule',
    //   icon: <Calendar size={18} />
    // },
    {
      id: 'address',
      label: language === 'he' ? 'כתובת' : 'Address',
      icon: <Compass size={18} />
    },
    {
      id: 'contact',
      label: language === 'he' ? 'יצירת קשר' : 'Contact',
      icon: <MessageSquare size={18} />
    },
    // {
    //   id: 'components',
    //   label: language === 'he' ? 'רכיבים' : 'Components',
    //   icon: <Layout size={18} />
    // },
    // {
    //   id: 'mobile',
    //   label: language === 'he' ? 'מובייל' : 'Mobile',
    //   icon: <Smartphone size={18} />
    // }
  ];

  return <Tabs tabs={tabs} defaultTab={activeTab} onChange={onTabChange} />;
};

export default WebConfigTabs;