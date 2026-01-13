// src/components/organisms/CreateGroupModal.tsx
// import React, { useState } from 'react';
// import { Button, Input, Textarea, Typography } from '../../atoms';
// import Icon from '../../atoms/Icon';
// import { UserCard } from '../../molecules';

// interface User {
//   id: string;
//   name: string;
//   username?: string;
//   avatar?: string;
//   isOnline?: boolean;
// }

// interface CreateGroupModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onCreateGroup: (data: {
//     name: string;
//     description: string;
//     memberIds: string[];
//     avatar?: File;
//   }) => void;
//   availableUsers: User[];
//   currentUserId: string;
//   isLoading?: boolean;
// }

// const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
//   isOpen,
//   onClose,
//   onCreateGroup,
//   availableUsers,
//   currentUserId,
//   isLoading = false
// }) => {
//   const [step, setStep] = useState<'details' | 'members'>('details');
//   const [groupName, setGroupName] = useState('');
//   const [description, setDescription] = useState('');
//   const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [avatarFile, setAvatarFile] = useState<File | null>(null);
//   const [avatarPreview, setAvatarPreview] = useState<string>('');

//   const [errors, setErrors] = useState<{ name?: string; members?: string }>({});

//   // Filter users - MOVED BEFORE early return
//   const filteredUsers = availableUsers
//     .filter(user => user.id !== currentUserId)
//     .filter(user => {
//       if (!searchQuery.trim()) return true;
//       const query = searchQuery.toLowerCase();
//       return (
//         user.name.toLowerCase().includes(query) ||
//         user.username?.toLowerCase().includes(query)
//       );
//     });

//   // NOW do the early return AFTER all hooks
//   if (!isOpen) return null;

//   const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       setAvatarFile(file);
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         setAvatarPreview(reader.result as string);
//       };
//       reader.readAsDataURL(file);
//     }
//   };

//   const toggleMember = (userId: string) => {
//     setSelectedMemberIds(prev =>
//       prev.includes(userId)
//         ? prev.filter(id => id !== userId)
//         : [...prev, userId]
//     );
//     setErrors(prev => ({ ...prev, members: undefined }));
//   };

//   const handleNext = () => {
//     // Validate group details
//     const newErrors: { name?: string } = {};

//     if (!groupName.trim()) {
//       newErrors.name = 'Group name is required';
//     } else if (groupName.length < 3) {
//       newErrors.name = 'Group name must be at least 3 characters';
//     }

//     if (Object.keys(newErrors).length > 0) {
//       setErrors(newErrors);
//       return;
//     }

//     setStep('members');
//   };

//   const handleCreate = () => {
//     // Validate members
//     if (selectedMemberIds.length < 1) {
//       setErrors({ members: 'Select at least one member' });
//       return;
//     }

//     onCreateGroup({
//       name: groupName.trim(),
//       description: description.trim(),
//       memberIds: selectedMemberIds,
//       avatar: avatarFile || undefined
//     });
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
//       <div className="bg-white rounded-2xl shadow-elevated max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-in">
//         {/* Header */}
//         <div className="flex items-center justify-between px-6 py-4 border-b border-muted-200">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-400 flex items-center justify-center">
//               <Icon name="users" size={22} className="text-white" />
//             </div>
//             <div>
//               <Typography variant="h5" weight="bold" className="text-muted-900">
//                 Create New Group
//               </Typography>
//               <Typography variant="caption" className="text-muted-500">
//                 Step {step === 'details' ? '1' : '2'} of 2: {step === 'details' ? 'Group Details' : 'Add Members'}
//               </Typography>
//             </div>
//           </div>
//           <Button
//             variant="ghost"
//             size="sm"
//             icon={<Icon name="close" size={20} />}
//             onClick={onClose}
//             disabled={isLoading}
//           />
//         </div>

//         {/* Content */}
//         <div className="flex-1 overflow-y-auto px-6 py-6">
//           {step === 'details' ? (
//             <div className="space-y-6">
//               {/* Avatar upload */}
//               <div className="flex flex-col items-center">
//                 <div className="relative group">
//                   <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-card">
//                     {avatarPreview ? (
//                       <img src={avatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
//                     ) : (
//                       <Icon name="users" size={40} className="text-primary-600" />
//                     )}
//                   </div>
//                   <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors shadow-card">
//                     <Icon name="edit" size={16} className="text-white" />
//                     <input
//                       type="file"
//                       accept="image/*"
//                       onChange={handleAvatarChange}
//                       className="hidden"
//                       disabled={isLoading}
//                     />
//                   </label>
//                 </div>
//                 <Typography variant="caption" className="text-muted-500 mt-2">
//                   Click to upload group photo
//                 </Typography>
//               </div>

//               {/* Group name */}
//               <Input
//                 label="Group Name"
//                 placeholder="Enter group name..."
//                 value={groupName}
//                 onChange={(e) => {
//                   setGroupName(e.target.value);
//                   setErrors(prev => ({ ...prev, name: undefined }));
//                 }}
//                 error={errors.name}
//                 required
//                 disabled={isLoading}
//                 maxLength={50}
//               />

