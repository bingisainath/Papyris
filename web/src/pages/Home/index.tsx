// src/pages/Home/index.tsx - COMPLETE WITH ALL INTEGRATIONS

import GroupAddIcon from '../../components/atoms/GroupAddIcon';
import { isMuted } from '../../components/molecules/ChatListItem';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../app/AuthProvider';
import {
  Sidebar,
  ChatList,
  ChatWindow,
  ProfileModal,
  SearchUserModal,
  CreateGroupModal,
  EmptyState,
} from '../../components/organisms';
import {
  fetchConversations,
  fetchMessages,
  createDirectConversation,
  createGroupConversation,
  togglePinConversation,
  archiveConversation,
} from '../../redux/actions/chatActions';
import type { AppDispatch, RootState } from '../../redux/store';
import { selectOnlineUsers } from '../../redux/slices/websocketSlice';
import { clearUnreadCount } from '../../redux/slices/chatSlice';
import { chatService } from '../../services/chat.service';
import { NAVIGATE_EVENT } from '../../utils/events';
import { getNotificationStatus, setNotificationsEnabled } from '../../utils/notifications';
import type { NotificationStatus } from '../../utils/notifications';
import { mediaService } from '../../services/media.service';
import { parseApiError } from '../../utils/apiError';
import { toast } from 'react-toastify';
import ExpensesPage from '../../components/expenses/ExpensesPage';
import ConnectionBanner from '../../components/molecules/ConnectionBanner';
import { ReceiptScanningSettings, StoreDiscountSettings } from '../../components/expenses/ExpenseSettingsSections';
import SessionsSettings from '../../components/organisms/SessionsSettings';
import EncryptionSettings from '../../components/organisms/EncryptionSettings';
import BackupSettings from '../../components/organisms/BackupSettings';
import LogoutWarning, { logoutRisk } from '../../components/organisms/LogoutWarning';
import type { LogoutRisk } from '../../components/organisms/LogoutWarning';

// Stable empty value for selectors: returning a new [] each time makes components re-render
const EMPTY: never[] = [];

// import { selectActiveConversation } from '../../redux/slices/chatSlice';

