
// src/app/AuthProvider.tsx - WITH WEBSOCKET INTEGRATION

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch } from "react-redux";
import { loginUser, registerUser, getMe } from "../api/auth.api";
import { UserResponse } from "../types/auth.types";
import { isTokenExpired, tokenStore } from "../utils/token";
import { parseApiError } from "../utils/apiError";
import { connectWebSocket, disconnectWebSocket } from "../redux/actions/websocketActions";
import { authService } from "../services/auth.service";

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

function unwrap<T>(res: any): ApiEnvelope<T> {
  if (res && typeof res === "object" && "success" in res)
    return res as ApiEnvelope<T>;
  return { success: true, data: res as T };
}

type AuthContextType = {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // login: (email: string, password: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (u: string, e: string, p: string) => Promise<void>;
  forgotPassword: (identifier: string) => Promise<void>;
  verifyResetToken: (token: string) => Promise<{ email: string; username: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();  // ✅ ADD: Redux dispatch

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(() => {
    // ✅ ADD: Disconnect WebSocket before logout
    console.log("[AUTH] 🔌 Disconnecting WebSocket...");
    dispatch(disconnectWebSocket());

    tokenStore.clear();
    setUser(null);
    setError(null);
    console.log("[AUTH] Logged out");
  }, [dispatch]);


  useEffect(() => {
    const init = async () => {
      try {
        const token = tokenStore.get();
        if (!token || isTokenExpired(token)) {
          logout();
          return;
        }

        const res = unwrap<UserResponse>(await getMe());
        if (!res.success || !res.data) {
          logout();
          return;
        }

        setUser(res.data);
        console.log("[AUTH] Session restored:", res.data.email);

        console.log("[AUTH] 🔌 Reconnecting WebSocket after refresh...");
        dispatch(connectWebSocket(token));

      } catch (err) {
        console.error("[AUTH] Session restore failed:", err);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [logout, dispatch]);

  const login = useCallback(
    async (identifier: string, password: string): Promise<void> => {
      setError(null);
      setIsLoading(true);

      console.log("[AUTH] Login attempt for:", identifier);

      try {
        // Validate inputs
        if (!identifier.trim()) throw new Error("Username or email is required");
        if (!password.trim()) throw new Error("Password is required");

        // ✅ CHANGED: Use identifier instead of email
        const res = unwrap<{ access_token: string; token_type: string }>(
          await loginUser({ identifier, password })
        );

        // Backend returned success=false
        if (!res.success) {
          throw new Error(res.message || "Login failed");
        }

        if (!res.data?.access_token) {
          throw new Error("No access token received");
        }

        tokenStore.set(res.data.access_token);

        // Fetch user profile
        const meRes = unwrap<UserResponse>(await getMe());
        if (!meRes.success || !meRes.data) {
          throw new Error(meRes.message || "Unable to fetch user profile");
        }

        setUser(meRes.data);
        setError(null);
        console.log("[AUTH] ✅ LOGIN SUCCESS:", meRes.data.email);

        // Connect WebSocket immediately after successful login
        console.log("[AUTH] 🔌 Connecting WebSocket...");
        dispatch(connectWebSocket(res.data.access_token));

      } catch (err) {
        const msg = parseApiError(err);
        setError(msg);
        console.error("[AUTH] ❌ LOGIN ERROR:", msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch]
  );

  const register = useCallback(
    async (username: string, email: string, password: string): Promise<void> => {
      setError(null);
      setIsLoading(true);

      try {
        // Validate inputs
        if (!username.trim()) throw new Error("Username is required");
        if (!email.trim()) throw new Error("Email is required");
        if (!password.trim()) throw new Error("Password is required");

        if (username.length < 3) {
          throw new Error("Username must be at least 3 characters");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("Please enter a valid email address");
        }

        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }

        const res = unwrap<UserResponse>(
          await registerUser({ username, email, password })
        );

        if (!res.success) {
          throw new Error(res.message || "Registration failed");
        }

        setError(null);
        console.log("[AUTH] ✅ REGISTER SUCCESS:", res.data?.email ?? email);

        // Note: No WebSocket connection here - user needs to login first

      } catch (err) {
        const msg = parseApiError(err);
        setError(msg);
        console.error("[AUTH] ❌ REGISTER ERROR:", msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const forgotPassword = useCallback(
    async (identifier: string): Promise<void> => {
      setError(null);
      setIsLoading(true);
      try {
        if (!identifier.trim()) {
          throw new Error("Username or email is required");
        }

        console.log('forget password called : ', identifier);

        const response = await authService.forgotPassword(identifier);

        if (!response.success) {
          throw new Error(response.message || "Failed to send reset email");
        }

        console.log("[AUTH] ✅ Password reset email sent");

      } catch (err) {
        const msg = parseApiError(err);
        setError(msg);
        console.error("[AUTH] ❌ FORGOT PASSWORD ERROR:", msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const verifyResetToken = useCallback(
    async (token: string): Promise<{ email: string; username: string }> => {
      setError(null);
      setIsLoading(true);

      try {
        const response = await authService.verifyResetToken(token);

        if (!response.success || !response.data) {
          throw new Error(response.message || "Invalid or expired token");
        }

        console.log("[AUTH] ✅ Token verified");
        return {
          email: response.data.email,
          username: response.data.username
        };

      } catch (err) {
        const msg = parseApiError(err);
        setError(msg);
        console.error("[AUTH] ❌ VERIFY TOKEN ERROR:", msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string): Promise<void> => {
      setError(null);
      setIsLoading(true);

      try {
        if (!newPassword.trim()) {
          throw new Error("Password is required");
        }

        if (newPassword.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }

        const response = await authService.resetPassword(token, newPassword);

        if (!response.success) {
          throw new Error(response.message || "Failed to reset password");
        }

        console.log("[AUTH] ✅ Password reset successful");

      } catch (err) {
        const msg = parseApiError(err);
        setError(msg);
        console.error("[AUTH] ❌ RESET PASSWORD ERROR:", msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      register,
      logout,
      clearError,
      forgotPassword,    
      verifyResetToken,    
      resetPassword,        
    }),
    [user, isLoading, error, login, register, logout, clearError, forgotPassword, verifyResetToken, resetPassword]
  );

return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};