import { ApiError, type ApiClient } from "./api";
import type { AuthApi } from "./auth-api";
import type { SessionStorage } from "./session-storage";
import type { AuthState, LoginInput, RegisterInput } from "../types/auth";

export class AuthSession {
  private state: AuthState;
  private listeners = new Set<() => void>();
  private active = false;
  private operation = 0;
  private token: string | null = null; // access token (JWT), só em memória
  private refreshToken: string | null = null; // persistido no app nativo; na Web vai em cookie
  private refreshing: Promise<boolean> | null = null;
  private controller: AbortController | null = null;
  private mutation = false;
  private storageQueue: Promise<unknown> = Promise.resolve();
  constructor(private readonly client: ApiClient, private readonly api: AuthApi, private readonly storage: SessionStorage) {
    this.state = { status: "checking", user: null, expiresAt: null, revision: client.sessionRevision, error: null, cleanupPending: false };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  start = (): (() => void) => {
    this.active = true;
    this.client.setRefresher(this.refresh);
    const unsubscribe = this.client.onUnauthorized((revision) => {
      if (!this.mutation) void this.invalidate(revision);
    });
    void this.retryRestore();
    return () => {
      this.active = false;
      ++this.operation;
      this.controller?.abort();
      unsubscribe();
      this.client.setRefresher(null);
      this.client.replaceSession(null);
      this.token = null;
      this.refreshToken = null;
    };
  };

  retryRestore = async (): Promise<void> => {
    if (!this.active || this.mutation) return;
    const operation = ++this.operation;
    this.controller?.abort();
    this.controller = new AbortController();
    this.replaceSession(this.token, { status: "checking", user: null, expiresAt: null, error: null });
    try {
      if (!this.client.isWeb) {
        if (this.state.cleanupPending) {
          await this.queueStorage(() => this.storage.clear());
          if (!this.current(operation)) return;
          this.update({ cleanupPending: false });
        }
        const stored = await this.queueStorage(() => this.storage.read());
        if (!this.current(operation)) return;
        this.refreshToken = stored;
        if (!stored) {
          this.replaceSession(null, { status: "anonymous" });
          return;
        }
        // O access token não é guardado: cada abertura do app começa renovando a sessão.
        const renewed = await this.refresh();
        if (!this.current(operation)) return;
        if (!renewed) {
          await this.invalidate(this.state.revision);
          return;
        }
      }
      const session = await this.api.me(this.controller.signal);
      if (this.current(operation)) this.update({ status: "authenticated", ...session, error: null });
    } catch (error) {
      if (!this.current(operation)) return;
      if (error instanceof ApiError && error.status === 401) await this.invalidate(this.state.revision);
      else this.update({ status: "restore-error", error: "Não foi possível restaurar sua sessão. Tente novamente." });
    }
  };
  retryCleanup = async (): Promise<void> => {
    if (!this.active || !this.state.cleanupPending || this.client.isWeb) return;
    const operation = this.beginMutation();
    try {
      await this.queueStorage(() => this.storage.clear());
      if (this.current(operation)) this.update({ cleanupPending: false, error: null });
    } catch {
      const error = new ApiError(0, "Não foi possível limpar a sessão do dispositivo. Tente novamente.");
      if (this.current(operation)) this.update({ error: error.message });
      throw error;
    } finally {
      this.mutation = false;
    }
  };
  login = async (input: LoginInput): Promise<void> => {
    const operation = this.beginMutation();
    const previousToken = this.refreshToken;
    try {
      const result = await this.api.login(input, this.controller!.signal);
      if (!this.current(operation)) {
        await this.revokeUnused(result.refreshToken);
        throw this.cancelled();
      }
      if (!this.client.isWeb) {
        const token = result.refreshToken;
        if (!token || !result.accessToken) throw new ApiError(502, "A API não retornou uma sessão válida.", "invalid-response");
        try {
          await this.queueStorage(() => this.storage.write(token));
        } catch {
          await this.revokeUnused(token);
          try {
            await this.queueStorage(() => previousToken ? this.storage.write(previousToken) : this.storage.clear());
          } catch {
            if (this.current(operation)) this.replaceSession(null, {
              status: "anonymous", user: null, expiresAt: null, cleanupPending: true,
            });
          }
          throw new ApiError(0, "Não foi possível salvar a sessão com segurança. Tente novamente.");
        }
      }
      if (!this.current(operation)) {
        await this.revokeUnused(result.refreshToken);
        throw this.cancelled();
      }
      this.refreshToken = result.refreshToken ?? null;
      this.replaceSession(result.accessToken ?? null, {
        status: "authenticated", user: result.user, expiresAt: result.expiresAt, cleanupPending: false, error: null,
      });
    } catch (error) {
      if (this.current(operation)) this.update({
        status: this.state.status === "checking" ? "restore-error" : this.state.status,
        error: error instanceof ApiError ? error.message : "Não foi possível entrar. Tente novamente.",
      });
      throw error;
    } finally {
      this.mutation = false;
    }
  };
  logout = async (): Promise<void> => {
    const operation = this.beginMutation();
    try {
      await this.api.logout(this.refreshToken ?? undefined, this.controller!.signal);
      if (!this.current(operation)) return;
      this.refreshToken = null;
      this.replaceSession(null, {
        status: "anonymous", user: null, expiresAt: null, error: null, cleanupPending: !this.client.isWeb,
      });
      if (!this.client.isWeb) {
        try {
          await this.queueStorage(() => this.storage.clear());
        } catch {
          throw new ApiError(0, "Não foi possível limpar a sessão do dispositivo. Tente novamente.");
        }
      }
      if (this.current(operation)) this.update({ cleanupPending: false });
    } catch (error) {
      if (this.current(operation)) this.update({
        status: this.state.status === "checking" ? "restore-error" : this.state.status,
        error: error instanceof ApiError ? error.message : "Não foi possível sair. Tente novamente.",
      });
      throw error;
    } finally {
      this.mutation = false;
    }
  };
  register = (input: RegisterInput) => this.api.register(input);

  // Troca o refresh token por um par novo. Várias chamadas simultâneas compartilham uma só renovação.
  // Devolve false quando a API recusa (sessão encerrada) e lança em falhas de rede.
  refresh = (): Promise<boolean> => {
    this.refreshing ??= this.renew().finally(() => { this.refreshing = null; });
    return this.refreshing;
  };

  // Renovação silenciosa antes de o access token vencer, sem desmontar as telas.
  renewInBackground = async (): Promise<void> => {
    if (!this.active || this.mutation || this.state.status !== "authenticated") return;
    try {
      if (!(await this.refresh())) await this.invalidate(this.state.revision);
    } catch { /* Falha de rede: a próxima requisição tenta renovar de novo. */ }
  };

  private async renew(): Promise<boolean> {
    const revision = this.state.revision;
    try {
      if (this.client.isWeb) {
        const { expiresAt } = await this.api.refresh();
        if (revision === this.state.revision) this.update({ expiresAt });
        return true;
      }
      if (!this.refreshToken) return false;
      const tokens = await this.api.refresh(this.refreshToken);
      if (revision !== this.state.revision || !tokens.accessToken || !tokens.refreshToken) return false;
      this.token = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.client.setAccessToken(tokens.accessToken);
      this.update({ expiresAt: tokens.expiresAt });
      // O refresh token antigo já foi consumido; se o armazenamento falhar, a sessão segue em memória até fechar o app.
      await this.queueStorage(() => this.storage.write(tokens.refreshToken!)).catch(() => undefined);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return false;
      throw error;
    }
  }

  private beginMutation(): number {
    if (!this.active) throw new Error("A autenticação não está disponível.");
    if (this.mutation) throw new Error("Aguarde a operação atual.");
    this.mutation = true;
    const operation = ++this.operation;
    this.controller?.abort();
    this.controller = new AbortController();
    this.replaceSession(this.token, { error: null });
    return operation;
  }

  private cancelled(): Error {
    const error = new Error("Operação cancelada.");
    error.name = "AbortError";
    return error;
  }

  private async revokeUnused(token?: string) {
    if (this.client.isWeb || !token) return;
    try { await this.api.logout(token); } catch { /* A falha não pode transformar o login em sucesso. */ }
  }

  private current(operation: number) { return this.active && operation === this.operation; }

  private update(patch: Partial<AuthState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private replaceSession(token: string | null, patch: Partial<AuthState>) {
    this.token = this.client.isWeb ? null : token;
    const revision = this.client.replaceSession(this.token);
    this.update({ ...patch, revision });
  }

  private queueStorage<T>(action: () => Promise<T>): Promise<T> {
    const result = this.storageQueue.then(action);
    this.storageQueue = result.catch(() => undefined);
    return result;
  }

  private async invalidate(revision: number) {
    if (!this.active || revision !== this.state.revision) return;
    ++this.operation;
    this.controller?.abort();
    this.refreshToken = null;
    this.replaceSession(null, {
      status: "anonymous", user: null, expiresAt: null, error: null, cleanupPending: !this.client.isWeb,
    });
    const cleanupRevision = this.state.revision;
    if (this.client.isWeb) return;
    try {
      await this.queueStorage(() => this.storage.clear());
      if (this.active && this.state.revision === cleanupRevision) this.update({ cleanupPending: false });
    } catch {
      if (this.active && this.state.revision === cleanupRevision) {
        this.update({ cleanupPending: true, error: "Não foi possível limpar a sessão do dispositivo. Tente novamente." });
      }
    }
  }
}
