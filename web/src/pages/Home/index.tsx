
// // src/pages/Home/index.tsx - WITH DUMMY DATA
// import React, { useState } from 'react';
// import { useNavigate, useLocation, useParams } from 'react-router-dom';
// import { Sidebar, ChatList, ChatWindow, ExpensePanel, ProfileModal, CreateGroupModal, CreateExpenseModal } from '../../components/organisms';
// import { useAuth } from '../../app/AuthProvider';
// import { 
//   dummyConversations, 
//   dummyMessages, 
//   dummyExpenses, 
//   dummyUsers,
//   currentUser,
//   calculateExpenseTotals 
// } from '../../dummyData/chatData';

// const Home: React.FC = () => {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const params = useParams();

//   // Modals state
//   const [showProfileModal, setShowProfileModal] = useState(false);
//   const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
//   const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);

//   // Determine active route from location
//   const activeRoute = location.pathname.split('/')[1] || 'chat';
//   const activeConversationId = params.conversationId;
//   const activeGroupId = params.groupId;
//   const activeExpenseId = params.expenseId;

//   // Use dummy data
//   const conversations = dummyConversations;
//   const messages = activeConversationId ? dummyMessages[activeConversationId as keyof typeof dummyMessages] || [] : [];
//   const expenses = dummyExpenses;
//   const availableUsers = dummyUsers.filter(u => u.id !== 'current-user');

//   // Calculate expense totals
//   const expenseTotals = calculateExpenseTotals(expenses, 'current-user');

//   // Get active conversation details
//   const activeConversation = conversations.find(c => c.id === activeConversationId);

//   // Handlers
//   const handleNavigate = (path: string) => {
//     navigate(path);
//   };

//   const handleSelectConversation = (id: string) => {
//     navigate(`/chat/${id}`);
//   };

//   const handleSendMessage = (text: string, file?: File) => {
//     console.log('Send message:', text, file);
//     alert(`Message sent: "${text}"\n\nThis is demo mode. In production, this would send via WebSocket.`);
//   };

//   const handleCreateGroup = (data: any) => {
//     console.log('Create group:', data);
//     alert(`Group "${data.name}" created!\n\nMembers: ${data.memberIds.length}\n\nThis is demo mode.`);
//     setShowCreateGroupModal(false);
//   };

//   const handleCreateExpense = (data: any) => {
//     console.log('Create expense:', data);
//     alert(`Expense "${data.description}" created!\n\nAmount: $${data.amount}\n\nThis is demo mode.`);
//     setShowCreateExpenseModal(false);
//   };

//   const handleUpdateProfile = (data: any) => {
//     console.log('Update profile:', data);
//     alert(`Profile updated!\n\nName: ${data.name}\nUsername: ${data.username}\n\nThis is demo mode.`);
//     setShowProfileModal(false);
//   };

//   const handleSettleExpense = (id: string) => {
//     const expense = expenses.find(e => e.id === id);
//     if (expense) {
//       alert(`Settling expense: "${expense.description}"\n\nThis is demo mode.`);
//     }
//   };

//   if (!user) {
//     return null;
//   }

//   return (
//     <div className="flex h-screen bg-gradient-to-br from-muted-50 to-primary-50/20 overflow-hidden">
//       {/* Sidebar - Desktop only */}
//       <div className="w-64 flex-shrink-0 hidden md:block">
//         <Sidebar
//           user={{
//             id: currentUser.id,
//             name: currentUser.name,
//             username: currentUser.username,
//             avatar: currentUser.avatar
//           }}
//           activeRoute={`/${activeRoute}`}
//           unreadChats={conversations.filter(c => c.unreadCount && c.unreadCount > 0).length}
//           pendingExpenses={expenses.filter(e => e.status === 'pending').length}
//           onNavigate={handleNavigate}
//           onProfileClick={() => setShowProfileModal(true)}
//           onLogout={logout}
//         />
//       </div>

