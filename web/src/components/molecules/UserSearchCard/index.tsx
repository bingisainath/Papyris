// src/components/UserSearchCard/index.tsx (or wherever it's located)
import React from "react";
import Avatar from "../../atoms/Avatar"; // Adjust path as needed
import { Link } from "react-router-dom";
import { FiPhoneCall } from "react-icons/fi";

interface User {
  _id: string;
  name: string;
  email: string;
  profile_pic?: string;
}

interface UserSearchCardProps {
  user: User;
  onClose: () => void;
  onCall: (userId: string) => void;
}

const UserSearchCard: React.FC<UserSearchCardProps> = ({ user, onClose, onCall }) => {
  const handleCallUser = () => {
    onCall(user._id);
  };

  return (
    <div className="flex items-center row-auto gap-3 p-3 lg:p-4 border border-transparent border-b-slate-200 hover:border hover:border-primary rounded cursor-pointer">
      <Link
        to={`/home/user/${user._id}`}
        onClick={onClose}
        className="flex items-center flex-1"
      >
        <div className="mr-4">
          <Avatar
            width={50}
            height={50}
            name={user.name}
            userId={user._id}
            imageUrl={user.profile_pic}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ellipsis line-clamp-1">
            {user.name}
          </div>
          <p className="text-sm text-ellipsis line-clamp-1 text-gray-500">
            {user.email}
          </p>
        </div>
      </Link>
      <button 
        onClick={handleCallUser} 
        className="text-primary hover:text-secondary transition-colors p-2"
        title="Call user"
      >
        <FiPhoneCall size={24} />
      </button>
    </div>
  );
};

export default UserSearchCard;