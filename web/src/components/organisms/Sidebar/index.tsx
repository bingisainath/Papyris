// src/components/organisms/Sidebar.tsx
// Desktop navigation: a narrow purple rail with the logo, the four sections and you at the bottom.
import React from 'react';
import { LogOut, MessageSquareText, Settings, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '../../atoms';

const ICONS: Record<NavigationItem['icon'], LucideIcon> = { chat: MessageSquareText, users: Users, expense: Wallet, settings: Settings };

interface NavigationItem {
  id: string;
  label: string;
  icon: 'chat' | 'users' | 'expense' | 'settings';
  path: string;
  badge?: number;
}

interface SidebarProps {
  user: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
  };
  activeRoute: string;
  navigationItems?: NavigationItem[];
  unreadChats?: number;
  pendingExpenses?: number;
  onNavigate: (path: string) => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeRoute,
  navigationItems = [
    { id: 'chats', label: 'Chats', icon: 'chat', path: '/chat' },
    { id: 'groups', label: 'Groups', icon: 'users', path: '/groups' },
    { id: 'expenses', label: 'Expenses', icon: 'expense', path: '/expenses' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' }
  ],
  unreadChats = 0,
  pendingExpenses = 0,
  onNavigate,
  onProfileClick,
  onLogout,
  className = ''
}) => {
  const badgeFor = (id: string) => (id === 'chats' ? unreadChats : id === 'expenses' ? pendingExpenses : 0);

  return (
    <div className={`flex flex-col items-center h-full py-5 px-3 bg-primary-700 text-white ${className}`}>
      <button
        type="button"
        onClick={() => onNavigate('/chat')}
        title="Papyris"
        aria-label="Papyris home"
        className="w-[42px] h-[42px] mb-8 rounded-[13px] bg-white text-primary-700 font-display font-bold text-xl grid place-items-center shadow-[0_6px_18px_rgba(40,29,70,0.33)]"
      >
        P
      </button>

      <nav className="w-full flex flex-col gap-2" aria-label="Main">
        {navigationItems.map((item) => {
          const isActive = activeRoute === item.path || activeRoute.startsWith(item.path);
          const badge = badgeFor(item.id);
          const ItemIcon = ICONS[item.icon];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative w-full h-[58px] rounded-[14px] flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-primary-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isActive && <span className="absolute -left-3 w-[3px] h-6 rounded-r bg-white" aria-hidden />}
              <ItemIcon size={21} strokeWidth={1.8} />
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              {badge > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-primary-700 text-[10px] font-bold grid place-items-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
            className="w-11 h-11 rounded-[14px] grid place-items-center text-primary-200 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={19} />
          </button>
        )}
        <button
          type="button"
          onClick={onProfileClick}
          title={user.username ? `${user.name} (@${user.username})` : user.name}
          aria-label="Your profile"
          className="rounded-full ring-2 ring-white/20 hover:ring-white/60 transition-shadow"
        >
          <Avatar src={user.avatar} alt={user.name} size="md" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
