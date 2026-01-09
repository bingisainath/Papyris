// // src/pages/Home/index.tsx
// import React, { useState } from 'react';
// import { Sidebar, ChatList, ChatWindow, ExpensePanel } from '../../components/organisms';
// import { useAuth } from '../../app/AuthProvider';

// const Home: React.FC = () => {
//   const { user, logout } = useAuth();
//   const [activeRoute, setActiveRoute] = useState('/chat');
//   const [activeConversationId, setActiveConversationId] = useState<string | undefined>();

//   // Mock data - Replace with your Redux store data
//   const conversations = [
//     // Example:
//     // {
//     //   id: '1',
//     //   name: 'Alice Johnson',
//     //   avatar: undefined,
//     //   lastMessage: 'Hey, how are you?',
//     //   lastMessageTime: '10:30 AM',
//     //   unreadCount: 2,
//     //   isOnline: true,
//     //   isTyping: false,
//     //   isPinned: false,
//     //   isGroup: false
//     // }
//   ];

//   const messages = [
//     // Example:
//     // {
//     //   id: '1',
//     //   text: 'Hello!',
//     //   timestamp: '10:30 AM',
//     //   senderId: 'user1',
//     //   status: 'read'
//     // }
//   ];

//   const expenses = [
//     // Example expense data
//   ];

//   const handleSendMessage = (text: string, file?: File) => {
//     console.log('Send message:', text, file);
//     // TODO: Implement send message logic
//   };

//   if (!user) {
//     return null; // Or redirect to login
//   }

//   return (
//     <div className="flex h-screen bg-gradient-to-br from-muted-50 to-primary-50/20 overflow-hidden">
//       {/* NEW Sidebar - replaces old TabNavigation */}
//       <div className="w-64 flex-shrink-0 hidden md:block">
//         <Sidebar
//           user={{
//             id: user.id,
//             name: user.username || user.email || 'User',
//             username: user.username,
//             avatar: undefined
//           }}
//           activeRoute={activeRoute}
//           unreadChats={conversations.filter(c => c.unreadCount && c.unreadCount > 0).length}
//           pendingExpenses={0}
//           onNavigate={(path) => setActiveRoute(path)}
//           onProfileClick={() => console.log('Open profile')}
//           onLogout={logout}
//         />
//       </div>

//       {/* Main content area */}
//       <div className="flex-1 flex overflow-hidden">
//         {/* CHAT PAGE */}
//         {activeRoute === '/chat' && (
//           <>
//             {/* Chat List - replaces old SearchBar + conversation list */}
//             <div className="w-full md:w-96 flex-shrink-0 border-r border-muted-200 bg-white/80">
//               <ChatList
//                 conversations={conversations}
//                 activeConversationId={activeConversationId}
//                 onSelectConversation={setActiveConversationId}
//                 onNewChat={() => console.log('New chat')}
//                 onNewGroup={() => console.log('New group')}
//                 isLoading={false}
//               />
//             </div>

//             {/* Chat Window or Welcome Screen */}
//             <div className="flex-1 hidden md:block">
//               {activeConversationId ? (
//                 <ChatWindow
//                   conversationId={activeConversationId}
//                   conversationName={conversations.find(c => c.id === activeConversationId)?.name || 'Chat'}
//                   conversationAvatar={conversations.find(c => c.id === activeConversationId)?.avatar}
//                   isGroup={conversations.find(c => c.id === activeConversationId)?.isGroup}
//                   isOnline={conversations.find(c => c.id === activeConversationId)?.isOnline}
//                   messages={messages}
//                   currentUserId={user.id}
//                   onSendMessage={handleSendMessage}
//                   onTyping={(isTyping) => console.log('Typing:', isTyping)}
//                 />
//               ) : (
//                 // Welcome Screen - replaces old WelcomeScreen component
//                 <div className="flex items-center justify-center h-full">
//                   <div className="text-center px-8">
//                     <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center shadow-card">
//                       <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
//                       </svg>
//                     </div>
//                     <h2 className="text-3xl font-bold text-muted-900 mb-3">Papyris Web</h2>
//                     <p className="text-muted-500 max-w-md leading-relaxed">
//                       Send and receive messages without keeping your phone online.
//                       <br />
//                       Use Papyris on multiple devices at the same time.
//                     </p>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </>
//         )}

