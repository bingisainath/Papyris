// src/components/organisms/GroupList.tsx
import React from 'react';
import GroupListItem from '../../molecules/GroupListItem';
import Text from '../../atoms/Text';
import Button from '../../atoms/Button';

interface Group {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  memberCount: number;
  unreadCount?: number;
}

interface GroupListProps {
  groups: Group[];
  activeGroup?: string;
  onGroupClick: (groupId: string) => void;
  onCreateGroup?: () => void;
}

const GroupList: React.FC<GroupListProps> = ({ 
  groups, 
  activeGroup, 
  onGroupClick,
  onCreateGroup 
}) => {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-white">
        <div className="text-center max-w-sm">
          <div className="w-32 h-32 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <Text variant="h4" weight="semibold" className="text-gray-900 mb-2">
            No groups yet
          </Text>
          <Text variant="body" className="text-gray-500 mb-6">
            Create a group to start collaborating with multiple people
          </Text>
          {onCreateGroup && (
            <Button 
              variant="primary" 
              onClick={onCreateGroup}
              className="bg-[#008069] hover:bg-[#006b58]"
            >
              + New Group
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full bg-white">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 sticky top-0">
        <Text variant="small" weight="semibold" className="text-gray-700">
          {groups.length} {groups.length === 1 ? 'Group' : 'Groups'}
        </Text>
        {onCreateGroup && (
          <button
            onClick={onCreateGroup}
            className="text-[#008069] hover:text-[#006b58] font-medium text-sm flex items-center gap-1"
          >
            <span className="text-lg">+</span>
            <span>New Group</span>
          </button>
        )}
      </div>

      {/* Groups List */}
      {groups.map((group) => (
        <GroupListItem
          key={group.id}
          {...group}
          isActive={activeGroup === group.id}
          onClick={onGroupClick}
        />
      ))}
    </div>
  );
};

export default GroupList;