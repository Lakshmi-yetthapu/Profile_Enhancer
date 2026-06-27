import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api, { tokenStore } from "@/lib/api";
import type { TokenPair, User } from "@/types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/api/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  function persist(data: TokenPair) {
    tokenStore.set(data.access_token, data.refresh_token);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const { data } = await api.post<TokenPair>("/api/auth/login", { email, password });
    persist(data);
  }

  async function register(email: string, password: string, fullName: string) {
    const { data } = await api.post<TokenPair>("/api/auth/register", {
      email,
      password,
      full_name: fullName,
    });
    persist(data);
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
