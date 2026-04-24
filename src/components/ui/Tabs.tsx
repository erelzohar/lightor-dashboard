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
    <div className="flex justify-center w-full">
      <div className="flex items-center justify-center p-1.5 bg-gray-100 dark:bg-dark-bg rounded-2xl overflow-hidden hide-scrollbar gap-1 sm:gap-2 shadow-inner border border-gray-200/60 dark:border-gray-700/60">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                relative flex items-center justify-center px-2.5 py-2.5 rounded-2xl whitespace-nowrap
                transition-all duration-300 outline-none
                ${isActive
                  ? 'text-primary dark:text-primary-dark font-semibold'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="elegant-tab-indicator"
                  className="absolute inset-0 bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700/80"
                  initial={false}
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center text-[15px] tracking-wide">
                {tab.icon && <span className="m-1.5 opacity-80">{tab.icon}</span>}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Tabs;