//       {/* Main content area */}
//       <div className="flex-1 flex overflow-hidden">
//         {/* CHAT PAGE */}
//         {activeRoute === 'chat' && (
//           <>
//             {/* Chat List */}
//             <div className="w-full md:w-96 flex-shrink-0 border-r border-muted-200 bg-white/80">
//               <ChatList
//                 conversations={conversations}
//                 activeConversationId={activeConversationId}
//                 onSelectConversation={handleSelectConversation}
//                 onNewChat={() => alert('New chat feature - Coming soon!')}
//                 onNewGroup={() => setShowCreateGroupModal(true)}
//                 isLoading={false}
//               />
//             </div>

//             {/* Chat Window or Welcome Screen */}
//             <div className="flex-1 hidden md:block">
//               {activeConversationId && activeConversation ? (
//                 <ChatWindow
//                   conversationId={activeConversationId}
//                   conversationName={activeConversation.name}
//                   conversationAvatar={activeConversation.avatar}
//                   isGroup={activeConversation.isGroup}
//                   isOnline={activeConversation.isOnline}
//                   messages={messages}
//                   currentUserId="current-user"
//                   onSendMessage={handleSendMessage}
//                   onTyping={(isTyping) => console.log('Typing:', isTyping)}
//                   onBack={() => navigate('/chat')}
//                 />
//               ) : (
//                 <WelcomeScreen />
//               )}
//             </div>
//           </>
//         )}

//         {/* GROUPS PAGE */}
//         {activeRoute === 'groups' && (
//           <div className="flex-1">
//             <GroupsPage 
//               groups={conversations.filter(c => c.isGroup)}
//               onCreateGroup={() => setShowCreateGroupModal(true)}
//               onOpenGroup={(id) => navigate(`/chat/${id}`)}
//             />
//           </div>
//         )}

//         {/* EXPENSES PAGE */}
//         {activeRoute === 'expenses' && (
//           <div className="flex-1">
//             <ExpensePanel
//               expenses={expenses}
//               currentUserId="current-user"
//               totalOwed={expenseTotals.totalOwed}
//               totalOwe={expenseTotals.totalOwe}
//               totalSettled={expenseTotals.totalSettled}
//               onCreateExpense={() => setShowCreateExpenseModal(true)}
//               onSettleExpense={handleSettleExpense}
//               onEditExpense={(id) => alert(`Edit expense ${id} - Coming soon!`)}
//               onDeleteExpense={(id) => alert(`Delete expense ${id} - Coming soon!`)}
//               isLoading={false}
//             />
//           </div>
//         )}

//         {/* SETTINGS PAGE */}
//         {activeRoute === 'settings' && (
//           <div className="flex-1">
//             <SettingsPage user={currentUser} />
//           </div>
//         )}
//       </div>

//       {/* Mobile bottom navigation */}
//       <MobileBottomNav activeRoute={activeRoute} onNavigate={handleNavigate} />

//       {/* Modals */}
//       <ProfileModal
//         isOpen={showProfileModal}
//         onClose={() => setShowProfileModal(false)}
//         user={{
//           id: currentUser.id,
//           name: currentUser.name,
//           username: currentUser.username,
//           email: currentUser.email,
//           avatar: currentUser.avatar,
//           bio: currentUser.bio,
//           joinedDate: 'January 2026'
//         }}
//         stats={{
//           totalChats: conversations.filter(c => !c.isGroup).length,
//           totalGroups: conversations.filter(c => c.isGroup).length,
//           totalExpenses: expenses.length,
//           totalSettled: expenses.filter(e => e.status === 'settled').length
//         }}
//         onUpdateProfile={handleUpdateProfile}
//       />

//       <CreateGroupModal
//         isOpen={showCreateGroupModal}
//         onClose={() => setShowCreateGroupModal(false)}
//         onCreateGroup={handleCreateGroup}
//         availableUsers={availableUsers}
//         currentUserId="current-user"
//       />

