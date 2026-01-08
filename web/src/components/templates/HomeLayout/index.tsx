// src/components/templates/HomeLayout.tsx
import React from 'react';
import ProfileHeader from '../../organisms/ProfileHeader';
import TabNavigation from '../../organisms/TabNavigation';
import SearchBar from '../../molecules/SearchBar';

type TabType = 'chats' | 'groups' | 'splitwise';

interface User {
  id: string;
  name: string;
  avatar?: string;
  status?: string;
}

interface HomeLayoutProps {
  user: User;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onProfileClick: () => void;
  onSearch: (query: string) => void;
  chatBadge?: number;
  groupBadge?: number;
  splitwiseBadge?: number;
  sidebarContent: React.ReactNode;
  mainContent: React.ReactNode;
}

const HomeLayout: React.FC<HomeLayoutProps> = ({
  user,
  activeTab,
  onTabChange,
  onProfileClick,
  onSearch,
  chatBadge,
  groupBadge,
  splitwiseBadge,
  sidebarContent,
  mainContent
}) => {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-96 bg-white flex flex-col shadow-lg">
        {/* Profile Header */}
        <ProfileHeader user={user} onProfileClick={onProfileClick} />

        {/* Search Bar */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <SearchBar 
            placeholder="Search or start new chat" 
            onSearch={onSearch}
          />
        </div>

        {/* Tab Navigation */}
        <div className="px-3 py-2 bg-white border-b border-gray-200">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={onTabChange}
            chatBadge={chatBadge}
            groupBadge={groupBadge}
            splitwiseBadge={splitwiseBadge}
          />
        </div>

        {/* Dynamic Sidebar Content */}
        <div className="flex-1 overflow-hidden bg-white">
          {sidebarContent}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#e5ddd5]">
        {mainContent}
      </main>
    </div>
  );
};

export default HomeLayout;