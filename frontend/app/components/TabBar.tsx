import React from 'react';

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabClick: (tab: string) => void;
  onTabClose?: (tab: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabClick, onTabClose }) => {
  return (
    <div className="relative w-full bg-gray-800 border-b border-gray-700">
      <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 whitespace-nowrap">
        {tabs.map((tab) => (
          <div
            key={tab}
            className={`flex items-center px-4 py-2 cursor-pointer border-r border-gray-700 min-w-[150px] max-w-[250px] ${
              activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            onClick={() => onTabClick(tab)}
          >
            <span className="truncate flex-1">{tab}</span>
            {onTabClose && (
              <button
                className="ml-2 text-gray-500 hover:text-white focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabBar; 