//         {/* GROUPS PAGE */}
//         {activeRoute === '/groups' && (
//           <div className="flex-1 p-8">
//             <div className="max-w-4xl mx-auto">
//               <div className="text-center py-20">
//                 <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-secondary-100 to-primary-100 flex items-center justify-center">
//                   <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//                   </svg>
//                 </div>
//                 <h2 className="text-2xl font-bold text-muted-900 mb-2">Groups</h2>
//                 <p className="text-muted-500 mb-6">Create and manage your group conversations</p>
//                 <button
//                   onClick={() => console.log('Create group')}
//                   className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-semibold shadow-card hover:shadow-elevated transition-all"
//                 >
//                   Create New Group
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* EXPENSES PAGE */}
//         {activeRoute === '/expenses' && (
//           <div className="flex-1">
//             <ExpensePanel
//               expenses={expenses}
//               currentUserId={user.id}
//               totalOwed={0}
//               totalOwe={0}
//               totalSettled={0}
//               onCreateExpense={() => console.log('Create expense')}
//               onSettleExpense={(id) => console.log('Settle:', id)}
//               onEditExpense={(id) => console.log('Edit:', id)}
//               onDeleteExpense={(id) => console.log('Delete:', id)}
//               isLoading={false}
//             />
//           </div>
//         )}

//         {/* SETTINGS PAGE */}
//         {activeRoute === '/settings' && (
//           <div className="flex-1 p-8">
//             <div className="max-w-4xl mx-auto">
//               <div className="text-center py-20">
//                 <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted-100 to-muted-200 flex items-center justify-center">
//                   <svg className="w-12 h-12 text-muted-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//                   </svg>
//                 </div>
//                 <h2 className="text-2xl font-bold text-muted-900 mb-2">Settings</h2>
//                 <p className="text-muted-500">Configure your Papyris preferences</p>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Mobile bottom navigation (optional) */}
//       <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-muted-200 px-4 py-2 flex justify-around">
//         <button
//           onClick={() => setActiveRoute('/chat')}
//           className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
//             activeRoute === '/chat' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
//           }`}
//         >
//           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
//           </svg>
//           <span className="text-xs font-medium">Chats</span>
//         </button>

//         <button
//           onClick={() => setActiveRoute('/groups')}
//           className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
//             activeRoute === '/groups' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
//           }`}
//         >
//           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//           </svg>
//           <span className="text-xs font-medium">Groups</span>
//         </button>

//         <button
//           onClick={() => setActiveRoute('/expenses')}
//           className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
//             activeRoute === '/expenses' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
//           }`}
//         >
//           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
//           </svg>
//           <span className="text-xs font-medium">Expenses</span>
//         </button>

//         <button
//           onClick={() => setActiveRoute('/settings')}
//           className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
//             activeRoute === '/settings' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
//           }`}
//         >
//           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//           </svg>
//           <span className="text-xs font-medium">Settings</span>
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Home;


