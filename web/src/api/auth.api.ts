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