import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, BOTTOM_NAV_SPACE } from '../../components/BottomNav';
import { GamesFeedback } from '../../components/GamesFeedback';
import { useAuth } from '../../context/AuthContext';
import { useGames } from '../../context/GamesContext';
import type { Game } from '../../types/game';

// Gênero que mais aparece na biblioteca; no empate, vence o do jogo adicionado primeiro.
function mostPlayedGenre(games: Game[]): string | null {
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

export default function ProfilePage() {
  const { user } = useAuth();
  const { games, stats, loading, error, warning, reload } = useGames();
  const insets = useSafeAreaInsets();
  const genre = useMemo(() => mostPlayedGenre(games), [games]);
  const pending = loading || !!error;
  const initial = user?.name?.trim().charAt(0).toUpperCase() || '?';

  const metrics = [
    { label: 'Jogos', value: games.length },
    { label: 'Concluídos', value: stats.completed },
    { label: 'Favoritos', value: stats.favorites },
  ];

  return (
    <View className="flex-1 bg-[#0A0D14]">
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: BOTTOM_NAV_SPACE + insets.bottom }}>
          <View className="mx-auto w-full max-w-[480px] gap-6">
            <View>
              <Text accessibilityRole="header" className="text-[32px] font-extrabold tracking-[-0.5px] text-white">Meu Perfil</Text>
              <Text className="mt-1 text-base text-[#94A3B8]">Sua jornada gamer em números.</Text>
            </View>

            <View className="flex-row items-center gap-3.5">
              <View accessible={false} className="h-14 w-14 items-center justify-center rounded-full border-2 border-[#334155] bg-[#1E293B]">
                <Text className="text-xl font-bold text-white">{initial}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-white" numberOfLines={1}>{user?.name}</Text>
                {user?.username ? <Text className="mt-1 text-xs text-[#94A3B8]" numberOfLines={1}>@{user.username}</Text> : null}
              </View>
            </View>

            {error || warning ? <GamesFeedback error={error} warning={warning} retry={() => void reload()} /> : null}

            <View className="flex-row gap-3">
              {metrics.map(item => (
                <View key={item.label} accessible accessibilityLabel={`${item.label}: ${pending ? 'carregando' : item.value}`}
                  className="flex-1 items-center rounded-2xl border border-[#1E293B] bg-[#141B25] px-2 py-4">
                  <Text className="text-2xl font-bold tracking-[-0.6px] text-white">{pending ? '–' : item.value}</Text>
                  <Text className="mt-1.5 text-[11px] text-[#94A3B8]">{item.label}</Text>
                </View>
              ))}
            </View>

            <View className="gap-2">
              <Text className="text-xs font-bold text-[#CBD5E1]">Gênero mais jogado</Text>
              <View className="flex-row items-center gap-2.5 rounded-2xl border border-[#1E293B] bg-[#141B25] p-3">
                <View accessible={false} className="h-8 w-8 items-center justify-center rounded-xl border border-[#A855F74D] bg-[#3B076499]">
                  <Ionicons name="game-controller" size={16} color="#D8B4FE" />
                </View>
                <Text className={genre ? 'flex-1 text-xs font-bold tracking-[0.3px] text-white' : 'flex-1 text-xs text-[#94A3B8]'}>
                  {pending ? '–' : genre ?? 'Adicione jogos para descobrir seu gênero favorito'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <BottomNav active="profile" />
    </View>
  );
}