//       <CreateExpenseModal
//         isOpen={showCreateExpenseModal}
//         onClose={() => setShowCreateExpenseModal(false)}
//         onCreateExpense={handleCreateExpense}
//         groupMembers={availableUsers.slice(0, 4)} // Mock group members
//         currentUserId="current-user"
//       />
//     </div>
//   );
// };

// // Welcome Screen Component
// const WelcomeScreen: React.FC = () => (
//   <div className="flex items-center justify-center h-full">
//     <div className="text-center px-8">
//       <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center shadow-card animate-scale-in">
//         <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
//         </svg>
//       </div>
//       <h2 className="text-3xl font-bold text-muted-900 mb-3">Papyris Web</h2>
//       <p className="text-muted-500 max-w-md leading-relaxed mb-4">
//         Send and receive messages without keeping your phone online.
//         <br />
//         Use Papyris on multiple devices at the same time.
//       </p>
//       <p className="text-sm text-primary-600 font-medium">
//         ← Select a conversation to start chatting
//       </p>
//     </div>
//   </div>
// );

// // Groups Page Component
// const GroupsPage: React.FC<{ 
//   groups: any[];
//   onCreateGroup: () => void;
//   onOpenGroup: (id: string) => void;
// }> = ({ groups, onCreateGroup, onOpenGroup }) => (
//   <div className="p-8 h-full overflow-auto">
//     <div className="max-w-4xl mx-auto">
//       {/* Header */}
//       <div className="flex items-center justify-between mb-8">
//         <div>
//           <h1 className="text-3xl font-bold text-muted-900">Groups</h1>
//           <p className="text-muted-500 mt-1">Manage your group conversations</p>
//         </div>
//         <button
//           onClick={onCreateGroup}
//           className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-card hover:shadow-elevated transition-all hover:scale-105 flex items-center gap-2"
//         >
//           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
//           </svg>
//           Create Group
//         </button>
//       </div>

//       {/* Groups List */}
//       {groups.length > 0 ? (
//         <div className="grid gap-4 md:grid-cols-2">
//           {groups.map(group => (
//             <div
//               key={group.id}
//               className="card p-6 hover:shadow-elevated transition-all cursor-pointer hover:scale-[1.02]"
//               onClick={() => onOpenGroup(group.id)}
//             >
//               <div className="flex items-start gap-4">
//                 {/* Group Avatar */}
//                 <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
//                   {group.name.charAt(0)}
//                 </div>

//                 {/* Group Info */}
//                 <div className="flex-1 min-w-0">
//                   <div className="flex items-center justify-between mb-2">
//                     <h3 className="text-lg font-semibold text-muted-900 truncate">
//                       {group.name}
//                     </h3>
//                     {group.unreadCount > 0 && (
//                       <span className="px-2 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
//                         {group.unreadCount}
//                       </span>
//                     )}
//                   </div>

//                   <p className="text-sm text-muted-500 mb-3 truncate">
//                     {group.lastMessage}
//                   </p>

//                   {/* Members count & last activity */}
//                   <div className="flex items-center gap-4 text-xs text-muted-400">
//                     <span className="flex items-center gap-1">
//                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//                       </svg>
//                       {group.members?.length || 0} members
//                     </span>
//                     <span>• {group.lastMessageTime}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       ) : (
//         <div className="text-center py-20">
//           <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-secondary-100 to-primary-100 flex items-center justify-center">
//             <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//             </svg>
//           </div>
//           <h2 className="text-2xl font-bold text-muted-900 mb-2">No Groups Yet</h2>
//           <p className="text-muted-500 mb-6">Create your first group to get started!</p>
//         </div>
//       )}
//     </div>
//   </div>
// );

// // Settings Page Component
// const SettingsPage: React.FC<{ user: any }> = ({ user }) => (
//   <div className="p-8 h-full overflow-auto">
//     <div className="max-w-4xl mx-auto">
//       <h1 className="text-3xl font-bold text-muted-900 mb-8">Settings</h1>

