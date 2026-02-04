// src/types/user.types.ts

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  name?: string;
  bio?: string;
  created_at: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface BlockedUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  blocked_at: string;
}

export interface UpdateProfileData {
  username?: string;
  bio?: string;
  avatar?: string;
}