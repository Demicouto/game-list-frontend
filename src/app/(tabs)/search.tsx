import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Text, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, BOTTOM_NAV_SPACE } from '../../components/BottomNav';
import SearchBar from '../../components/SearchBar';
import { useGames } from '../../context/GamesContext';
import { ApiError } from '../../services/api';
import { gamesApi } from '../../services/games-api';
import type { CatalogGame } from '../../types/game';
import { mostPlayedGenre } from '../../utils/most-played-genre';

const PADDING = 20;
const FEATURED_COUNT = 3;
const IGDB_URL = 'https://www.igdb.com';

// Os gêneros chegam em português (jogos do seed) ou em inglês (IGDB); cada filtro aceita os dois.
const GENRE_FILTERS: { key: string; label: string; terms: string[] }[] = [
  { key: 'all', label: 'Todos', terms: [] },
  { key: 'rpg', label: 'RPG', terms: ['rpg', 'role-playing'] },
  { key: 'action', label: 'Ação', terms: ['acao', 'action', 'shooter', 'fighting', 'hack and slash'] },
  { key: 'adventure', label: 'Aventura', terms: ['aventura', 'adventure'] },
  { key: 'indie', label: 'Indie', terms: ['indie'] },
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function matchesGenre(game: CatalogGame, terms: string[]) {
  if (terms.length === 0) return true;
  const genre = normalize(game.genre ?? '');
  return !!genre && terms.some(term => genre.includes(term));
}

function catalogKey(game: CatalogGame) {
  return game.id ?? `igdb-${game.igdbId}`;
}

export default function SearchPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { games } = useGames();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  const term = query.trim();
  const searching = term.length > 0;
  const bannerWidth = Math.min(width - insets.left - insets.right, 480) - PADDING * 2;

  // Sem termo: catálogo já importado. Com termo: catálogo + IGDB, depois de uma pausa na digitação.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    const timer = setTimeout(() => {
      gamesApi.searchCatalog(term, controller.signal)
        .then(items => { setResults(items); setLoading(false); })
        .catch(failure => {
          if (controller.signal.aborted) return;
          setResults([]); setLoading(false);
          setError(failure instanceof ApiError ? failure.message : 'Não foi possível buscar jogos. Tente novamente.');
        });
    }, term ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, attempt]);

  const ownedTitles = useMemo(() => new Set(games.map(game => normalize(game.title))), [games]);
  const terms = GENRE_FILTERS.find(item => item.key === filter)?.terms ?? [];
  const visible = useMemo(() => results.filter(game => matchesGenre(game, terms)), [results, terms]);
  const featured = useMemo(() => visible.filter(game => game.coverUrl).slice(0, FEATURED_COUNT), [visible]);
  const recommended = useMemo(() => {
    const favorite = mostPlayedGenre(games);
    const available = visible.filter(game => !ownedTitles.has(normalize(game.title)) && !featured.includes(game));
    const sameGenre = favorite ? available.filter(game => normalize(game.genre ?? '') === normalize(favorite)) : [];
    return (sameGenre.length > 0 ? sameGenre : available).slice(0, 10);
  }, [games, visible, featured, ownedTitles]);

  useEffect(() => { setSlide(0); }, [filter, term]);

  // Jogo da IGDB ainda não importado (id nulo) é trazido para o catálogo antes de abrir o formulário.
  async function add(game: CatalogGame) {
    const key = catalogKey(game);
    if (selecting) return;
    setSelecting(key); setAddError(null);
    try {
      const ready = game.id ? game : await gamesApi.importCatalogGame(game.igdbId!);
      router.push({ pathname: '/game/add', params: {
        catalogId: ready.id!, title: ready.title, developer: ready.developer ?? '', genre: ready.genre ?? '', coverUrl: ready.coverUrl ?? '',
      } });
    } catch (failure) {
      setAddError(failure instanceof ApiError ? failure.message : 'Não foi possível importar o jogo. Tente novamente.');
    } finally {
      setSelecting(null);
    }
  }

  function onBannerScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setSlide(Math.round(event.nativeEvent.contentOffset.x / bannerWidth));
  }

  function renderAction(game: CatalogGame, size: number) {
    if (ownedTitles.has(normalize(game.title))) {
      return (
        <View className="rounded-md border border-[#33415599] bg-[#202736E5] px-2 py-0.5">
          <Text className="text-[10px] font-bold text-[#CBD5E1]">Na biblioteca</Text>
        </View>
      );
    }
    const busy = selecting === catalogKey(game);
    return (
      <Pressable onPress={() => void add(game)} disabled={!!selecting} accessibilityRole="button"
        accessibilityLabel={`Adicionar ${game.title}`} accessibilityState={{ disabled: !!selecting, busy }}
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-full bg-[#3B82F6] active:opacity-80">
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={size * 0.55} color="#FFFFFF" accessible={false} />}
      </Pressable>
    );
  }

  function renderBody() {
    if (loading) {
      return <ActivityIndicator className="py-12" color="#3B82F6" accessibilityLabel="Buscando jogos" />;
    }
    if (error) {
      return (
        <View className="items-center gap-4 py-10">
          <Text accessibilityRole="alert" className="text-center text-base text-red-400">{error}</Text>
          <Pressable onPress={() => setAttempt(value => value + 1)} accessibilityRole="button" className="rounded-2xl bg-blue-600 px-5 py-3 active:opacity-80">
            <Text className="font-bold text-white">Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }
    if (visible.length === 0) {
      return (
        <Text className="py-12 text-center text-base text-[#9CA3AF]">
          {searching ? `Nenhum jogo encontrado para "${term}".` : 'Nenhum jogo no catálogo para este filtro.'}
        </Text>
      );
    }
    if (searching) {
      return (
        <View className="gap-2">
          {visible.map(game => (
            <View key={catalogKey(game)} className="flex-row items-center gap-3 rounded-2xl border border-[#1E293B] bg-[#141B25] p-3">
              {game.coverUrl
                ? <Image source={{ uri: game.coverUrl }} contentFit="cover" style={{ width: 44, height: 58, borderRadius: 8 }} accessible={false} />
                : <View style={{ width: 44, height: 58, borderRadius: 8 }} className="items-center justify-center bg-[#1E293B]">
                    <Ionicons name="game-controller-outline" size={20} color="#64748B" />
                  </View>}
              <View className="flex-1">
                <Text className="font-bold text-white" numberOfLines={2}>{game.title}</Text>
                <Text className="mt-1 text-xs text-[#94A3B8]" numberOfLines={1}>
                  {[game.developer, game.genre].filter(Boolean).join(' · ') || 'Catálogo'}
                </Text>
              </View>
              {renderAction(game, 36)}
            </View>
          ))}
        </View>
      );
    }
    return (
      <View className="gap-6">
        {featured.length > 0 && (
          <View className="gap-2">
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onBannerScroll}
              style={{ width: bannerWidth }}>
              {featured.map(game => (
                <View key={catalogKey(game)} style={{ width: bannerWidth, height: 176 }}
                  className="overflow-hidden rounded-2xl border border-[#1E293BB2] bg-[#0F172A]">
                  <Image source={{ uri: game.coverUrl! }} contentFit="cover" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} accessible={false} />
                  <LinearGradient colors={['#0E121A', '#0E121A99', '#0E121A00']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                  <View className="flex-1 flex-row items-end justify-between gap-3 p-4">
                    <View className="flex-1">
                      <Text className="text-lg font-bold tracking-[0.45px] text-white" numberOfLines={2}>{game.title}</Text>
                      {game.developer ? <Text className="mt-0.5 text-[11px] text-[#CBD5E1]" numberOfLines={1}>{game.developer}</Text> : null}
                      {game.genre ? (
                        <View className="mt-2 self-start rounded-md border border-[#33415599] bg-[#202736E5] px-2.5 py-0.5">
                          <Text className="text-[10px] font-bold text-[#CBD5E1]">{game.genre}</Text>
                        </View>
                      ) : null}
                    </View>
                    {renderAction(game, 40)}
                  </View>
                </View>
              ))}
            </ScrollView>
            {featured.length > 1 && (
              <View className="flex-row justify-center gap-1.5 pt-1" accessible accessibilityLabel={`Destaque ${slide + 1} de ${featured.length}`}>
                {featured.map((game, index) => (
                  <View key={catalogKey(game)} className={`h-1.5 w-1.5 rounded-full ${index === slide ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`} />
                ))}
              </View>
            )}
          </View>
        )}

        {recommended.length > 0 && (
          <View className="gap-3">
            <Text accessibilityRole="header" className="text-sm font-bold text-white">Recomendados para você</Text>
            <FlatList horizontal data={recommended} keyExtractor={catalogKey} showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
              renderItem={({ item }) => (
                <View style={{ width: 110, height: 147 }} className="overflow-hidden rounded-2xl border border-[#1E293B] bg-[#141B25]">
                  {item.coverUrl
                    ? <Image source={{ uri: item.coverUrl }} contentFit="cover" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} accessible={false} />
                    : <View className="flex-1 items-center justify-center"><Ionicons name="game-controller-outline" size={28} color="#64748B" /></View>}
                  <LinearGradient colors={['#0E121AE6', '#0E121A00']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0.4 }}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                  <View className="absolute right-2 top-2">{renderAction(item, 28)}</View>
                  <Text className="absolute bottom-2 left-2 right-2 text-[11px] font-bold uppercase text-white" numberOfLines={2}>{item.title}</Text>
                </View>
              )} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0A0D14]">
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: PADDING, paddingTop: 16, paddingBottom: BOTTOM_NAV_SPACE + insets.bottom }}>
          <View className="mx-auto w-full max-w-[440px]">
            <Text accessibilityRole="header" className="text-[32px] font-extrabold tracking-[-0.5px] text-[#E5E7EB]">Descobrir</Text>
            <Text className="mb-5 mt-1 text-base text-[#9CA3AF]">Encontre novos jogos para a sua lista.</Text>

            <SearchBar value={query} onChangeText={setQuery} placeholder="Pesquisar jogo..." accessibilityLabel="Pesquisar jogos no catálogo" />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              className="mt-4" contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {GENRE_FILTERS.map(item => {
                const active = filter === item.key;
                return (
                  <Pressable key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button"
                    accessibilityLabel={`Filtrar por ${item.label}`} accessibilityState={{ selected: active }}
                    className={`rounded-full border px-4 py-1.5 active:opacity-80 ${active ? 'border-[#3B82F6] bg-[#3B82F6]' : 'border-[#1E293B] bg-[#141B25]'}`}>
                    <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-[#CBD5E1]'}`}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {addError ? <Text accessibilityRole="alert" className="mt-4 text-center text-sm text-red-400">{addError}</Text> : null}

            <View className="mt-5">{renderBody()}</View>

            <Pressable onPress={() => void Linking.openURL(IGDB_URL)} accessibilityRole="link" hitSlop={8} className="mt-8 self-center">
              <Text className="text-xs text-[#64748B]">
                Dados fornecidos por <Text className="font-semibold text-[#7BD0FF] underline">IGDB</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
      <BottomNav active="search" />
    </View>
  );
}
