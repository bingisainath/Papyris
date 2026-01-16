// src/pages/Home/index.tsx - COMPLETE WITH ALL INTEGRATIONS

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../app/AuthProvider';
import {
  Sidebar,
  ChatList,
  ChatWindow,
  ProfileModal,
  CreateExpenseModal,
  SearchUserModal,
  CreateGroupModal,
  EmptyState,
} from '../../components/organisms';
import {
  useSendMessage,
  useConversationRoom
} from '../../hooks/useWebSocket';
import {
  fetchConversations,
  fetchMessages,
  createDirectConversation,
  createGroupConversation,
} from '../../redux/actions/chatActions';
import type { AppDispatch, RootState } from '../../redux/store';
import { selectOnlineUsers } from '../../redux/slices/websocketSlice';
import { clearUnreadCount } from '../../redux/slices/chatSlice';
import { chatService } from '../../services/chat.service';

// import { selectActiveConversation } from '../../redux/slices/chatSlice';

const Home: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Auth
  const { user: currentUser, isAuthenticated, logout: authLogout } = useAuth();

  // Redux state
  const conversations = useSelector((state: RootState) => state.chat?.conversations || []);
  const messages = useSelector((state: RootState) =>
    params.conversationId ? state.chat?.messages?.[params.conversationId] || [] : []
  );
  const isLoading = useSelector((state: RootState) => state.chat?.isLoading || false);
  const messagesLoading = useSelector((state: RootState) => state.chat?.messagesLoading || false);

  const onlineUsers = useSelector(selectOnlineUsers);

  // WebSocket
  const { sendMessage } = useSendMessage();
  const activeConversationId = params.conversationId;
  useConversationRoom(activeConversationId);

  // Get other user ID from conversation
  const getOtherUserId = (conversation: any) => {
    if (conversation.isGroup) return null;
    return conversation.members?.find((id: string) => id !== currentUserId);
  };

  // Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchUserModal, setShowSearchUserModal] = useState(false);     // ✅ NEW
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);  // ✅ NEW

  // Active route
  const activeRoute = ['chat', 'groups', 'expenses', 'settings'].includes(location.pathname.split('/')[1])
    ? location.pathname.split('/')[1]
    : 'chat';

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('⚠️ Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Load conversations
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      console.log('📥 Loading conversations...');
      dispatch(fetchConversations());
    }
  }, [dispatch, isAuthenticated, currentUser]);

  // Load messages
  useEffect(() => {
    if (activeConversationId && isAuthenticated) {
      console.log('📥 Loading messages for:', activeConversationId);
      dispatch(fetchMessages(activeConversationId));
    }
  }, [activeConversationId, dispatch, isAuthenticated]);

  // Get active conversations
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // const activeConversation = useSelector(selectActiveConversation);
  const currentUserId = localStorage.getItem('userId') || '';

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA; // Most recent first
    });
  }, [conversations]);

  const otherUserId = activeConversation ? getOtherUserId(activeConversation) : null;
  const isOnline = otherUserId ? onlineUsers.includes(otherUserId) : false;

  // ✅ NEW: Handler for SearchUserModal
  const handleSelectUser = async (user: any) => {
    setCreatingConversation(true);

    try {

      if (!user || !user.id) {
        console.error('Invalid user:', user);
        alert('Invalid user selected');
        return;
      }

      console.log('Creating DM with user:', user.id);

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
        alert('Failed to create conversation');
      }
    } catch (error) {
      console.error('Error creating DM:', error);
      alert('Failed to create conversation');
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
      // TODO: Upload avatar if provided
      let avatarUrl = '';
      if (data.avatar) {
        console.log('Avatar upload coming soon');
        // avatarUrl = await uploadAvatar(data.avatar);
      }

      // Create group
      const result = await dispatch(createGroupConversation(data.name, data.memberIds));

      if (result.success && result.conversationId) {
        setShowCreateGroupModal(false);
        // Refresh conversations
        await dispatch(fetchConversations());
        navigate(`/chat/${result.conversationId}`);
      } else {
        alert(`Failed to create group: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error creating group:', error);
      alert(`Failed to create group: ${error.message}`);
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  // const handleSelectConversation = (id: string) => {

  //   console.log('👆 User clicked conversation:', id.substring(0, 8));

  //   // Get conversation
  //   const conversation = conversations.find(c => c.id === id);

  //   // Clear unread count if any
  //   if (conversation && conversation.unreadCount > 0) {
  //     console.log(`🧹 Clearing ${conversation.unreadCount} unread messages`);
  //     dispatch(clearUnreadCount(id));
  //   }

  //   navigate(`/chat/${id}`);
  // };

  const handleSelectConversation = async (id: string) => {
    console.log('👆 User clicked conversation:', id.substring(0, 8));

    // Get conversation
    const conversation = conversations.find(c => c.id === id);

    // ✅ Mark as read on server
    if (conversation && conversation.unreadCount > 0) {
      console.log(`🧹 Marking ${conversation.unreadCount} messages as read on server`);

      // Clear in Redux immediately for instant UI update
      dispatch(clearUnreadCount(id));

      // ✅ WAIT for server to mark as read, THEN fetch
      try {
        const result = await chatService.markConversationRead(id);

        if (result.success) {
          console.log('✅ Server marked as read, now fetching updated conversations');
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

  const handleSendMessage = (text: string, file?: File) => {
    if (!activeConversationId) return;

    if (file) {
      alert('File upload coming soon!');
      return;
    }

    sendMessage(activeConversationId, text);
  };

  const handleCreateExpense = (data: any) => {
    console.log('Create expense:', data);
    alert('Expense feature coming soon!');
    setShowCreateExpenseModal(false);
  };

  const handleUpdateProfile = (data: any) => {
    console.log('Update profile:', data);
    alert('Profile update coming soon!');
    setShowProfileModal(false);
  };

  const handleLogout = () => {
    authLogout();
    navigate('/login');
  };

  // Loading state
  if (!currentUser && isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-muted-50 to-primary-50/20">
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
    <div className="flex h-screen bg-gradient-to-br from-muted-50 to-primary-50/20 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 hidden md:block">
        <Sidebar
          user={{
            id: currentUser.id,
            name: currentUser.username || currentUser.email.split('@')[0],
            username: currentUser.username || currentUser.email,
            avatar: currentUser.avatar
          }}
          activeRoute={`/${activeRoute}`}
          unreadChats={conversations.filter(c => c.unreadCount && c.unreadCount > 0).length}
          pendingExpenses={0}
          onNavigate={handleNavigate}
          onProfileClick={() => setShowProfileModal(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* CHAT PAGE */}
        {activeRoute === 'chat' && (
          <>
            {/* Chat List */}
            {/* <div className="w-full md:w-96 flex-shrink-0 border-r border-muted-200 bg-white/80"> */}
            <div className={`w-full md:w-96 flex-shrink-0 border-r border-muted-200 bg-white/80 ${activeConversationId ? 'hidden md:block' : 'block'
              }`}>
              <ChatList
                conversations={sortedConversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={() => setShowSearchUserModal(true)}
                onNewGroup={() => setShowCreateGroupModal(true)}
                isLoading={isLoading}
              />
            </div>

            {/* Chat Window - Show on mobile when active, always show on desktop */}
            <div className={`flex-1 ${activeConversationId ? 'block' : 'hidden md:block'  // ✅ FIX: Show window when chat is active
              }`}>
              {activeConversation ? (
                <ChatWindow
                  conversationId={activeConversationId}
                  conversationName={activeConversation.name}
                  conversationAvatar={activeConversation.avatar}
                  isGroup={activeConversation.isGroup}
                  isOnline={isOnline}
                  messages={messages}
                  currentUserId={currentUser.id}
                  onSendMessage={handleSendMessage}
                  onTyping={(isTyping) => console.log('Typing:', isTyping)}
                  onBack={() => navigate('/chat')}  // ✅ FIX: Go back to list on mobile
                  isLoading={messagesLoading}
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
          <div className="flex-1">
            <GroupsPage
              groups={conversations.filter(c => c.isGroup)}
              onCreateGroup={() => setShowCreateGroupModal(true)}
              onOpenGroup={(id) => navigate(`/chat/${id}`)}
            />
          </div>
        )}

        {/* EXPENSES PAGE */}
        {activeRoute === 'expenses' && (
          <div className="flex-1">
            <div className="p-8 h-full overflow-auto">
              <div className="max-w-4xl mx-auto text-center py-20">
                <h2 className="text-3xl font-bold text-muted-900 mb-4">
                  Expenses Feature Coming Soon! 💰
                </h2>
                <p className="text-muted-500">
                  We're working on bringing bill splitting to Papyris.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS PAGE */}
        {activeRoute === 'settings' && (
          <div className="flex-1">
            <SettingsPage user={currentUser} />
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav activeRoute={activeRoute} onNavigate={handleNavigate} />

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

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={{
            id: currentUser.id,
            name: currentUser.username || currentUser.email.split('@')[0],
            username: currentUser.username || currentUser.email,
            email: currentUser.email,
            avatar: currentUser.avatar,
            bio: '',
            joinedDate: new Date(currentUser.created_at).toLocaleDateString()
          }}
          stats={{
            totalChats: conversations.filter(c => !c.isGroup).length,
            totalGroups: conversations.filter(c => c.isGroup).length,
            totalExpenses: 0,
            totalSettled: 0
          }}
          onUpdateProfile={handleUpdateProfile}
        />
      )}

      {/* Expense Modal */}
      {showCreateExpenseModal && (
        <CreateExpenseModal
          isOpen={showCreateExpenseModal}
          onClose={() => setShowCreateExpenseModal(false)}
          onCreateExpense={handleCreateExpense}
          groupMembers={[]}
          currentUserId={currentUser.id}
        />
      )}

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
  );
};

// ... Keep all other components (GroupsPage, SettingsPage, MobileBottomNav, EmptyState) same



// Welcome Screen Component
const WelcomeScreen: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center px-8">
      <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center shadow-card animate-scale-in">
        <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-muted-900 mb-3">Papyris Web</h2>
      <p className="text-muted-500 max-w-md leading-relaxed mb-4">
        Send and receive messages without keeping your phone online.
        <br />
        Use Papyris on multiple devices at the same time.
      </p>
      <p className="text-sm text-primary-600 font-medium">
        ← Select a conversation to start chatting
      </p>
    </div>
  </div>
);

// Groups Page Component  
const GroupsPage: React.FC<{
  groups: any[];
  onCreateGroup: () => void;
  onOpenGroup: (id: string) => void;
}> = ({ groups, onCreateGroup, onOpenGroup }) => (
  <div className="p-8 h-full overflow-auto">
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-muted-900">Groups</h1>
          <p className="text-muted-500 mt-1">Manage your group conversations</p>
        </div>
        <button
          onClick={onCreateGroup}
          className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-card hover:shadow-elevated transition-all hover:scale-105 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Group
        </button>
      </div>

      {groups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(group => (
            <div
              key={group.id}
              className="card p-6 hover:shadow-elevated transition-all cursor-pointer hover:scale-[1.02]"
              onClick={() => onOpenGroup(group.id)}
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
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
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-secondary-100 to-primary-100 flex items-center justify-center">
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



// Settings Page Component
const SettingsPage: React.FC<{ user: any }> = ({ user }) => (
  <div className="p-8 h-full overflow-auto">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-muted-900 mb-8">Settings</h1>

      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-muted-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Account
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b border-muted-100">
              <span className="text-muted-700">Username</span>
              <span className="text-muted-900 font-medium">{user.username || user.email.split('@')[0]}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-muted-100">
              <span className="text-muted-700">Email</span>
              <span className="text-muted-900 font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-muted-700">Joined</span>
              <span className="text-muted-500 text-sm">{new Date(user.created_at).toLocaleDateString()}</span>
            </div>
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
        ? 'text-primary-600 bg-primary-50 scale-105'
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
        ? 'text-primary-600 bg-primary-50 scale-105'
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
        ? 'text-primary-600 bg-primary-50 scale-105'
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
        ? 'text-primary-600 bg-primary-50 scale-105'
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