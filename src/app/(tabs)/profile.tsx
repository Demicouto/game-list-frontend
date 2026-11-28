import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, BOTTOM_NAV_SPACE } from '../../components/BottomNav';
import { GameCover } from '../../components/GameCover';
import { GamesFeedback } from '../../components/GamesFeedback';
import { useAuth } from '../../context/AuthContext';
import { useGames } from '../../context/GamesContext';
import { useAccountAchievements } from '../../hooks/useAccountAchievements';
import { mostPlayedGenre } from '../../utils/most-played-genre';
import { profileLevel } from '../../utils/profile-level';

type IconName = keyof typeof Ionicons.glyphMap;

const PLATFORM_COLORS = ['#3B82F6', '#22D3EE', '#818CF8', '#A78BFA', '#34D399', '#F472B6'];
const FAVORITES_SHOWN = 3;

function gamesLabel(count: number) {
  return `${count} ${count === 1 ? 'jogo' : 'jogos'}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { games, stats, loading, error, warning, reload } = useGames();
  const achievements = useAccountAchievements(games);
  const pending = loading || !!error;
  const achievementsPending = pending || achievements.loading;

  const genre = useMemo(() => mostPlayedGenre(games), [games]);
  const genreCount = useMemo(() => genre ? games.filter(game => game.genre?.trim() === genre).length : 0, [games, genre]);
  const platforms = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) counts.set(game.platform, (counts.get(game.platform) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [games]);
  const favorites = useMemo(() => games.filter(game => game.favorite), [games]);

  const level = profileLevel(achievements.unlocked);
  const levelPercent = Math.round((level.current / level.needed) * 100);
  const initial = user?.name?.trim().charAt(0).toUpperCase() || '?';
  const completionRate = games.length ? Math.round((stats.completed / games.length) * 100) : 0;

  const metrics: { label: string; value: number; icon: IconName; color: string; box: string; waiting: boolean; extra?: string }[] = [
    { label: 'Jogos', value: games.length, icon: 'game-controller', color: '#60A5FA', box: 'bg-[#12233A]', waiting: pending },
    { label: 'Concluídos', value: stats.completed, icon: 'checkmark-circle', color: '#34D399', box: 'bg-[#0F2A24]', waiting: pending,
      extra: games.length ? `${completionRate}% taxa de finalização` : undefined },
    { label: 'Conquistas', value: achievements.unlocked, icon: 'trophy', color: '#FBBF24', box: 'bg-[#2B2010]', waiting: achievementsPending },
    { label: 'Favoritos', value: stats.favorites, icon: 'heart', color: '#F87171', box: 'bg-[#2B141C]', waiting: pending },
  ];

  const cabinet = [
    { label: 'Desbloqueadas', value: achievements.unlocked, icon: 'trophy' as IconName, color: '#FBBF24' },
    { label: 'Jogos com conquistas', value: achievements.gamesWithUnlocks, icon: 'game-controller' as IconName, color: '#60A5FA' },
    { label: '100% completos', value: achievements.completedGames, icon: 'ribbon' as IconName, color: '#A78BFA' },
  ];

  return (
    <View className="flex-1 bg-[#0A0D14]">
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: BOTTOM_NAV_SPACE + insets.bottom }}>
          <View className="mx-auto w-full max-w-[480px] gap-6">
            <View className="flex-row items-start justify-between pt-2">
              <View className="flex-1 pr-4">
                <Text accessibilityRole="header" className="text-[32px] font-extrabold tracking-[-0.5px] text-white">Meu Perfil</Text>
                <Text className="mt-1 text-sm text-[#94A3B8]">Sua jornada gamer em números.</Text>
              </View>
              <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Abrir configurações"
                className="h-10 w-10 items-center justify-center rounded-full border border-[#1E2634] bg-[#151A23] active:opacity-80">
                <Ionicons name="settings-outline" size={20} color="#E2E8F0" accessible={false} />
              </Pressable>
            </View>

            {/* Cartão do jogador com o nível */}
            <View className="gap-4 rounded-2xl border border-[#1E2634] bg-[#151A23] p-4">
              <View className="flex-row items-center gap-3.5">
                <View accessible={false}>
                  <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-[#2F70F699] bg-[#1E293B]">
                    <Text className="text-xl font-bold text-white">{initial}</Text>
                  </View>
                  <View className="absolute -bottom-1 -right-1 rounded-full border-2 border-[#151A23] bg-[#2F70F6] px-1.5">
                    <Text className="text-[10px] font-bold text-white">{achievementsPending ? '–' : level.level}</Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold tracking-[-0.45px] text-white" numberOfLines={1}>{user?.name}</Text>
                  {user?.username ? <Text className="text-xs text-[#8E9BAE]" numberOfLines={1}>@{user.username}</Text> : null}
                </View>
              </View>
              <View className="gap-1.5 border-t border-[#1E2634B2] pt-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-full bg-[#22C55E]" />
                    <Text className="text-xs text-[#CBD5E1]" numberOfLines={1}>
                      {achievementsPending ? 'Calculando nível…' : `Nível ${level.level} • ${level.title}`}
                    </Text>
                  </View>
                  {!achievementsPending && (
                    <Text className="text-[11px] font-bold text-[#8E9BAE]">{level.current} / {level.needed} conquistas</Text>
                  )}
                </View>
                <View accessible accessibilityRole="progressbar" accessibilityLabel="Progresso até o próximo nível"
                  accessibilityValue={{ min: 0, max: 100, now: achievementsPending ? 0 : levelPercent }}
                  className="h-2 justify-center overflow-hidden rounded-full border border-white/5 bg-[#0E1218] px-[3px]">
                  <LinearGradient colors={['#2F70F6', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ width: `${achievementsPending ? 0 : levelPercent}%`, height: 2, borderRadius: 999 }} />
                </View>
              </View>
            </View>

            {error || warning ? <GamesFeedback error={error} warning={warning} retry={() => void reload()} /> : null}

            {/* Quatro números */}
            <View className="flex-row flex-wrap gap-3">
              {metrics.map(item => (
                <View key={item.label} accessible accessibilityLabel={`${item.label}: ${item.waiting ? 'carregando' : item.value}`}
                  style={{ width: '48%', flexGrow: 1 }} className="items-center rounded-2xl border border-[#1E2634] bg-[#151A23] px-3 py-4">
                  <View className={`h-11 w-11 items-center justify-center rounded-xl ${item.box}`}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text className="mt-2.5 text-3xl font-bold tracking-[-0.6px] text-white">{item.waiting ? '–' : item.value}</Text>
                  <Text className="mt-0.5 text-center text-xs text-[#94A3B8]">{item.label}</Text>
                  {item.extra && !item.waiting ? <Text className="mt-0.5 text-center text-[11px] text-[#34D399]">{item.extra}</Text> : null}
                </View>
              ))}
            </View>

            {/* Gênero mais jogado e plataformas */}
            <View className="gap-3">
              <Text className="text-xs font-bold tracking-wider text-[#8E9BAE]">GÊNERO MAIS JOGADO & PLATAFORMAS</Text>
              <View className="flex-row items-center gap-3 rounded-2xl border border-[#1E2634] bg-[#151A23] p-4">
                <View accessible={false} className="h-10 w-10 items-center justify-center rounded-xl border border-[#A855F74D] bg-[#3B076499]">
                  <Ionicons name="game-controller" size={18} color="#D8B4FE" />
                </View>
                <View className="flex-1">
                  {pending ? <Text className="text-base font-bold text-white">–</Text> : genre ? <>
                    <Text className="text-base font-bold text-white">{genre}</Text>
                    <Text className="mt-0.5 text-xs text-[#8E9BAE]">{gamesLabel(genreCount)}</Text>
                  </> : <Text className="text-xs text-[#94A3B8]">Adicione jogos para descobrir seu gênero favorito</Text>}
                </View>
              </View>
              {!pending && platforms.length > 0 && (
                <View className="flex-row flex-wrap gap-2">
                  {platforms.map((item, index) => (
                    <View key={item.name} className="flex-row items-center gap-1.5 rounded-full border border-[#1E2634] bg-[#151A23] px-3 py-1">
                      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[index % PLATFORM_COLORS.length] }} />
                      <Text className="text-xs font-semibold text-[#CBD5E1]">{item.name}</Text>
                      <Text className="text-xs text-[#8E9BAE]">• {gamesLabel(item.count)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Troféus & Conquistas */}
            <View className="gap-4 rounded-2xl border border-[#1E2634] bg-[#151A23] p-4">
              <View>
                <Text className="text-[15px] font-bold text-white">Troféus & Conquistas</Text>
                <Text className="mt-0.5 text-xs text-[#8E9BAE]">Total acumulado na conta</Text>
              </View>
              <View className="flex-row gap-2">
                {cabinet.map(item => (
                  <View key={item.label} accessible accessibilityLabel={`${item.label}: ${achievementsPending ? 'carregando' : item.value}`}
                    className="flex-1 items-center gap-1 rounded-xl border border-white/5 bg-[#0E1218] px-1 py-3">
                    <Ionicons name={item.icon} size={18} color={item.color} />
                    <Text className="text-lg font-bold text-white">{achievementsPending ? '–' : item.value}</Text>
                    <Text className="text-center text-[10px] uppercase text-[#8E9BAE]">{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Favoritos em destaque */}
            {!pending && favorites.length > 0 && (
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text accessibilityRole="header" className="text-lg font-bold text-white">Favoritos em Destaque</Text>
                  <Pressable onPress={() => router.replace({ pathname: '/library', params: { filter: 'favorites' } })}
                    accessibilityRole="link" hitSlop={8} className="flex-row items-center gap-0.5 active:opacity-70">
                    <Text className="text-xs font-semibold text-[#3B82F6]">Ver todos ({favorites.length})</Text>
                    <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
                  </Pressable>
                </View>
                <View className="flex-row gap-2.5">
                  {favorites.slice(0, FAVORITES_SHOWN).map(game => {
                    const progress = achievements.byGame[game.id];
                    const percent = progress && progress.total > 0 ? `${progress.percent}% conquistas` : null;
                    return (
                      <Pressable key={game.id} onPress={() => router.push({ pathname: '/game/[gamesid]', params: { gamesid: game.id } })}
                        accessibilityRole="button" accessibilityLabel={`Abrir ${game.title}`}
                        style={{ width: '31%' }} className="overflow-hidden rounded-xl border border-[#1E2634] bg-[#151A23] active:opacity-80">
                        <View style={{ aspectRatio: 3 / 4 }} className="bg-[#1C2029]">
                          <GameCover cover={game.cover} coverUrl={game.coverUrl} iconSize={28} />
                          <View className="absolute left-1.5 top-1.5 rounded-md border border-[#3B82F64D] bg-[#172554E6] px-1.5 py-0.5">
                            <Text className="text-[9px] font-bold text-[#93C5FD]">{game.platform}</Text>
                          </View>
                          {game.rating ? (
                            <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-0.5 rounded-md bg-[#0E1218E6] px-1.5 py-0.5">
                              <Ionicons name="star" size={9} color="#FBBF24" />
                              <Text className="text-[10px] font-bold text-white">{game.rating}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View className="gap-0.5 p-2">
                          <Text className="text-xs font-bold text-white" numberOfLines={1}>{game.title}</Text>
                          <Text className="text-[10px] text-[#8E9BAE]" numberOfLines={1}>{percent ?? game.platform}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      <BottomNav active="profile" />
    </View>
  );
}