//               {/* Description */}
//               <Textarea
//                 label="Description (Optional)"
//                 placeholder="What's this group about?"
//                 value={description}
//                 onChange={(e) => setDescription(e.target.value)}
//                 rows={4}
//                 maxLength={200}
//                 showCount
//                 disabled={isLoading}
//               />
//             </div>
//           ) : (
//             <div className="space-y-4">
//               {/* Search */}
//               <Input
//                 type="search"
//                 placeholder="Search users..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 leftIcon={<Icon name="search" size={18} />}
//                 disabled={isLoading}
//               />

//               {/* Selected count */}
//               <div className="flex items-center justify-between p-3 bg-primary-50 rounded-xl">
//                 <Typography variant="body2" className="text-primary-700">
//                   {selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? 's' : ''} selected
//                 </Typography>
//                 {selectedMemberIds.length > 0 && (
//                   <button
//                     onClick={() => setSelectedMemberIds([])}
//                     className="text-sm text-primary-600 hover:text-primary-700 font-medium"
//                   >
//                     Clear all
//                   </button>
//                 )}
//               </div>

//               {errors.members && (
//                 <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
//                   <Typography variant="body2" className="text-accent-700">
//                     {errors.members}
//                   </Typography>
//                 </div>
//               )}

//               {/* User list */}
//               <div className="space-y-2 max-h-96 overflow-y-auto">
//                 {filteredUsers.length === 0 ? (
//                   <div className="flex flex-col items-center justify-center py-12 text-center">
//                     <Icon name="search" size={48} className="text-muted-300 mb-3" />
//                     <Typography variant="body1" className="text-muted-500">
//                       No users found
//                     </Typography>
//                   </div>
//                 ) : (
//                   filteredUsers.map(user => (
//                     <UserCard
//                       key={user.id}
//                       {...user}
//                       variant="compact"
//                       isSelected={selectedMemberIds.includes(user.id)}
//                       onSelect={() => toggleMember(user.id)}
//                       showActions={false}
//                     />
//                   ))
//                 )}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Footer */}
//         <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-200">
//           <Button
//             variant="ghost"
//             size="md"
//             onClick={step === 'details' ? onClose : () => setStep('details')}
//             disabled={isLoading}
//           >
//             {step === 'details' ? 'Cancel' : 'Back'}
//           </Button>

//           <Button
//             variant="primary"
//             size="md"
//             onClick={step === 'details' ? handleNext : handleCreate}
//             loading={isLoading}
//             disabled={isLoading}
//           >
//             {step === 'details' ? 'Next' : 'Create Group'}
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default CreateGroupModal;






// src/components/organisms/CreateGroupModal.tsx - WITH DEBOUNCING

import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea, Typography } from '../../atoms';
import Icon from '../../atoms/Icon';
import { UserCard } from '../../molecules';
import { useDebounce } from '../../../hooks/useDebounce';
import { userService } from '../../../services/user.service';

