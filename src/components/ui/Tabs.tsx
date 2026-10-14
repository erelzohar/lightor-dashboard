import React, { useEffect, useState } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger } from './segmented-tabs';

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

/**
 * A page's row of section tabs (the settings page), drawn by the segmented
 * tabs since LT-313 — same props as before.
 */
const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab, onChange }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  // The page may move the tab itself (a tab that no longer applies).
  useEffect(() => { if (defaultTab) setActiveTab(defaultTab); }, [defaultTab]);

  return (
    <TabsRoot
      value={activeTab}
      onValueChange={(tabId) => {
        setActiveTab(tabId);
        onChange?.(tabId);
      }}
      className="flex justify-center w-full"
    >
      {/* On a narrow phone the row scrolls sideways instead of clipping its
          last tab (LT-199 added a fourth), and the icons wait for `sm`. The
          row itself is not centred: a centred row that overflows cuts off its
          start, out of scroll reach; the outer flex centres it when it fits. */}
      {/* A phone shares the width out evenly (four tabs fit at 390px, LT-316). */}
      <TabsList size="lg" className="w-full sm:w-auto max-w-full overflow-x-auto scrollbar-hide gap-1">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="flex-1 sm:flex-none px-2 sm:px-4 text-sm sm:text-[0.9375rem]">
            {tab.icon && <span className="hidden sm:inline-flex opacity-80">{tab.icon}</span>}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  );
};

export default Tabs;
