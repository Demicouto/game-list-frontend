import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { achievementsApi } from "../services/achievements-api";
import type { AchievementProgress } from "../types/achievement";
import type { Game } from "../types/game";

export type AccountAchievements = {
  loading: boolean;
  // Total desbloqueado somando todos os jogos.
  unlocked: number;
  // Jogos com pelo menos uma conquista desbloqueada.
  gamesWithUnlocks: number;
  // Jogos com todas as conquistas desbloqueadas.
  completedGames: number;
  byGame: Record<string, AchievementProgress>;
};

const EMPTY: AccountAchievements = { loading: true, unlocked: 0, gamesWithUnlocks: 0, completedGames: 0, byGame: {} };

// O back só informa o progresso jogo a jogo, então somamos aqui. Recarrega sempre que a tela volta ao foco.
// Um jogo cujo progresso falhar fica de fora da soma, em vez de derrubar a tela.
export function useAccountAchievements(games: Game[]): AccountAchievements {
  const [state, setState] = useState<AccountAchievements>(EMPTY);
  const ids = games.map(game => game.id).join(",");

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const list = ids ? ids.split(",") : [];
    setState(previous => ({ ...previous, loading: true }));
    void Promise.allSettled(list.map(id => achievementsApi.progress(id, controller.signal).then(value => [id, value] as const)))
      .then(results => {
        if (controller.signal.aborted) return;
        const byGame: Record<string, AchievementProgress> = {};
        for (const result of results) if (result.status === "fulfilled") byGame[result.value[0]] = result.value[1];
        const values = Object.values(byGame);
        setState({
          loading: false,
          unlocked: values.reduce((sum, item) => sum + item.unlocked, 0),
          gamesWithUnlocks: values.filter(item => item.unlocked > 0).length,
          completedGames: values.filter(item => item.total > 0 && item.unlocked === item.total).length,
          byGame,
        });
      });
    return () => controller.abort();
  }, [ids]));

  return state;
}