interface User {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  isOnline?: boolean;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (data: {
    name: string;
    description: string;
    memberIds: string[];
    avatar?: File;
  }) => void;
  currentUserId: string;
  isLoading?: boolean;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  currentUserId,
  isLoading = false
}) => {
  const [step, setStep] = useState<'details' | 'members'>('details');
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [errors, setErrors] = useState<{ name?: string; members?: string }>({});
  
  // Search state
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>('');

  // Debounce search query (500ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Load all users when moving to members step
  useEffect(() => {
    if (step === 'members' && searchResults.length === 0) {
      loadAllUsers();
    }
  }, [step]);

  // Search users when debounced query changes
  useEffect(() => {
    if (step === 'members' && debouncedSearchQuery.trim()) {
      searchUsers(debouncedSearchQuery);
    } else if (step === 'members' && !debouncedSearchQuery.trim()) {
      loadAllUsers();
    }
  }, [debouncedSearchQuery, step]);

  // Early return after all hooks
  if (!isOpen) return null;

  const loadAllUsers = async () => {
    setSearching(true);
    setSearchError('');
    
    try {
      const response = await userService.getAllUsers();
      
      if (response.success && response.data) {
        const users = response.data
          .filter((u: any) => u.id !== currentUserId)
          .map((u: any) => ({
            id: u.id,
            name: u.name || u.username,
            username: u.username,
            avatar: u.avatar,
            isOnline: u.is_online
          }));
        
        setSearchResults(users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setSearchError('Failed to load users');
    } finally {
      setSearching(false);
    }
  };

  const searchUsers = async (query: string) => {
    setSearching(true);
    setSearchError('');

    try {
      const response = await userService.searchUsers(query);
      
      if (response.success && response.data) {
        const users = response.data
          .filter((u: any) => u.id !== currentUserId)
          .filter((u: any) => !selectedMembers.some(m => m.id === u.id))
          .map((u: any) => ({
            id: u.id,
            name: u.name || u.username,
            username: u.username,
            avatar: u.avatar,
            isOnline: u.is_online
          }));

        setSearchResults(users);

        if (users.length === 0) {
          setSearchError('No users found');
        }
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchError(error.response?.data?.detail || 'Failed to search users');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMember = (user: User) => {
    const isSelected = selectedMembers.some(m => m.id === user.id);
    
    if (isSelected) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== user.id));
    } else {
      setSelectedMembers([...selectedMembers, user]);
    }
    setErrors(prev => ({ ...prev, members: undefined }));
  };

  const removeMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.id !== userId));
  };

  const handleNext = () => {
    const newErrors: { name?: string } = {};

    if (!groupName.trim()) {
      newErrors.name = 'Group name is required';
    } else if (groupName.length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setStep('members');
  };

  const handleCreate = () => {
    if (selectedMembers.length < 1) {
      setErrors({ members: 'Select at least one member' });
      return;
    }

    onCreateGroup({
      name: groupName.trim(),
      description: description.trim(),
      memberIds: selectedMembers.map(m => m.id),
      avatar: avatarFile || undefined
    });
  };

  const handleClose = () => {
    setStep('details');
    setGroupName('');
    setDescription('');
    setSelectedMembers([]);
    setSearchQuery('');
    setSearchResults([]);
    setAvatarFile(null);
    setAvatarPreview('');
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-muted-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-400 flex items-center justify-center">
              <Icon name="users" size={22} className="text-white" />
            </div>
            <div>
              <Typography variant="h5" weight="bold" className="text-muted-900">
                Create New Group
              </Typography>
              <Typography variant="caption" className="text-muted-500">
                Step {step === 'details' ? '1' : '2'} of 2: {step === 'details' ? 'Group Details' : 'Add Members'}
              </Typography>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="close" size={20} />}
            onClick={handleClose}
            disabled={isLoading}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 'details' ? (
            <div className="space-y-6">
              {/* Avatar upload */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-card">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Icon name="users" size={40} className="text-primary-600" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors shadow-card">
                    <Icon name="edit" size={16} className="text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                </div>
                <Typography variant="caption" className="text-muted-500 mt-2">
                  Click to upload group photo
                </Typography>
              </div>

              {/* Group name */}
              <Input
                label="Group Name"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value);
                  setErrors(prev => ({ ...prev, name: undefined }));
                }}
                error={errors.name}
                required
                disabled={isLoading}
                maxLength={50}
              />

              {/* Description */}
              <Textarea
                label="Description (Optional)"
                placeholder="What's this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={200}
                showCount
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Icon name="search" size={18} />}
                  disabled={isLoading}
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  </div>
                )}
              </div>

              {searchQuery && (
                <Typography variant="caption" className="text-muted-500">
                  {searching ? 'Searching...' : `Found ${searchResults.length} user${searchResults.length !== 1 ? 's' : ''}`}
                </Typography>
              )}

              {/* Selected Members */}
              {selectedMembers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Typography variant="body2" weight="semibold" className="text-muted-700">
                      Selected Members ({selectedMembers.length})
                    </Typography>
                    <button
                      onClick={() => setSelectedMembers([])}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-primary-50 rounded-xl">
                    {selectedMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center">
                              <Icon name="user" size={16} className="text-primary-600" />
                            </div>
                          )}
                          <div>
                            <Typography variant="body2" weight="medium">{member.name}</Typography>
                            <Typography variant="caption" className="text-muted-500">@{member.username}</Typography>
                          </div>
                        </div>
                        <button
                          onClick={() => removeMember(member.id)}
                          className="text-accent-600 hover:text-accent-700"
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errors.members && (
                <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
                  <Typography variant="body2" className="text-accent-700">
                    {errors.members}
                  </Typography>
                </div>
              )}

              {searchError && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Typography variant="body2" className="text-yellow-700">
                    {searchError}
                  </Typography>
                </div>
              )}

              {/* User list */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searching ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-3"></div>
                    <Typography variant="body2" className="text-muted-500">
                      Searching...
                    </Typography>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Icon name="search" size={48} className="text-muted-300 mb-3" />
                    <Typography variant="body1" className="text-muted-500">
                      No users found
                    </Typography>
                  </div>
                ) : (
                  searchResults.map(user => (
                    <UserCard
                      key={user.id}
                      {...user}
                      variant="compact"
                      isSelected={selectedMembers.some(m => m.id === user.id)}
                      onSelect={() => toggleMember(user)}
                      showActions={false}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-200">
          <Button
            variant="ghost"
            size="md"
            onClick={step === 'details' ? handleClose : () => setStep('details')}
            disabled={isLoading}
          >
            {step === 'details' ? 'Cancel' : 'Back'}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={step === 'details' ? handleNext : handleCreate}
            loading={isLoading}
            disabled={isLoading || (step === 'members' && selectedMembers.length === 0)}
          >
            {step === 'details' ? 'Next' : 'Create Group'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;