const Home: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Auth
  const { user: currentUser, isAuthenticated, logout: authLogout } = useAuth();

  // Redux state
  const conversations = useSelector((state: RootState) => state.chat?.conversations ?? EMPTY);
  const isLoading = useSelector((state: RootState) => state.chat?.isLoading || false);

  const onlineUsers = useSelector(selectOnlineUsers);

  // Room join/leave is handled by ChatWindow
  const activeConversationId = params.conversationId;

  // Get other user ID from conversation
  const getOtherUserId = (conversation: any) => {
    if (conversation.isGroup) return null;
    return conversation.members?.find((id: string) => id !== currentUserId);
  };

  // Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchUserModal, setShowSearchUserModal] = useState(false);     // ✅ NEW
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);  // ✅ NEW

  // Active route
  // Unread count in the browser tab title, e.g. "(3) Papyris"
  // Muted and archived chats don't count (like WhatsApp)
  const counted = conversations.filter(c => !c.isArchived && !isMuted(c.mutedUntil));
  const totalUnread = counted.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Papyris` : 'Papyris';
  }, [totalUnread]);
  useEffect(() => () => { document.title = 'Papyris'; }, []);

  // Lets toasts and other non-component code open a route (e.g. "added to group" toast)
  useEffect(() => {
    const onNavigate = (e: Event) => navigate((e as CustomEvent<string>).detail);
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(NAVIGATE_EVENT, onNavigate);
  }, [navigate]);

  const activeRoute = ['chat', 'groups', 'expenses', 'settings'].includes(location.pathname.split('/')[1])
    ? location.pathname.split('/')[1]
    : 'chat';

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Load conversations
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      dispatch(fetchConversations());
    }
  }, [dispatch, isAuthenticated, currentUser]);

  // Load messages
  useEffect(() => {
    if (activeConversationId && isAuthenticated) {
      dispatch(fetchMessages(activeConversationId));
    }
  }, [activeConversationId, dispatch, isAuthenticated]);

  // Get active conversations
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // const activeConversation = useSelector(selectActiveConversation);
  const currentUserId = localStorage.getItem('userId') || '';

  const sortedConversations = useMemo(() => {
    const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);
    // Pinned chats first (most recently pinned on top), then by latest message
    return [...conversations].sort((a, b) =>
      Number(!!b.isPinned) - Number(!!a.isPinned) ||
      time(b.pinnedAt) - time(a.pinnedAt) ||
      time(b.lastMessageTime) - time(a.lastMessageTime)
    );
  }, [conversations]);

  const otherUserId = activeConversation ? getOtherUserId(activeConversation) : null;
  const isOnline = otherUserId ? onlineUsers.includes(otherUserId) : false;

  // ✅ NEW: Handler for SearchUserModal
  const handleSelectUser = async (user: any) => {
    setCreatingConversation(true);

    try {

      if (!user || !user.id) {
        console.error('Invalid user:', user);
        toast.error('Invalid user selected');
        return;
      }


      // Check if DM already exists
      const existingDM = conversations.find(c =>
        !c.isGroup && c.members?.includes(user.id)
      );

      if (existingDM) {
        navigate(`/chat/${existingDM.id}`);
        return;
      }

      // Create new DM
      const result = await dispatch(createDirectConversation(user.id));

      if (result.success && result.conversationId) {
        // Refresh conversations
        await dispatch(fetchConversations());
        navigate(`/chat/${result.conversationId}`);
      } else {
        toast.error('Failed to create conversation');
      }
    } catch (error) {
      console.error('Error creating DM:', error);
      toast.error('Failed to create conversation');
    } finally {
      setCreatingConversation(false);
    }
  };

  // ✅ UPDATED: Handler for CreateGroupModal
  const handleCreateGroup = async (data: {
    name: string;
    description: string;
    memberIds: string[];
    avatar?: File;
  }) => {
    setCreatingConversation(true);

    try {
      let avatarUrl: string | undefined;
      if (data.avatar) {
        try {
          avatarUrl = (await mediaService.upload(data.avatar)).url;
        } catch (error) {
          toast.error(`Group photo not uploaded: ${parseApiError(error)}`);
        }
      }

      // Create group
      const result = await dispatch(createGroupConversation(data.name, data.memberIds, {
        description: data.description?.trim() || undefined,
        avatar_url: avatarUrl,
      }));

      if (result.success && result.conversationId) {
        setShowCreateGroupModal(false);
        // Refresh conversations
        await dispatch(fetchConversations());
        navigate(`/chat/${result.conversationId}`);
      } else {
        toast.error(`Failed to create group: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast.error(`Failed to create group: ${parseApiError(error)}`);
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleSelectConversation = async (id: string) => {

    // Get conversation
    const conversation = conversations.find(c => c.id === id);

    // ✅ Mark as read on server
    if (conversation && (conversation.unreadCount ?? 0) > 0) {

      // Clear in Redux immediately for instant UI update
      dispatch(clearUnreadCount(id));

      // ✅ WAIT for server to mark as read, THEN fetch
      try {
        const result = await chatService.markConversationRead(id);

        if (result.success) {
          // Now the server has updated counts, safe to fetch
          await dispatch(fetchConversations());
        } else {
          console.error('❌ Failed to mark as read on server:', result.error);
        }
      } catch (error) {
        console.error('❌ Error marking as read:', error);
      }
    }

    // Navigate
    navigate(`/chat/${id}`);
  };

  // Logging out of the last signed-in device makes encrypted chats unreadable: warn first
  const [logoutWarning, setLogoutWarning] = useState<LogoutRisk | null>(null);
  const logoutNow = async () => {
    setLogoutWarning(null);
    await authLogout();
    navigate('/login');
  };
  const handleLogout = async () => {
    const risk = await logoutRisk();
    if (risk.lastDevice) setLogoutWarning(risk);
    else logoutNow();
  };

  // Loading state
  if (!currentUser && isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-muted-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-muted-50 overflow-hidden">
      <ConnectionBanner />
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 hidden md:block">
        <Sidebar
          user={{
            id: currentUser.id,
            name: currentUser.name || currentUser.username || currentUser.email.split('@')[0],
            username: currentUser.username || currentUser.email,
            avatar: currentUser.avatar
          }}
          activeRoute={`/${activeRoute}`}
          unreadChats={counted.filter(c => c.unreadCount && c.unreadCount > 0).length}
          pendingExpenses={0}
          onNavigate={handleNavigate}
          onProfileClick={() => setShowProfileModal(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* CHAT PAGE */}
        {activeRoute === 'chat' && (
          <>
            {/* Chat List */}
            {/* <div className="w-full md:w-96 flex-shrink-0 border-r border-muted-200 bg-white/80"> */}
            <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-muted-200 bg-white/80 pb-16 md:pb-0 ${activeConversationId ? 'hidden md:block' : 'block'
              }`}>
              <ChatList
                conversations={sortedConversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onTogglePin={(id) => dispatch(togglePinConversation(id))}
                onToggleArchive={(id, archived) => dispatch(archiveConversation(id, archived))}
                onOpenMessage={(id, messageId) => navigate(`/chat/${id}?msg=${messageId}`)}
                currentUserId={currentUser?.id}
                onNewChat={() => setShowSearchUserModal(true)}
                onNewGroup={() => setShowCreateGroupModal(true)}
                isLoading={isLoading}
              />
            </div>

            {/* Chat Window - Show on mobile when active, always show on desktop */}
            <div className={`flex-1 min-w-0 ${activeConversationId ? 'block' : 'hidden md:block'  // ✅ FIX: Show window when chat is active
              }`}>
              {activeConversation ? (
                <ChatWindow
                  conversationId={activeConversation.id}
                  conversationName={activeConversation.name}
                  conversationAvatar={activeConversation.avatar}
                  isGroup={activeConversation.isGroup}
                  memberCount={activeConversation.members?.length}
                  isOnline={isOnline}
                  currentUserId={currentUser.id}
                  onBack={() => navigate('/chat')}  // ✅ FIX: Go back to list on mobile
                />
              ) : (
                <EmptyState
                  onNewChat={() => setShowSearchUserModal(true)}
                  onNewGroup={() => setShowCreateGroupModal(true)}
                />
              )}
            </div>
          </>
        )}

        {/* GROUPS PAGE */}
        {activeRoute === 'groups' && (
          <div className="flex-1 min-w-0 pb-16 md:pb-0">
            <GroupsPage
              groups={conversations.filter(c => c.isGroup)}
              onCreateGroup={() => setShowCreateGroupModal(true)}
              onOpenGroup={(id) => navigate(`/chat/${id}`)}
            />
          </div>
        )}

        {/* EXPENSES PAGE */}
        {activeRoute === 'expenses' && (
          <div className="flex-1 min-w-0 pb-16 md:pb-0">
            <ExpensesPage conversations={sortedConversations} currentUserId={currentUser.id} />
          </div>
        )}

        {/* SETTINGS PAGE */}
        {activeRoute === 'settings' && (
          <div className="flex-1 min-w-0 pb-16 md:pb-0">
            <SettingsPage
              user={currentUser}
              onEditProfile={() => setShowProfileModal(true)}
              onLogout={handleLogout}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom nav (hidden inside an open chat, like other messengers) */}
      {!(activeRoute === 'chat' && activeConversationId) && (
        <MobileBottomNav activeRoute={activeRoute} onNavigate={handleNavigate} />
      )}

      {/* ✅ NEW: SearchUserModal */}
      <SearchUserModal
        isOpen={showSearchUserModal}
        onClose={() => setShowSearchUserModal(false)}
        onSelectUser={handleSelectUser}
        currentUserId={currentUser.id}
      />

      {/* ✅ UPDATED: CreateGroupModal with debouncing */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
        currentUserId={currentUser.id}
        isLoading={creatingConversation}
      />

      {/* Profile */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onChanged={() => dispatch(fetchConversations())} // our name/photo shows in chats
      />

      {/* ✅ NEW: Loading overlay */}
      {creatingConversation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <p className="text-muted-900 font-medium">Creating conversation...</p>
          </div>
        </div>
      )}
      </div>
      {logoutWarning && (
        <LogoutWarning
          risk={logoutWarning}
          onCancel={() => setLogoutWarning(null)}
          onConfirm={logoutNow}
          onOpenSettings={() => { setLogoutWarning(null); navigate('/settings'); }}
        />
      )}
    </div>
  );
};

// ... Keep all other components (GroupsPage, SettingsPage, MobileBottomNav, EmptyState) same



// Groups Page Component  
const GroupsPage: React.FC<{
  groups: any[];
  onCreateGroup: () => void;
  onOpenGroup: (id: string) => void;
}> = ({ groups, onCreateGroup, onOpenGroup }) => (
  <div className="p-4 sm:p-8 h-full overflow-auto">
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-muted-900">Groups</h1>
          <p className="text-muted-500 mt-1">Manage your group conversations</p>
        </div>
        <button
          onClick={onCreateGroup}
          className="flex-shrink-0 whitespace-nowrap px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-card hover:shadow-elevated transition-all flex items-center gap-2"
        >
          <GroupAddIcon size={20} />
          Create Group
        </button>
      </div>

      {groups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(group => (
            <div
              key={group.id}
              className="card p-6 hover:shadow-elevated transition-all cursor-pointer"
              onClick={() => onOpenGroup(group.id)}
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {group.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-muted-900 truncate">
                      {group.name}
                    </h3>
                    {group.unreadCount > 0 && (
                      <span className="px-2 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
                        {group.unreadCount}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-500 mb-3 truncate">
                    {group.lastMessage || 'No messages yet'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {group.members?.length || 0} members
                    </span>
                    {group.lastMessageTime && (
                      <span>• {new Date(group.lastMessageTime).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-secondary-100 flex items-center justify-center">
            <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-muted-900 mb-2">No Groups Yet</h2>
          <p className="text-muted-500 mb-6">Create your first group to get started!</p>
        </div>
      )}
    </div>
  </div>
);



// Desktop notification preference (Settings)
const NotificationSettings: React.FC = () => {
  const [status, setStatus] = useState<NotificationStatus>(getNotificationStatus);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      setStatus(await setNotificationsEnabled(status !== 'on'));
    } finally {
      setBusy(false);
    }
  };

  const description: Record<NotificationStatus, string> = {
    on: 'You get a desktop notification for new messages when Papyris is in the background.',
    off: 'Turn on to get a desktop notification for new messages when Papyris is in the background.',
    denied: 'Notifications are blocked for this site. Allow them in your browser\'s site settings, then reload.',
    unsupported: 'This browser does not support desktop notifications.',
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-muted-900">Notifications</h2>
          <p className="text-sm text-muted-500">{description[status]}</p>
        </div>
        {(status === 'on' || status === 'off') && (
          <button
            role="switch"
            aria-checked={status === 'on'}
            aria-label="Desktop notifications"
            onClick={toggle}
            disabled={busy}
            className={`relative flex-shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
              status === 'on' ? 'bg-primary-600' : 'bg-muted-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                status === 'on' ? 'translate-x-5' : ''
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
};

// Settings Page Component
const SettingsPage: React.FC<{
  user: any;
  onEditProfile: () => void;
  onLogout: () => void;
}> = ({ user, onEditProfile, onLogout }) => (
  <div className="p-4 sm:p-8 h-full overflow-auto">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-muted-900 mb-6 sm:mb-8">Settings</h1>

      <div className="space-y-6">
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-muted-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account
            </h2>
            <button
              onClick={onEditProfile}
              className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
            >
              Edit profile
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center gap-4 py-3 border-b border-muted-100">
              <span className="text-muted-700">Username</span>
              <span className="text-muted-900 font-medium truncate">{user.username || user.email.split('@')[0]}</span>
            </div>
            <div className="flex justify-between items-center gap-4 py-3 border-b border-muted-100">
              <span className="text-muted-700">Email</span>
              <span className="text-muted-900 font-medium truncate">{user.email}</span>
            </div>
            <div className="flex justify-between items-center gap-4 py-3">
              <span className="text-muted-700">Joined</span>
              <span className="text-muted-500 text-sm">{new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <EncryptionSettings />

        <SessionsSettings />

        <BackupSettings userId={user.id} />

        <NotificationSettings />

        <ReceiptScanningSettings />

        <StoreDiscountSettings />

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-muted-900">Log out</h2>
              <p className="text-sm text-muted-500">Sign out of Papyris on this device.</p>
            </div>
            <button
              onClick={onLogout}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Mobile Bottom Navigation
const MobileBottomNav: React.FC<{ activeRoute: string; onNavigate: (path: string) => void }> = ({
  activeRoute,
  onNavigate
}) => (
  // <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-muted-200 px-2 py-2 flex justify-around z-50 shadow-elevated">
  <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-muted-200 px-2 py-2 flex justify-around z-50 shadow-lg">
    <button
      onClick={() => onNavigate('/chat')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${activeRoute === 'chat'
        ? 'text-primary-600 bg-primary-50'
        : 'text-muted-600 hover:bg-muted-50'
        }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <span className="text-xs font-medium">Chats</span>
    </button>

    <button
      onClick={() => onNavigate('/groups')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${activeRoute === 'groups'
        ? 'text-primary-600 bg-primary-50'
        : 'text-muted-600 hover:bg-muted-50'
        }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span className="text-xs font-medium">Groups</span>
    </button>

    <button
      onClick={() => onNavigate('/expenses')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${activeRoute === 'expenses'
        ? 'text-primary-600 bg-primary-50'
        : 'text-muted-600 hover:bg-muted-50'
        }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      <span className="text-xs font-medium">Expenses</span>
    </button>

    <button
      onClick={() => onNavigate('/settings')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${activeRoute === 'settings'
        ? 'text-primary-600 bg-primary-50'
        : 'text-muted-600 hover:bg-muted-50'
        }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="text-xs font-medium">Settings</span>
    </button>
  </div>
);

export default Home;