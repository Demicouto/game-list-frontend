import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AuthState, LoginInput, RegisterInput, RegistrationResponse } from "../types/auth";
import { apiClient } from "../services/api";
import { authApi } from "../services/auth-api";
import { sessionStorage } from "../services/session-storage";
import { AuthSession } from "../services/auth-session";
import { AppState, Platform } from "react-native";

const SESSION_CHANGE_KEY = "gamelist.auth.changed";
function announceWebSessionChange() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try { window.localStorage.setItem(SESSION_CHANGE_KEY, `${Date.now()}:${Math.random()}`); }
  catch { /* Focus revalidation also works when browser storage is unavailable. */ }
}

type AuthContextValue = AuthState & {
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<RegistrationResponse>;
  logout(): Promise<void>;
  retryRestore(): Promise<void>;
  retryCleanup(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => new AuthSession(apiClient, authApi, sessionStorage));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => session.start(), [session]);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const restore = () => { void session.retryRestore(); };
    const focused = () => {
      // Keep partially filled anonymous forms mounted when switching windows.
      if (session.getSnapshot().status !== "anonymous") restore();
    };
    const changed = (event: StorageEvent) => {
      if (event.key === SESSION_CHANGE_KEY || event.key === null) restore();
    };
    window.addEventListener("focus", focused);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("focus", focused);
      window.removeEventListener("storage", changed);
    };
  }, [session]);
  useEffect(() => {
    if (state.status !== 'authenticated' || !state.expiresAt) return;
    const expiresAt = Date.parse(state.expiresAt);
    // O access token dura 15 minutos: renova 1 minuto antes. O piso de 30 s evita um laço de
    // requisições quando o relógio do aparelho está adiantado em relação ao servidor.
    const timer = setTimeout(() => { void session.renewInBackground(); }, Math.max(expiresAt - Date.now() - 60000, 30000));
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active' && expiresAt - Date.now() < 60000) void session.renewInBackground();
    });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [session, state.status, state.expiresAt, state.revision]);
  const actions = useMemo(() => ({
    login: async (input: LoginInput) => { await session.login(input); announceWebSessionChange(); },
    logout: async () => { await session.logout(); announceWebSessionChange(); },
  }), [session]);
  const value = useMemo<AuthContextValue>(() => ({
    ...state, ...actions, register: session.register,
    retryRestore: session.retryRestore, retryCleanup: session.retryCleanup,
  }), [state, session, actions]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro do AuthProvider.");
  return context;
}
