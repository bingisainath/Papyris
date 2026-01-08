// // src/pages/Home.tsx
// import React, { useState } from 'react';
// import ProfileHeader from '../../components/organisms/ProfileHeader';
// import TabNavigation from '../../components/organisms/TabNavigation';
// import SearchBar from '../../components/molecules/SearchBar';
// import ChatList from '../../components/organisms/ChatList';
// import ChatWindow from '../../components/organisms/ChatWindow';
// import WelcomeScreen from '../../components/organisms/WelcomeScreen';

// type TabType = 'chats' | 'groups' | 'splitwise';

// interface Message {
//   id: string;
//   text: string;
//   sender: 'me' | 'them';
//   timestamp: string;
//   status?: 'sent' | 'delivered' | 'read';  // Allow all three statuses
// }

// const mockUser = {
//   id: '1',
//   name: 'John Doe',
//   avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff'
// };

// const mockChats = [
//   {
//     id: 'chat-1',
//     name: 'Alice Johnson',
//     avatar: 'https://ui-avatars.com/api/?name=Alice+Johnson&background=random',
//     lastMessage: 'Hey! Are we still meeting tomorrow?',
//     timestamp: '2m ago',
//     unreadCount: 2,
//     isOnline: true,
//     isRead: false
//   },
//   {
//     id: 'chat-2',
//     name: 'Bob Smith',
//     avatar: 'https://ui-avatars.com/api/?name=Bob+Smith&background=random',
//     lastMessage: 'Thanks for the help yesterday!',
//     timestamp: '1h ago',
//     unreadCount: 0,
//     isOnline: false,
//     isRead: true
//   },
//   {
//     id: 'chat-3',
//     name: 'Carol Williams',
//     avatar: 'https://ui-avatars.com/api/?name=Carol+Williams&background=random',
//     lastMessage: 'Can you send me that document?',
//     timestamp: '3h ago',
//     unreadCount: 1,
//     isOnline: true,
//     isRead: false
//   }
// ];

// const mockMessages = [
//   { id: '1', text: 'Hey! How are you?', sender: 'them' as const, timestamp: '10:30 AM', status: 'read' as const },
//   { id: '2', text: "I'm good, thanks! How about you?", sender: 'me' as const, timestamp: '10:31 AM', status: 'read' as const },
//   { id: '3', text: 'Doing great! Are we still on for tomorrow?', sender: 'them' as const, timestamp: '10:32 AM', status: 'read' as const },
//   { id: '4', text: 'Yes, absolutely! See you at 3 PM.', sender: 'me' as const, timestamp: '10:33 AM', status: 'read' as const }
// ];

// const Home: React.FC = () => {
//   const [activeTab, setActiveTab] = useState<TabType>('chats');
//   const [selectedChatId, setSelectedChatId] = useState<string | undefined>(undefined);
//   const [searchQuery, setSearchQuery] = useState<string>('');
//   const [messages, setMessages] = useState<Message[]>(mockMessages);

//   const filteredChats = mockChats.filter(chat =>
//     chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const chatBadge = mockChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
//   const selectedChat = mockChats.find(c => c.id === selectedChatId);

//   const handleSendMessage = (text: string) => {
//     const newMessage = {
//       id: Date.now().toString(),
//       text,
//       sender: 'me' as const,
//       timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
//       status: 'sent' as const
//     };
//     setMessages([...messages, newMessage]);
//   };

//   return (
//     <div className="flex h-screen bg-gray-100 overflow-hidden">
//       {/* Sidebar */}
//       <aside className="w-96 bg-white flex flex-col border-r border-gray-300">
//         <ProfileHeader user={mockUser} onProfileClick={() => alert('Profile')} />
        
//         <div className="px-3 py-2.5 bg-[#f0f2f5] border-b border-gray-200">
//           <SearchBar placeholder="Search or start new chat" onSearch={setSearchQuery} />
//         </div>

//         <div className="px-3 py-2 bg-white border-b border-gray-200">
//           <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} chatBadge={chatBadge} groupBadge={7} splitwiseBadge={3} />
//         </div>

//         <div className="flex-1 overflow-hidden">
//           <ChatList chats={filteredChats} activeChat={selectedChatId} onChatClick={setSelectedChatId} />
//         </div>
//       </aside>

//       {/* Main */}
//       <main className="flex-1 flex flex-col overflow-hidden">
//         {selectedChat ? (
//           <ChatWindow
//             chatName={selectedChat.name}
//             chatAvatar={selectedChat.avatar}
//             isOnline={selectedChat.isOnline}
//             lastSeen="today at 2:30 PM"
//             messages={messages}
//             onSendMessage={handleSendMessage}
//           />
//         ) : (
//           <WelcomeScreen />
//         )}
//       </main>
//     </div>
//   );
// };

// export default Home;


// src/pages/Home/index.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/organisms/Sidebar';

const Home: React.FC = () => {
  return (
    <div className="grid lg:grid-cols-[320px,1fr] h-screen max-h-screen">
      <section className="bg-white">
        <Sidebar />
      </section>

      <section className="bg-slate-100">
        <Outlet />
      </section>
    </div>
  );
};

export default Home;