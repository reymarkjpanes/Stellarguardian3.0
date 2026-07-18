import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchApi } from "../lib/api";

type User = {
  id: number;
  name: string;
  email: string;
  walletAddress: string | null;
  isAdmin: number;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /**
   * Persist tokens and set user state after a successful login/signup.
   * Accepts both tokens so the refresh flow works correctly.
   * Design: accessToken is short-lived (15m), refreshToken is long-lived (30d).
   * Future: this will also accept provider-specific metadata (SEP-10, OAuth, etc.).
   */
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Token storage keys ───────────────────────────────────────────────────────
// Access token: short-lived, used for API calls (Bearer header).
// Refresh token: long-lived, stored separately, sent only to /auth/refresh.
const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) {
        const data = await fetchApi("/auth/me");
        // The modular authRouter returns { data: { user } }
        setUser(data.data.user);
      }
    } catch (e) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (accessToken: string, refreshToken: string, user: User) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setUser(user);
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      await fetchApi("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch (e) {
      // Ignore errors on logout, just proceed with local cleanup
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
