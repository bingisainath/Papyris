import api from "../utils/axios";
import {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  UserResponse,
} from "../types/auth.types";

export async function registerUser(
  payload: RegisterPayload
): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>(
    "/api/v1/auth/register",
    payload
  );
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(
    "/api/v1/auth/login",
    payload
  );
  return data;
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>("/api/v1/auth/me");
  return data;
}

export interface ProfileUpdate {
  name?: string;
  username?: string;
  bio?: string;
  avatar?: string; // uploaded image URL, or "" to remove
}

export async function updateMe(payload: ProfileUpdate): Promise<UserResponse> {
  const { data } = await api.patch<UserResponse>("/api/v1/auth/me", payload);
  return data;
}

export async function verifyEmailCode(payload: { identifier: string; code: string }): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/v1/auth/verify-email", payload);
  return data;
}

export async function resendVerificationCode(payload: { identifier: string }): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.post("/api/v1/auth/resend-code", payload);
  return data;
}
