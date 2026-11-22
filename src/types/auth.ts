export type PublicUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  createdAt: string;
};

export type RegisterInput = { name: string; username: string; email: string; password: string };
export type LoginInput = { identifier: string; password: string };
export type SessionResponse = { user: PublicUser; expiresAt: string };
export type LoginResponse = SessionResponse & { accessToken?: string; refreshToken?: string };
// No app nativo a API devolve os dois tokens; na Web a renovação usa cookies e só vem expiresAt.
export type RefreshResponse = { expiresAt: string; accessToken?: string; refreshToken?: string };
export type RegistrationResponse = { message: string };
export type AuthStatus = "checking" | "authenticated" | "anonymous" | "restore-error";

export type AuthState = {
  status: AuthStatus;
  user: PublicUser | null;
  expiresAt: string | null;
  revision: number;
  error: string | null;
  cleanupPending: boolean;
};