// src/pages/Home/index.tsx - WITH REACT ROUTER INTEGRATION
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Sidebar, ChatList, ChatWindow, ExpensePanel, ProfileModal, CreateGroupModal, CreateExpenseModal } from '../../components/organisms';
import { useAuth } from '../../app/AuthProvider';

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Modals state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);

  // Determine active route from location
  const activeRoute = location.pathname.split('/')[1] || 'chat';
  const activeConversationId = params.conversationId;
  const activeGroupId = params.groupId;
  const activeExpenseId = params.expenseId;

  // Mock data - Replace with your Redux store data
  const conversations = [
    // Example data:
    // {
    //   id: '1',
    //   name: 'Alice Johnson',
    //   avatar: undefined,
    //   lastMessage: 'Hey, how are you?',
    //   lastMessageTime: '10:30 AM',
    //   unreadCount: 2,
    //   isOnline: true,
    //   isTyping: false,
    //   isPinned: false,
    //   isGroup: false
    // }
  ];

  const messages = [];
  const expenses = [];
  const availableUsers = []; // For creating groups

  // Handlers
  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleSendMessage = (text: string, file?: File) => {
    console.log('Send message:', text, file);
    // TODO: Implement with Redux action
  };

  const handleCreateGroup = (data: any) => {
    console.log('Create group:', data);
    // TODO: Implement with Redux action
    setShowCreateGroupModal(false);
  };

  const handleCreateExpense = (data: any) => {
    console.log('Create expense:', data);
    // TODO: Implement with Redux action
    setShowCreateExpenseModal(false);
  };

  const handleUpdateProfile = (data: any) => {
    console.log('Update profile:', data);
    // TODO: Implement with Redux action
    setShowProfileModal(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-muted-50 to-primary-50/20 overflow-hidden">
      {/* Sidebar - Desktop only */}
      <div className="w-64 flex-shrink-0 hidden md:block">
        <Sidebar
          user={{
            id: user.id,
            name: user.username || user.email || 'User',
            username: user.username,
            avatar: undefined
          }}
          activeRoute={`/${activeRoute}`}
          unreadChats={conversations.filter(c => c.unreadCount && c.unreadCount > 0).length}
          pendingExpenses={expenses.filter((e: any) => e.status === 'pending').length}
          onNavigate={handleNavigate}
          onProfileClick={() => setShowProfileModal(true)}
          onLogout={logout}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* CHAT PAGE */}
        {activeRoute === 'chat' && (
          <>
            {/* Chat List */}
            <div className="w-full md:w-96 flex-shrink-0 border-r border-muted-200 bg-white/80">
              <ChatList
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={() => console.log('New chat')}
                onNewGroup={() => setShowCreateGroupModal(true)}
                isLoading={false}
              />
            </div>

            {/* Chat Window or Welcome Screen */}
            <div className="flex-1 hidden md:block">
              {activeConversationId ? (
                <ChatWindow
                  conversationId={activeConversationId}
                  conversationName={conversations.find(c => c.id === activeConversationId)?.name || 'Chat'}
                  conversationAvatar={conversations.find(c => c.id === activeConversationId)?.avatar}
                  isGroup={conversations.find(c => c.id === activeConversationId)?.isGroup}
                  isOnline={conversations.find(c => c.id === activeConversationId)?.isOnline}
                  messages={messages}
                  currentUserId={user.id}
                  onSendMessage={handleSendMessage}
                  onTyping={(isTyping) => console.log('Typing:', isTyping)}
                  onBack={() => navigate('/chat')}
                />
              ) : (
                <WelcomeScreen />
              )}
            </div>
          </>
        )}

        {/* GROUPS PAGE */}
        {activeRoute === 'groups' && (
          <div className="flex-1">
            <GroupsPage onCreateGroup={() => setShowCreateGroupModal(true)} />
          </div>
        )}

        {/* EXPENSES PAGE */}
        {activeRoute === 'expenses' && (
          <div className="flex-1">
            <ExpensePanel
              expenses={expenses}
              currentUserId={user.id}
              totalOwed={0}
              totalOwe={0}
              totalSettled={0}
              onCreateExpense={() => setShowCreateExpenseModal(true)}
              onSettleExpense={(id) => console.log('Settle:', id)}
              onEditExpense={(id) => console.log('Edit:', id)}
              onDeleteExpense={(id) => console.log('Delete:', id)}
              isLoading={false}
            />
          </div>
        )}

        {/* SETTINGS PAGE */}
        {activeRoute === 'settings' && (
          <div className="flex-1">
            <SettingsPage user={user} />
          </div>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav activeRoute={activeRoute} onNavigate={handleNavigate} />

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={{
          id: user.id,
          name: user.username || user.email || 'User',
          username: user.username,
          email: user.email,
          avatar: undefined,
          bio: undefined,
          joinedDate: 'January 2026'
        }}
        stats={{
          totalChats: conversations.length,
          totalGroups: conversations.filter(c => c.isGroup).length,
          totalExpenses: expenses.length,
          totalSettled: 0
        }}
        onUpdateProfile={handleUpdateProfile}
      />

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
        availableUsers={availableUsers}
        currentUserId={user.id}
      />

      <CreateExpenseModal
        isOpen={showCreateExpenseModal}
        onClose={() => setShowCreateExpenseModal(false)}
        onCreateExpense={handleCreateExpense}
        groupMembers={[]} // Pass actual group members
        currentUserId={user.id}
      />
    </div>
  );
};

// Welcome Screen Component
const WelcomeScreen: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center px-8">
      <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center shadow-card">
        <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-muted-900 mb-3">Papyris Web</h2>
      <p className="text-muted-500 max-w-md leading-relaxed">
        Send and receive messages without keeping your phone online.
        <br />
        Use Papyris on multiple devices at the same time.
      </p>
    </div>
  </div>
);

