// src/types/group.types.ts

export interface GroupMember {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member';
  is_online: boolean;
}

export interface GroupSettings {
  only_admins_can_message: boolean;
  only_admins_can_add_members: boolean;
  send_message_notification: boolean;
}

export interface GroupDetails {
  id: string;
  name: string;
  avatar?: string;
  created_at: string;
  members: GroupMember[];
  admins: string[];
  member_count: number;
  settings: GroupSettings;
  current_user_role: 'admin' | 'member';
}

export interface UpdateGroupSettingsData {
  only_admins_can_message?: boolean;
  only_admins_can_add_members?: boolean;
  send_message_notification?: boolean;
}