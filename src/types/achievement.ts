// Conquista de um jogo da biblioteca, no formato devolvido por GET /games/:gameId/achievements.
export type Achievement = {
  id: string;
  title: string;
  description: string | null;
  xp: number;
  unlocked: boolean;
  unlockedAt: string | null;
};

// Resumo devolvido por GET /games/:gameId/achievements/progress.
export type AchievementProgress = {
  unlocked: number;
  total: number;
  percent: number;
  xp: number;
  totalXp: number;
};
