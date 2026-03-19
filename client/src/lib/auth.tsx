import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";

interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string, source?: string, campaign?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// In-memory token store (no localStorage in sandboxed iframe)
let storedToken: string | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setAuth = useCallback((newToken: string, newUser: AuthUser) => {
    storedToken = newToken;
    setToken(newToken);
    setUser(newUser);
  }, []);

  // Try to restore session on mount
  useEffect(() => {
    if (storedToken) {
      apiRequest("GET", "/api/auth/me")
        .then(res => res.json())
        .then(data => {
          setUser(data);
          setToken(storedToken);
        })
        .catch(() => {
          storedToken = null;
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    setAuth(data.token, data.user);
  }, [setAuth]);

  const signup = useCallback(async (email: string, password: string, displayName?: string, source?: string, campaign?: string) => {
    const res = await apiRequest("POST", "/api/auth/signup", {
      email,
      password,
      displayName,
      source,
      campaign,
    });
    const data = await res.json();
    setAuth(data.token, data.user);
  }, [setAuth]);

  const logout = useCallback(() => {
    storedToken = null;
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// Patch apiRequest to include auth header
const originalApiRequest = apiRequest;

// We need to monkey-patch the fetch in queryClient to include auth
// Instead, we'll export an authed fetcher
export async function authedRequest(method: string, url: string, data?: unknown) {
  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}
