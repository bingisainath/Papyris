// src/components/organisms/Sidebar.tsx
import React from 'react';
import { Avatar, Badge, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';

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
  // Add badges to nav items
  const itemsWithBadges = navigationItems.map(item => {
    if (item.id === 'chats' && unreadChats > 0) {
      return { ...item, badge: unreadChats };
    }
    if (item.id === 'expenses' && pendingExpenses > 0) {
      return { ...item, badge: pendingExpenses };
    }
    return item;
  });

  return (
    <div className={`
      flex flex-col h-full
      bg-gradient-to-b from-white to-primary-50/30
      border-r-2 border-primary-100
      shadow-soft
      ${className}
    `}>
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-primary-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-700 to-secondary-400 flex items-center justify-center shadow-card">
            <Typography variant="h5" weight="bold" className="text-white">
              P
            </Typography>
          </div>
          <div>
            <Typography variant="h5" weight="bold" className="text-primary-700">
              Papyris
            </Typography>
            <Typography variant="caption" className="text-muted-500">
              Chat & Split
            </Typography>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {itemsWithBadges.map((item) => {
          const isActive = activeRoute === item.path || activeRoute.startsWith(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.path)}
              className={`
                w-full flex items-center justify-between gap-3
                px-4 py-3 rounded-xl
                transition-all duration-200
                ${isActive 
                  ? 'bg-gradient-to-r from-primary-50 to-secondary-50 border-l-4 border-primary-600 text-primary-700 shadow-soft' 
                  : 'text-muted-600 hover:bg-primary-50/50 hover:text-primary-600'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Icon 
                  name={item.icon} 
                  size={22} 
                  className={isActive ? 'text-primary-600' : 'text-muted-500'}
                />
                <Typography 
                  variant="body1" 
                  weight={isActive ? 'semibold' : 'medium'}
                  className={isActive ? 'text-primary-700' : 'text-muted-700'}
                >
                  {item.label}
                </Typography>
              </div>
              
              {item.badge && item.badge > 0 && (
                <Badge 
                  count={item.badge} 
                  variant="primary" 
                  size="sm" 
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* User profile section */}
      <div className="px-3 py-4 border-t border-primary-100">
        {/* Profile button */}
        <button
          onClick={onProfileClick}
          className="
            w-full flex items-center gap-3
            p-3 rounded-xl
            hover:bg-primary-50
            transition-all duration-200
            group
          "
        >
          <Avatar
            src={user.avatar}
            alt={user.name}
            size="md"
            className="ring-2 ring-white group-hover:ring-primary-200 transition-all"
          />
          <div className="flex-1 min-w-0 text-left">
            <Typography variant="body1" weight="semibold" className="text-muted-900 truncate">
              {user.name}
            </Typography>
            {user.username && (
              <Typography variant="caption" className="text-muted-500 truncate">
                @{user.username}
              </Typography>
            )}
          </div>
          <Icon name="dots" size={18} className="text-muted-400 group-hover:text-primary-600 transition-colors" />
        </button>

        {/* Logout button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="
              w-full flex items-center gap-3
              px-4 py-2.5 mt-2 rounded-xl
              text-accent-600 hover:bg-accent-50
              transition-all duration-200
            "
          >
            <Icon name="logout" size={18} />
            <Typography variant="body2" weight="medium">
              Logout
            </Typography>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;