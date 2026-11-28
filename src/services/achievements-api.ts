import { ApiError, apiClient, type ApiClient } from "./api";
import type { Achievement, AchievementProgress } from "../types/achievement";

function invalid(): never { throw new ApiError(502, "A API retornou dados de conquistas inválidos.", "invalid-response"); }
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function count(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : invalid();
}

function mapAchievement(value: unknown): Achievement {
  if (!record(value) || typeof value.id !== "string" || !value.id || typeof value.title !== "string"
    || !(value.description === null || value.description === undefined || typeof value.description === "string")
    || typeof value.unlocked !== "boolean"
    || !(value.unlockedAt === null || typeof value.unlockedAt === "string" && Number.isFinite(Date.parse(value.unlockedAt)))) return invalid();
  return {
    id: value.id, title: value.title, description: (value.description as string | null | undefined) || null,
    xp: count(value.xp), unlocked: value.unlocked, unlockedAt: value.unlockedAt as string | null,
  };
}

function mapProgress(value: unknown): AchievementProgress {
  if (!record(value)) return invalid();
  return {
    unlocked: count(value.unlocked), total: count(value.total), percent: count(value.percent),
    xp: count(value.xp), totalXp: count(value.totalXp),
  };
}

export function createAchievementsApi(client: Pick<ApiClient, "request">) {
  const path = (gameId: string) => `/games/${encodeURIComponent(gameId)}/achievements`;
  return {
    async list(gameId: string, signal?: AbortSignal) {
      const value = await client.request<unknown>(path(gameId), { signal });
      if (!Array.isArray(value)) return invalid();
      return value.map(mapAchievement);
    },
    async progress(gameId: string, signal?: AbortSignal) {
      return mapProgress(await client.request<unknown>(`${path(gameId)}/progress`, { signal }));
    },
    // Idempotente no back: marcar de novo mantém a data original.
    async unlock(gameId: string, achievementId: string) {
      return mapAchievement(await client.request<unknown>(`${path(gameId)}/${encodeURIComponent(achievementId)}`, { method: "PUT" }));
    },
    async lock(gameId: string, achievementId: string) {
      await client.request<void>(`${path(gameId)}/${encodeURIComponent(achievementId)}`, { method: "DELETE" });
    },
  };
}

export const achievementsApi = createAchievementsApi(apiClient);
