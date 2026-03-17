import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab, onChange }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  return (
    <div className="border-b border-light-gray">
      <div className="flex space-x-4 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`
              px-4 py-3 relative whitespace-nowrap flex items-center
              focus:outline-none transition-colors
              ${activeTab === tab.id
                ? 'text-primary font-medium'
                : 'text-light-text hover:text-primary border-primary dark:border-primary-dark hover:bg-primary/10'
              }
            `}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
            {tab.icon && <span className="mr-2">{tab.icon}</span>}

            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Tabs;