// Groups Page Component
const GroupsPage: React.FC<{ onCreateGroup: () => void }> = ({ onCreateGroup }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="text-center py-20">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-secondary-100 to-primary-100 flex items-center justify-center">
          <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-muted-900 mb-2">Groups</h2>
        <p className="text-muted-500 mb-6">Create and manage your group conversations</p>
        <button
          onClick={onCreateGroup}
          className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-semibold shadow-card hover:shadow-elevated transition-all hover:scale-105"
        >
          Create New Group
        </button>
      </div>
    </div>
  </div>
);

// Settings Page Component
const SettingsPage: React.FC<{ user: any }> = ({ user }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-muted-900 mb-6">Settings</h1>
      
      <div className="space-y-6">
        {/* Account Section */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-muted-900 mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b border-muted-100">
              <span className="text-muted-700">Email</span>
              <span className="text-muted-900 font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-muted-100">
              <span className="text-muted-700">Username</span>
              <span className="text-muted-900 font-medium">{user.username || 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-muted-900 mb-4">Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between py-3 cursor-pointer">
              <span className="text-muted-700">Push Notifications</span>
              <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" defaultChecked />
            </label>
            <label className="flex items-center justify-between py-3 cursor-pointer border-t border-muted-100">
              <span className="text-muted-700">Email Notifications</span>
              <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" defaultChecked />
            </label>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-muted-900 mb-4">Privacy</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between py-3 cursor-pointer">
              <span className="text-muted-700">Show Online Status</span>
              <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" defaultChecked />
            </label>
            <label className="flex items-center justify-between py-3 cursor-pointer border-t border-muted-100">
              <span className="text-muted-700">Read Receipts</span>
              <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Mobile Bottom Navigation Component
const MobileBottomNav: React.FC<{ activeRoute: string; onNavigate: (path: string) => void }> = ({ 
  activeRoute, 
  onNavigate 
}) => (
  <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-muted-200 px-4 py-2 flex justify-around z-50">
    <button
      onClick={() => onNavigate('/chat')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
        activeRoute === 'chat' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
      }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <span className="text-xs font-medium">Chats</span>
    </button>

    <button
      onClick={() => onNavigate('/groups')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
        activeRoute === 'groups' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
      }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span className="text-xs font-medium">Groups</span>
    </button>

    <button
      onClick={() => onNavigate('/expenses')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
        activeRoute === 'expenses' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
      }`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      <span className="text-xs font-medium">Expenses</span>
    </button>

    <button
      onClick={() => onNavigate('/settings')}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
        activeRoute === 'settings' ? 'text-primary-600 bg-primary-50' : 'text-muted-600'
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