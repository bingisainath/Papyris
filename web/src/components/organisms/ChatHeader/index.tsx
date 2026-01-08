
// src/components/organisms/ChatHeader.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { HiDotsVertical } from 'react-icons/hi';
import { FaAngleLeft } from 'react-icons/fa6';
import Avatar from '../atoms/Avatar';

interface ChatHeaderProps {
  name: string;
  profilePic?: string;
  userId?: string;
  isOnline?: boolean;
  onOptionsClick?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  name,
  profilePic,
  userId,
  isOnline,
  onOptionsClick
}) => {
  return (
    <header className="sticky top-0 h-16 bg-white flex justify-between items-center px-4 border-b shadow-sm">
      <div className="flex items-center gap-4">
        <Link to="/home" className="lg:hidden hover:text-primary">
          <FaAngleLeft size={25} />
        </Link>
        <Avatar
          width={50}
          height={50}
          imageUrl={profilePic}
          name={name}
          userId={userId}
        />
        <div>
          <h3 className="font-semibold text-lg text-ellipsis line-clamp-1">
            {name}
          </h3>
          <p className="text-sm">
            {isOnline ? (
              <span className="text-primary">online</span>
            ) : (
              <span className="text-slate-400">offline</span>
            )}
          </p>
        </div>
      </div>

      <button
        className="cursor-pointer hover:text-primary p-2 rounded-full hover:bg-slate-100"
        onClick={onOptionsClick}
      >
        <HiDotsVertical size={20} />
      </button>
    </header>
  );
};

export default ChatHeader;