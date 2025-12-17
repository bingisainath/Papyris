export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  expires_in?: number; // optional (if backend adds it)
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface JwtPayload {
  sub: string;
  exp: number;
  iat?: number;
  type?: string;
}
