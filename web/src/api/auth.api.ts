// import api from "../utils/axios";
// import { LoginPayload, LoginResponse, RegisterPayload, UserResponse } from "../types/auth.types";

// export async function registerUser(payload: RegisterPayload): Promise<UserResponse> {
//   const { data } = await api.post<UserResponse>("/api/v1/auth/register", payload);
//   return data;
// }

// export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
//   const { data } = await api.post<LoginResponse>("/api/v1/auth/login", payload);
//   return data;
// }

// // Optional but recommended backend endpoint
// export async function getMe(): Promise<UserResponse> {
//   const { data } = await api.get<UserResponse>("/api/v1/auth/me");
//   return data;
// }

import api from "../utils/axios";
import {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  UserResponse,
} from "../types/auth.types";

// Small helper: if backend returned JSON even on 4xx, return it.
// Otherwise rethrow (network/CORS/etc).
function returnBackendError<T>(err: any): T {
  if (err?.response?.data) return err.response.data as T;
  throw err;
}

export async function registerUser(
  payload: RegisterPayload
): Promise<UserResponse> {
  try {
    const { data } = await api.post<UserResponse>(
      "/api/v1/auth/register",
      payload
    );
    return data;
  } catch (err: any) {
    return returnBackendError<UserResponse>(err);
  }
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  try {
    const { data } = await api.post<LoginResponse>(
      "/api/v1/auth/login",
      payload
    );
    setTimeout(() => {
      console.log("api data : " + data);
    }, 2000);

    return data;
  } catch (err: any) {
    // ✅ handles 401 Unauthorized and returns: { success:false, message:"Invalid credentials", data:null }
    return returnBackendError<LoginResponse>(err);
  }
}

// Optional but recommended backend endpoint
export async function getMe(): Promise<UserResponse> {
  try {
    const { data } = await api.get<UserResponse>("/api/v1/auth/me");
    return data;
  } catch (err: any) {
    return returnBackendError<UserResponse>(err);
  }
}
