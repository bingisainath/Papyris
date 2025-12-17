import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loginUser, registerUser, getMe } from "../api/auth.api";
import { UserResponse } from "../types/auth.types";
import { isTokenExpired, tokenStore } from "../utils/token";
import { parseApiError } from "../utils/apiError";

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

// works with BOTH:
// - old backend: Token/UserResponse directly
// - new backend: { success, message, data }
function unwrap<T>(res: any): ApiEnvelope<T> {
  if (res && typeof res === "object" && "success" in res)
    return res as ApiEnvelope<T>;
  return { success: true, data: res as T };
}

type AuthContextType = {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (u: string, e: string, p: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    console.log("[AUTH] Logged out");
  }, []);

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
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const res = unwrap<{ access_token: string; token_type: string }>(
          await loginUser({ email, password })
        );

        // If backend returned success=false (rare, because errors usually throw)
        if (!res.success) {
          throw new Error(res.message || "Login failed");
        }

        if (!res.data?.access_token) {
          throw new Error("No access token received");
        }

        tokenStore.set(res.data.access_token);

        // fetch /me to set user
        const meRes = unwrap<UserResponse>(await getMe());
        if (!meRes.success || !meRes.data) {
          throw new Error(meRes.message || "Unable to fetch user profile");
        }

        setUser(meRes.data);
        console.log("[AUTH] LOGIN SUCCESS:", meRes.data.email);
        return true;
      } catch (err) {
        const msg = parseApiError(err); // "Email does not exist" / "Invalid credentials"
        console.log("[AUTH] LOGIN ERROR:", msg);
        throw new Error(msg);
      }
    },
    []
  );

  const register = useCallback(
    async (u: string, e: string, p: string): Promise<boolean> => {
      try {
        const res = unwrap<UserResponse>(
          await registerUser({ username: u, email: e, password: p })
        );

        if (!res.success) {
          throw new Error(res.message || "Registration failed");
        }

        console.log("[AUTH] REGISTER SUCCESS:", res.data?.email ?? e);
        return true;
      } catch (err) {
        const msg = parseApiError(err); // "Email already registered" etc
        console.log("[AUTH] REGISTER ERROR:", msg);
        throw new Error(msg);
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
