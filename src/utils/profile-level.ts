// Regra do nível da conta: a cada 7 conquistas desbloqueadas (somando todos os jogos), sobe 1 nível.
// Se o back passar a calcular o nível, basta trocar este arquivo.
export const ACHIEVEMENTS_PER_LEVEL = 7;

const TITLES: { from: number; title: string }[] = [
  { from: 20, title: "Mítico" },
  { from: 15, title: "Triunfante" },
  { from: 10, title: "Mestre dos Reinos" },
  { from: 6, title: "Veterano" },
  { from: 3, title: "Explorador" },
  { from: 1, title: "Novato" },
];

export type ProfileLevel = {
  level: number;
  title: string;
  // Conquistas já feitas dentro do nível atual e quantas o nível exige (sempre 7).
  current: number;
  needed: number;
};

export function profileLevel(unlockedAchievements: number): ProfileLevel {
  const total = Math.max(0, Math.floor(unlockedAchievements));
  const level = Math.floor(total / ACHIEVEMENTS_PER_LEVEL) + 1;
  const title = TITLES.find(item => level >= item.from)?.title ?? "Novato";
  return { level, title, current: total % ACHIEVEMENTS_PER_LEVEL, needed: ACHIEVEMENTS_PER_LEVEL };
}