//       <div className="space-y-6">
//         {/* Account Section */}
//         <div className="card p-6">
//           <h2 className="text-xl font-semibold text-muted-900 mb-4 flex items-center gap-2">
//             <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
//             </svg>
//             Account
//           </h2>
//           <div className="space-y-3">
//             <div className="flex justify-between items-center py-3 border-b border-muted-100">
//               <span className="text-muted-700">Name</span>
//               <span className="text-muted-900 font-medium">{user.name}</span>
//             </div>
//             <div className="flex justify-between items-center py-3 border-b border-muted-100">
//               <span className="text-muted-700">Email</span>
//               <span className="text-muted-900 font-medium">{user.email}</span>
//             </div>
//             <div className="flex justify-between items-center py-3 border-b border-muted-100">
//               <span className="text-muted-700">Username</span>
//               <span className="text-muted-900 font-medium">{user.username || 'Not set'}</span>
//             </div>
//             <div className="flex justify-between items-center py-3">
//               <span className="text-muted-700">Bio</span>
//               <span className="text-muted-500 text-sm">{user.bio || 'No bio set'}</span>
//             </div>
//           </div>
//         </div>

//         {/* Notifications Section */}
//         <div className="card p-6">
//           <h2 className="text-xl font-semibold text-muted-900 mb-4 flex items-center gap-2">
//             <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
//             </svg>
//             Notifications
//           </h2>
//           <div className="space-y-3">
//             <label className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted-50 rounded-lg px-3 transition-colors">
//               <span className="text-muted-700">Push Notifications</span>
//               <input type="checkbox" className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500" defaultChecked />
//             </label>
//             <label className="flex items-center justify-between py-3 cursor-pointer border-t border-muted-100 hover:bg-muted-50 rounded-lg px-3 transition-colors">
//               <span className="text-muted-700">Email Notifications</span>
//               <input type="checkbox" className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500" defaultChecked />
//             </label>
//             <label className="flex items-center justify-between py-3 cursor-pointer border-t border-muted-100 hover:bg-muted-50 rounded-lg px-3 transition-colors">
//               <span className="text-muted-700">Message Sounds</span>
//               <input type="checkbox" className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500" defaultChecked />
//             </label>
//           </div>
//         </div>

//         {/* Privacy Section */}
//         <div className="card p-6">
//           <h2 className="text-xl font-semibold text-muted-900 mb-4 flex items-center gap-2">
//             <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
//             </svg>
//             Privacy
//           </h2>
//           <div className="space-y-3">
//             <label className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted-50 rounded-lg px-3 transition-colors">
//               <span className="text-muted-700">Show Online Status</span>
//               <input type="checkbox" className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500" defaultChecked />
//             </label>
//             <label className="flex items-center justify-between py-3 cursor-pointer border-t border-muted-100 hover:bg-muted-50 rounded-lg px-3 transition-colors">
//               <span className="text-muted-700">Read Receipts</span>
//               <input type="checkbox" className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500" defaultChecked />
//             </label>
//             <label className="flex items-center justify-between py-3 cursor-pointer border-t border-muted-100 hover:bg-muted-50 rounded-lg px-3 transition-colors">
//               <span className="text-muted-700">Last Seen</span>
//               <input type="checkbox" className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500" defaultChecked />
//             </label>
//           </div>
//         </div>

//         {/* About Section */}
//         <div className="card p-6">
//           <h2 className="text-xl font-semibold text-muted-900 mb-4 flex items-center gap-2">
//             <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//             </svg>
//             About
//           </h2>
//           <div className="space-y-3">
//             <div className="flex justify-between items-center py-3 border-b border-muted-100">
//               <span className="text-muted-700">Version</span>
//               <span className="text-muted-500 text-sm font-mono">1.0.0</span>
//             </div>
//             <div className="flex justify-between items-center py-3">
//               <span className="text-muted-700">Build</span>
//               <span className="text-muted-500 text-sm font-mono">Demo</span>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   </div>
// );

