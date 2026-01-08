// src/components/molecules/GroupListItem.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaImage, FaVideo } from 'react-icons/fa6';
import Avatar from '../../atoms/Avatar';

interface GroupListItemProps {
  groupId: string;
  groupName: string;
  groupImage?: string;
  lastMessage?: {
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
  };
  unseenMsg?: number;
  onClose?: () => void;
}

const GroupListItem: React.FC<GroupListItemProps> = ({
  groupId,
  groupName,
  groupImage,
  lastMessage,
  unseenMsg,
  onClose
}) => {
  return (
    <NavLink
      to={`/home/group/${groupId}`}
      onClick={onClose}
      className="flex items-center gap-3 py-3 px-2 border border-transparent hover:border-primary rounded hover:bg-slate-100 cursor-pointer"
    >
      <div>
        <Avatar
          imageUrl={groupImage}
          name={groupName}
          width={50}
          height={50}
          userId={groupId}
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="text-ellipsis line-clamp-1 font-semibold text-base">
          {groupName}
        </h3>
        <div className="text-slate-500 text-xs flex items-center gap-1">
          <div className="flex items-center gap-1">
            {lastMessage?.imageUrl && (
              <div className="flex items-center gap-1">
                <FaImage />
                {!lastMessage?.text && <span>Image</span>}
              </div>
            )}
            {lastMessage?.videoUrl && (
              <div className="flex items-center gap-1">
                <FaVideo />
                {!lastMessage?.text && <span>Video</span>}
              </div>
            )}
          </div>
          <p className="text-ellipsis line-clamp-1">{lastMessage?.text}</p>
        </div>
      </div>

      {Boolean(unseenMsg) && (
        <div className="text-xs w-6 h-6 flex justify-center items-center ml-auto bg-primary text-white font-semibold rounded-full">
          {unseenMsg}
        </div>
      )}
    </NavLink>
  );
};

export default GroupListItem;