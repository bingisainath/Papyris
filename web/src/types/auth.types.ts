export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  identifier: string;  // Can be username OR email
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  expires_in?: number; // optional (if backend adds it)
}

// export interface UserResponse {
//   id: string;
//   username: string;
//   email: string;
//   is_active: boolean;
//   created_at: string;
// }


export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    token_type: string;
    refresh_token?: string;
  };
}

export interface UserResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    username: string;
    email: string;
    is_active: boolean;
    created_at: string;
    name?: string;
    avatar?: string;
    bio?: string;
  };
}

export interface JwtPayload {
  sub: string;
  exp: number;
  iat?: number;
  type?: string;
}