// // Mobile Bottom Navigation Component
// const MobileBottomNav: React.FC<{ activeRoute: string; onNavigate: (path: string) => void }> = ({ 
//   activeRoute, 
//   onNavigate 
// }) => (
//   <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-muted-200 px-2 py-2 flex justify-around z-50 shadow-elevated">
//     <button
//       onClick={() => onNavigate('/chat')}
//       className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
//         activeRoute === 'chat' 
//           ? 'text-primary-600 bg-primary-50 scale-105' 
//           : 'text-muted-600 hover:bg-muted-50'
//       }`}
//     >
//       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
//       </svg>
//       <span className="text-xs font-medium">Chats</span>
//     </button>

//     <button
//       onClick={() => onNavigate('/groups')}
//       className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
//         activeRoute === 'groups' 
//           ? 'text-primary-600 bg-primary-50 scale-105' 
//           : 'text-muted-600 hover:bg-muted-50'
//       }`}
//     >
//       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//       </svg>
//       <span className="text-xs font-medium">Groups</span>
//     </button>

//     <button
//       onClick={() => onNavigate('/expenses')}
//       className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
//         activeRoute === 'expenses' 
//           ? 'text-primary-600 bg-primary-50 scale-105' 
//           : 'text-muted-600 hover:bg-muted-50'
//       }`}
//     >
//       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
//       </svg>
//       <span className="text-xs font-medium">Expenses</span>
//     </button>

//     <button
//       onClick={() => onNavigate('/settings')}
//       className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
//         activeRoute === 'settings' 
//           ? 'text-primary-600 bg-primary-50 scale-105' 
//           : 'text-muted-600 hover:bg-muted-50'
//       }`}
//     >
//       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
//         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//       </svg>
//       <span className="text-xs font-medium">Settings</span>
//     </button>
//   </div>
// );

// export default Home;


// src/pages/Home/index.tsx - WITH BACKEND INTEGRATION

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Sidebar,
  ChatList,
  ChatWindow,
  ExpensePanel,
  ProfileModal,
  CreateGroupModal,
  CreateExpenseModal
} from '../../components/organisms';
import {
  useSendMessage,
  useConversationRoom
} from '../../hooks/useWebSocket';
import {
  fetchConversations,
  fetchMessages,
  createGroupConversation,
  fetchUsers
} from '../../redux/actions/chatActions';
import { logout } from '../../redux/actions/authActions';
import { selectUser } from '../../redux/slices/authSlice';
import type { AppDispatch, RootState } from '../../redux/store';

import { JwtPayload } from "../../types/auth.types";

