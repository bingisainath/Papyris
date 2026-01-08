
// src/components/organisms/ChatList.tsx
import React, { useState } from 'react';
import { FiArrowUpLeft } from 'react-icons/fi';
import { AiOutlineUsergroupAdd } from 'react-icons/ai';
import ChatListItem from '../../molecules/ChatListItem';
import GroupListItem from '../../molecules/GroupListItem';

interface Chat {
  _id: string;
  userDetails?: {
    _id: string;
    name: string;
    email: string;
    profile_pic?: string;
  };
  groupName?: string;
  groupImage?: string;
  lastMsg?: {
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
  };
  unseenMsg?: number;
}

interface ChatListProps {
  chats: Chat[];
  type: 'chat' | 'group';
  onCreateGroup?: () => void;
}

const ChatList: React.FC<ChatListProps> = ({ chats, type, onCreateGroup }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="h-16 flex items-center justify-between px-4">
        <h2 className="text-xl font-bold text-slate-800">
          {type === 'chat' ? 'Messages' : 'Groups'}
        </h2>
        {type === 'group' && onCreateGroup && (
          <button
            onClick={onCreateGroup}
            className="hover:text-primary transition-colors"
            title="Create new group"
          >
            <AiOutlineUsergroupAdd size={28} />
          </button>
        )}
      </div>

      <div className="bg-slate-200 h-[1px]" />

      <div className="flex-1 overflow-y-auto scrollbar">
        {chats.length === 0 && (
          <div className="mt-12 px-4">
            <div className="flex justify-center items-center my-4 text-slate-500">
              <FiArrowUpLeft size={50} />
            </div>
            <p className="text-lg text-center text-slate-400">
              {type === 'chat'
                ? 'Explore users to start a conversation'
                : 'Create or join groups to start chatting'}
            </p>
          </div>
        )}

        {chats.map((chat) => {
          if (type === 'chat' && chat.userDetails) {
            return (
              <ChatListItem
                key={chat._id}
                userId={chat.userDetails._id}
                name={chat.userDetails.name}
                email={chat.userDetails.email}
                profilePic={chat.userDetails.profile_pic}
                lastMessage={chat.lastMsg}
                unseenMsg={chat.unseenMsg}
              />
            );
          } else if (type === 'group') {
            return (
              <GroupListItem
                key={chat._id}
                groupId={chat._id}
                groupName={chat.groupName || ''}
                groupImage={chat.groupImage}
                lastMessage={chat.lastMsg}
                unseenMsg={chat.unseenMsg}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default ChatList;
