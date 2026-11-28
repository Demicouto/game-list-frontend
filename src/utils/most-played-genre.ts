import type { Game } from '../types/game';

// Gênero que mais aparece na biblioteca; no empate, vence o do jogo adicionado primeiro.
export function mostPlayedGenre(games: Game[]): string | null {
  const genres = new Map<string, { count: number; firstAddedAt: string }>();
  for (const game of games) {
    const genre = game.genre?.trim();
    if (!genre) continue;
    const entry = genres.get(genre);
    if (!entry) genres.set(genre, { count: 1, firstAddedAt: game.createdAt });
    else {
      entry.count += 1;
      if (game.createdAt < entry.firstAddedAt) entry.firstAddedAt = game.createdAt;
    }
  }
  let best: { genre: string; count: number; firstAddedAt: string } | null = null;
  for (const [genre, entry] of genres) {
    if (!best || entry.count > best.count || (entry.count === best.count && entry.firstAddedAt < best.firstAddedAt)) {
      best = { genre, ...entry };
    }
  }
  return best?.genre ?? null;
}
