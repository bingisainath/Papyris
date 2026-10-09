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
    email_verified?: boolean;
    payment_handles?: PaymentHandles | null;
  };
}

/** Where people in your chats can pay you (usernames only; Papyris never moves money). */
export interface PaymentHandles {
  revolut?: string; // revolut.me/<name>
  paypal?: string; // paypal.me/<name>
  upi?: string; // name@bank (India)
}

export interface JwtPayload {
  sub: string;
  exp: number;
  iat?: number;
  type?: string;
}


/** The user object inside UserResponse.data (what AuthProvider keeps as `user`) */
export type User = UserResponse['data'];
