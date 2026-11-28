import { Platform } from "react-native";

export type ApiErrorKind = "http" | "network" | "configuration" | "invalid-response";
export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly kind: ApiErrorKind = "http") {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  authenticated?: boolean;
  token?: string | null;
  transport?: "cookie" | "bearer";
  notifyUnauthorized?: boolean;
  retried?: boolean;
};

type ClientOptions = { platform?: "web" | "native"; baseUrl?: string; fetcher?: typeof fetch };

export class ApiClient {
  readonly isWeb: boolean;
  private revision = 0;
  private token: string | null = null;
  private listeners = new Set<(revision: number) => void>();
  private refresher: (() => Promise<boolean>) | null = null;

  constructor(private readonly options: ClientOptions = {}) {
    this.isWeb = (options.platform ?? (Platform.OS === "web" ? "web" : "native")) === "web";
  }
  get sessionRevision() { return this.revision; }
  replaceSession(token: string | null): number {
    this.token = this.isWeb ? null : token;
    return ++this.revision;
  }
  // Renova o access token sem trocar de sessão (a revisão não muda, então 401 antigos continuam ignorados).
  setAccessToken(token: string | null): void {
    if (!this.isWeb) this.token = token;
  }
  // Chamado em um 401 de requisição autenticada; se devolver true, a requisição é repetida uma vez.
  setRefresher(refresher: (() => Promise<boolean>) | null): void {
    this.refresher = refresher;
  }
  onUnauthorized(listener: (revision: number) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const revision = this.revision;
    const authenticated = options.authenticated !== false;
    const token = options.token === undefined ? this.token : options.token;
    const url = this.requestUrl(path);
    const headers: Record<string, string> = { Accept: "application/json" };
    // FormData define o próprio Content-Type (com o boundary) e não passa por JSON.
    const form = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (options.body !== undefined && !form) headers["Content-Type"] = "application/json";
    if (options.transport) headers["X-Auth-Transport"] = options.transport;
    if (!this.isWeb && authenticated && token) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await (this.options.fetcher ?? fetch)(url, {
        method: options.method ?? "GET", headers,
        body: options.body === undefined ? undefined : form ? (options.body as FormData) : JSON.stringify(options.body),
        credentials: this.isWeb ? "include" : "omit",
        redirect: "error", signal: options.signal,
      });
    } catch (error) {
      this.checkCancellation(error, options.signal);
      throw new ApiError(0, "Não foi possível conectar à API. Tente novamente.", "network");
    }
    if (response.status === 204) return undefined as T;
    let body: unknown;
    try { body = await response.json(); } catch (error) {
      this.checkCancellation(error, options.signal);
      if (response.ok) throw new ApiError(response.status, "A API retornou uma resposta inválida.", "invalid-response");
    }
    if (!response.ok) {
      if (response.status === 401 && authenticated && !options.retried && options.token === undefined
        && this.refresher && await this.refresher()) {
        return this.request<T>(path, { ...options, retried: true });
      }
      if (response.status === 401 && authenticated && options.notifyUnauthorized !== false) {
        for (const listener of this.listeners) listener(revision);
      }
      const message = body && typeof body === "object" && "message" in body ? body.message : undefined;
      const usefulMessage = typeof message === "string" ? message
        : Array.isArray(message) ? message.filter((item): item is string => typeof item === "string").join(" ") : "";
      throw new ApiError(response.status, usefulMessage || "Não foi possível concluir a solicitação.");
    }
    return body as T;
  }

  private checkCancellation(error: unknown, signal?: AbortSignal): void {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      const cancelled = new Error("Solicitação cancelada.");
      cancelled.name = "AbortError";
      throw cancelled;
    }
  }

  private requestUrl(path: string): string {
    const base = this.options.baseUrl ?? process.env.EXPO_PUBLIC_API_URL;
    if (!base) throw new ApiError(0, "Configure EXPO_PUBLIC_API_URL para conectar à API.", "configuration");
    let parsed: URL;
    try { parsed = new URL(base); } catch { throw new ApiError(0, "A URL da API é inválida.", "configuration"); }
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash
      || (!__DEV__ && parsed.protocol !== "https:")) {
      throw new ApiError(0, "A URL da API é inválida. Use HTTPS em produção.", "configuration");
    }
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
      throw new ApiError(0, "O caminho da API é inválido.", "configuration");
    }
    return base.replace(/\/+$/, "") + path;
  }
}

export const apiClient = new ApiClient();
export function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return apiClient.request<T>(path, options);
}