const Home: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Redux state
  const currentUser = useSelector(selectUser);
  const conversations = useSelector((state: RootState) => state.chat.conversations);
  const messages = useSelector((state: RootState) =>
    params.conversationId ? state.chat.messages[params.conversationId] || [] : []
  );
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const messagesLoading = useSelector((state: RootState) => state.chat.messagesLoading);

  // WebSocket hooks
  const { sendMessage } = useSendMessage();
  const activeConversationId = params.conversationId;
  useConversationRoom(activeConversationId);

  // Modals state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // Determine active route
  // const activeRoute = location.pathname.split('/')[1] || 'chat';

  const activeRoute = ['chat', 'groups', 'expenses', 'settings'].includes(location.pathname.split('/')[1])
    ? location.pathname.split('/')[1]
    : 'chat';


  // Load conversations on mount
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      dispatch(fetchMessages(activeConversationId));
    }
  }, [activeConversationId, dispatch]);

  // Load users for group creation
  useEffect(() => {
    const loadUsers = async () => {
      const users = await fetchUsers();
      setAvailableUsers(users.filter((u: any) => u.id !== currentUser?.id));
    };
    loadUsers();
  }, [currentUser]);

  // Get active conversation details
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Handlers
  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleSendMessage = (text: string, file?: File) => {
    if (!activeConversationId) return;

    if (file) {
      // TODO: Handle file upload
      alert('File upload coming soon!');
      return;
    }

    // Send via WebSocket
    sendMessage(activeConversationId, text);
  };

  const handleCreateGroup = async (data: any) => {
    const result = await dispatch(createGroupConversation(data.name, data.memberIds));

    if (result.success) {
      setShowCreateGroupModal(false);
      // Navigate to new group
      if (result.conversationId) {
        navigate(`/chat/${result.conversationId}`);
      }
    } else {
      alert(`Failed to create group: ${result.error || 'Unknown error'}`);
    }
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
    dispatch(logout());
    navigate('/login');
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-muted-50 to-primary-50/20 overflow-hidden">
      {/* Sidebar - Desktop only */}
      <div className="w-64 flex-shrink-0 hidden md:block">
        <Sidebar
          user={{
            id: currentUser.id,
            name: currentUser.name || currentUser.username,
            username: currentUser.username,
            avatar: currentUser.avatar
          }}
          activeRoute={`/${activeRoute}`}
          unreadChats={conversations.filter(c => c.unreadCount && c.unreadCount > 0).length}
          pendingExpenses={0} // TODO: Implement expenses
          onNavigate={handleNavigate}
          onProfileClick={() => setShowProfileModal(true)}
          onLogout={handleLogout}
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
                onNewChat={() => alert('New chat - Select a user from search')}
                onNewGroup={() => setShowCreateGroupModal(true)}
                isLoading={isLoading}
              />
            </div>

            {/* Chat Window or Welcome Screen */}
            <div className="flex-1 hidden md:block">
              {activeConversationId && activeConversation ? (
                <ChatWindow
                  conversationId={activeConversationId}
                  conversationName={activeConversation.name}
                  conversationAvatar={activeConversation.avatar}
                  isGroup={activeConversation.isGroup}
                  isOnline={activeConversation.isOnline}
                  messages={messages}
                  currentUserId={currentUser.id}
                  onSendMessage={handleSendMessage}
                  onTyping={(isTyping) => console.log('Typing:', isTyping)}
                  onBack={() => navigate('/chat')}
                  isLoading={messagesLoading}
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

      {/* Mobile bottom navigation */}
      <MobileBottomNav activeRoute={activeRoute} onNavigate={handleNavigate} />

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={{
          id: currentUser.id,
          name: currentUser.name || currentUser.username,
          username: currentUser.username,
          email: currentUser.email,
          avatar: currentUser.avatar,
          bio: currentUser.bio,
          joinedDate: currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Recently'
        }}
        stats={{
          totalChats: conversations.filter(c => !c.isGroup).length,
          totalGroups: conversations.filter(c => c.isGroup).length,
          totalExpenses: 0,
          totalSettled: 0
        }}
        onUpdateProfile={handleUpdateProfile}
      />

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
        availableUsers={availableUsers}
        currentUserId={currentUser.id}
      />

      <CreateExpenseModal
        isOpen={showCreateExpenseModal}
        onClose={() => setShowCreateExpenseModal(false)}
        onCreateExpense={handleCreateExpense}
        groupMembers={[]} // TODO: Get from active group
        currentUserId={currentUser.id}
      />
    </div>
  );
};

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

// Settings Page Component (same as before)
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
              <span className="text-muted-700">Name</span>
              <span className="text-muted-900 font-medium">{user.name || user.username}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-muted-100">
              <span className="text-muted-700">Email</span>
              <span className="text-muted-900 font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-muted-100">
              <span className="text-muted-700">Username</span>
              <span className="text-muted-900 font-medium">{user.username}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-muted-700">Bio</span>
              <span className="text-muted-500 text-sm">{user.bio || 'No bio set'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Mobile Bottom Navigation (same as before)
const MobileBottomNav: React.FC<{ activeRoute: string; onNavigate: (path: string) => void }> = ({
  activeRoute,
  onNavigate
}) => (
  <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-muted-200 px-2 py-2 flex justify-around z-50 shadow-elevated">
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

const STORAGE_KEY =
  process.env.REACT_APP_TOKEN_STORAGE_KEY || "papyris_access_token";

export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
  set(token: string) {
    localStorage.setItem(STORAGE_KEY, token);
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 15): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
}
