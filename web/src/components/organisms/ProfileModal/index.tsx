// src/components/organisms/ProfileModal.tsx
import React, { useState } from 'react';
import { Avatar, Button, Input, Textarea, Typography, Divider } from '../../atoms';
import Icon from '../../atoms/Icon';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    username?: string;
    email?: string;
    avatar?: string;
    bio?: string;
    phone?: string;
    joinedDate?: string;
  };
  stats?: {
    totalChats: number;
    totalGroups: number;
    totalExpenses: number;
    totalSettled: number;
  };
  onUpdateProfile?: (data: {
    name: string;
    username?: string;
    bio?: string;
    avatar?: File;
  }) => void;
  isEditing?: boolean;
  isLoading?: boolean;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  stats,
  onUpdateProfile,
  isEditing: initialEditing = false,
  isLoading = false
}) => {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatar || '');

  const [errors, setErrors] = useState<{ name?: string; username?: string }>({});

  // Define handlers BEFORE early return
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

  const handleSave = () => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (username && username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (onUpdateProfile) {
      onUpdateProfile({
        name: name.trim(),
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar: avatarFile || undefined
      });
    }

    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(user.name);
    setUsername(user.username || '');
    setBio(user.bio || '');
    setAvatarPreview(user.avatar || '');
    setAvatarFile(null);
    setErrors({});
    setIsEditing(false);
  };

  // NOW do the early return AFTER all hooks
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-lg w-full max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-20">
          {/* Background gradient */}
          <div className="absolute inset-0 h-32 bg-gradient-to-br from-primary-600 to-secondary-400 rounded-t-2xl" />
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="close" size={20} />}
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 z-10"
          />

          {/* Avatar */}
          <div className="relative flex justify-center mt-8">
            <div className="relative group">
              <Avatar
                src={avatarPreview}
                alt={name}
                size="2xl"
                className="ring-4 ring-white shadow-elevated"
              />
              {isEditing && (
                <label className="absolute bottom-0 right-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors shadow-card ring-4 ring-white">
                  <Icon name="edit" size={18} className="text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={isLoading}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {isEditing ? (
            <>
              {/* Edit mode */}
              <Input
                label="Name"
                placeholder="Your name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors(prev => ({ ...prev, name: undefined }));
                }}
                error={errors.name}
                required
                disabled={isLoading}
              />

              <Input
                label="Username"
                placeholder="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrors(prev => ({ ...prev, username: undefined }));
                }}
                error={errors.username}
                leftIcon={<span className="text-muted-500">@</span>}
                disabled={isLoading}
              />

              <Textarea
                label="Bio"
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={200}
                showCount
                disabled={isLoading}
              />
            </>
          ) : (
            <>
              {/* View mode */}
              <div className="text-center">
                <Typography variant="h4" weight="bold" className="text-muted-900 mb-1">
                  {user.name}
                </Typography>
                {user.username && (
                  <Typography variant="body1" className="text-muted-500 mb-3">
                    @{user.username}
                  </Typography>
                )}
                {user.bio && (
                  <Typography variant="body2" className="text-muted-600">
                    {user.bio}
                  </Typography>
                )}
              </div>

              <Divider />

              {/* User info */}
              <div className="space-y-3">
                {user.email && (
                  <div className="flex items-center gap-3 p-3 bg-muted-50 rounded-xl">
                    <Icon name="message" size={20} className="text-muted-500" />
                    <div className="flex-1 min-w-0">
                      <Typography variant="caption" className="text-muted-500">
                        Email
                      </Typography>
                      <Typography variant="body2" className="text-muted-900 truncate">
                        {user.email}
                      </Typography>
                    </div>
                  </div>
                )}

                {user.phone && (
                  <div className="flex items-center gap-3 p-3 bg-muted-50 rounded-xl">
                    <Icon name="phone" size={20} className="text-muted-500" />
                    <div className="flex-1 min-w-0">
                      <Typography variant="caption" className="text-muted-500">
                        Phone
                      </Typography>
                      <Typography variant="body2" className="text-muted-900">
                        {user.phone}
                      </Typography>
                    </div>
                  </div>
                )}

                {user.joinedDate && (
                  <div className="flex items-center gap-3 p-3 bg-muted-50 rounded-xl">
                    <Icon name="clock" size={20} className="text-muted-500" />
                    <div className="flex-1 min-w-0">
                      <Typography variant="caption" className="text-muted-500">
                        Joined
                      </Typography>
                      <Typography variant="body2" className="text-muted-900">
                        {user.joinedDate}
                      </Typography>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              {stats && (
                <>
                  <Divider />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-4 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl">
                      <Typography variant="h5" weight="bold" className="text-primary-700 mb-1">
                        {stats.totalChats}
                      </Typography>
                      <Typography variant="caption" className="text-primary-600">
                        Direct Chats
                      </Typography>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-br from-secondary-50 to-primary-50 rounded-xl">
                      <Typography variant="h5" weight="bold" className="text-secondary-600 mb-1">
                        {stats.totalGroups}
                      </Typography>
                      <Typography variant="caption" className="text-secondary-500">
                        Groups
                      </Typography>
                    </div>

                    <div className="text-center p-4 bg-accent-50 rounded-xl">
                      <Typography variant="h5" weight="bold" className="text-accent-600 mb-1">
                        {stats.totalExpenses}
                      </Typography>
                      <Typography variant="caption" className="text-accent-500">
                        Total Expenses
                      </Typography>
                    </div>

                    <div className="text-center p-4 bg-success-50 rounded-xl">
                      <Typography variant="h5" weight="bold" className="text-success-600 mb-1">
                        ${stats.totalSettled}
                      </Typography>
                      <Typography variant="caption" className="text-success-500">
                        Settled
                      </Typography>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-muted-200">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="md"
                onClick={handleCancel}
                disabled={isLoading}
                fullWidth
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                loading={isLoading}
                disabled={isLoading}
                fullWidth
              >
                Save Changes
              </Button>
            </>
          ) : (
            <>
              {onUpdateProfile && (
                <Button
                  variant="primary"
                  size="md"
                  icon={<Icon name="edit" size={18} />}
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                  fullWidth
                >
                  Edit Profile
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;