import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GameCover } from "../../components/GameCover";
import { useLibraryGame } from "../../hooks/useLibraryGame";
import { ApiError } from "../../services/api";
import { achievementsApi } from "../../services/achievements-api";
import { notifyAchievementUnlocked } from "../../services/notifications";
import type { Achievement } from "../../types/achievement";
import type { GameStatus } from "../../types/game";

type Filter = "all" | "unlocked" | "locked";

const STATUS_LABELS: Record<GameStatus, { label: string; color: string }> = {
  playing: { label: "Jogando atualmente", color: "#34D399" },
  completed: { label: "Concluído", color: "#60A5FA" },
  paused: { label: "Pausado", color: "#FBBF24" },
  wishlist: { label: "Quero jogar", color: "#C084FC" },
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "Desbloqueada há 2h" nas últimas 24 horas; depois disso, a data ("10 mar 2024").
function unlockedLabel(iso: string | null) {
  if (!iso) return "Desbloqueada";
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Desbloqueada agora";
  if (minutes < 60) return `Desbloqueada há ${minutes} min`;
  if (minutes < 24 * 60) return `Desbloqueada há ${Math.floor(minutes / 60)}h`;
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function AchievementsPage() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const record = useLibraryGame(gameId);
  const game = record.game;
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [toggling, setToggling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState<Achievement | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!gameId) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    achievementsApi.list(gameId, controller.signal)
      .then(list => { setItems(list); setLoading(false); })
      .catch(failure => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(failure instanceof ApiError ? failure.message : "Não foi possível carregar as conquistas. Tente novamente.");
      });
    return () => controller.abort();
  }, [gameId, attempt]);

  // O progresso é calculado da lista, com a mesma regra do back (porcentagem arredondada).
  const progress = useMemo(() => {
    const done = items.filter(item => item.unlocked);
    return {
      unlocked: done.length,
      total: items.length,
      percent: items.length ? Math.round((done.length / items.length) * 100) : 0,
    };
  }, [items]);

  const visible = useMemo(() => items
    .filter(item => filter === "all" || (filter === "unlocked" ? item.unlocked : !item.unlocked))
    // Desbloqueadas primeiro (as mais recentes no topo); depois as bloqueadas, na ordem do back.
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "")),
  [items, filter]);

  const setUnlocked = useCallback(async (item: Achievement, unlocked: boolean) => {
    if (!gameId || toggling) return;
    setToggling(item.id); setActionError(null);
    try {
      if (unlocked) {
        const saved = await achievementsApi.unlock(gameId, item.id);
        if (mounted.current) setItems(list => list.map(current => current.id === saved.id ? saved : current));
        void notifyAchievementUnlocked(saved.title, game?.title);
      } else {
        await achievementsApi.lock(gameId, item.id);
        if (mounted.current) setItems(list => list.map(current => current.id === item.id ? { ...current, unlocked: false, unlockedAt: null } : current));
      }
    } catch (failure) {
      if (mounted.current) setActionError(failure instanceof ApiError ? failure.message : "Não foi possível alterar a conquista. Tente novamente.");
    } finally {
      if (mounted.current) setToggling(null);
    }
  }, [gameId, toggling, game?.title]);

  function onPressItem(item: Achievement) {
    if (!item.unlocked) { void setUnlocked(item, true); return; }
    setConfirmLock(item);
  }

  function confirmUnlock() {
    const item = confirmLock;
    setConfirmLock(null);
    if (item) void setUnlocked(item, false);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `Todas (${progress.total})` },
    { key: "unlocked", label: `Desbloqueadas (${progress.unlocked})` },
    { key: "locked", label: `Bloqueadas (${progress.total - progress.unlocked})` },
  ];

  function renderList() {
    if (loading) return <ActivityIndicator className="py-12" color="#3B82F6" accessibilityLabel="Carregando conquistas" />;
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
    if (items.length === 0) {
      return (
        <View className="items-center gap-2 py-12">
          <Ionicons name="trophy-outline" size={34} color="#64748B" />
          <Text className="text-center text-base font-bold text-white">Este jogo não tem conquistas cadastradas</Text>
          <Text className="text-center text-sm text-[#94A3B8]">Jogos adicionados pelo catálogo trazem as conquistas automaticamente.</Text>
        </View>
      );
    }
    if (visible.length === 0) {
      return <Text className="py-12 text-center text-base text-[#94A3B8]">Nenhuma conquista neste filtro.</Text>;
    }
    return (
      <View className="gap-3">
        {visible.map(item => {
          const busy = toggling === item.id;
          return (
            <Pressable key={item.id} onPress={() => onPressItem(item)} disabled={!!toggling} accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.unlocked ? "desbloqueada" : "bloqueada"}`}
              accessibilityHint={item.unlocked ? "Toque para desmarcar" : "Toque para marcar como desbloqueada"}
              accessibilityState={{ checked: item.unlocked, busy, disabled: !!toggling }}
              className={`flex-row gap-3 rounded-2xl border p-4 active:opacity-80 ${item.unlocked
                ? "border-[#F59E0B4D] bg-[#1A1D24]" : "border-dashed border-[#1E293B] bg-[#11151C]"}`}>
              <View className={`h-12 w-12 items-center justify-center rounded-2xl border ${item.unlocked
                ? "border-[#F59E0B66] bg-[#3A2A0E]" : "border-[#1E293B] bg-[#0D1117]"}`}>
                {busy ? <ActivityIndicator color="#CBD5E1" />
                  : <Ionicons name={item.unlocked ? "trophy" : "lock-closed-outline"} size={20} color={item.unlocked ? "#FBBF24" : "#64748B"} />}
              </View>
              <View className="flex-1">
                <Text className={`text-[15px] font-bold ${item.unlocked ? "text-white" : "text-[#CBD5E1]"}`}>{item.title}</Text>
                {item.description ? (
                  <Text className={`mt-1 text-[13px] leading-5 ${item.unlocked ? "text-[#94A3B8]" : "text-[#64748B]"}`}>{item.description}</Text>
                ) : null}
                <View className="mt-3 flex-row items-center border-t border-white/5 pt-3">
                  {item.unlocked ? (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="checkmark" size={14} color="#34D399" />
                      <Text className="text-xs text-[#34D399]">{unlockedLabel(item.unlockedAt)}</Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-1.5 w-1.5 rounded-full bg-[#64748B]" />
                      <Text className="text-xs text-[#64748B]">Bloqueada</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0A0D14]">
      <StatusBar style="light" />
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1">
        <View className="flex-row items-center justify-between px-5 py-2.5">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/library"))}
            accessibilityRole="button" accessibilityLabel="Voltar"
            className="h-10 w-10 items-center justify-center rounded-full bg-[#181F28] active:opacity-80">
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" accessible={false} />
          </Pressable>
          <Text accessibilityRole="header" className="text-lg font-bold text-white">Conquistas</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
          <View className="mx-auto w-full max-w-[480px] gap-4">
            {game ? (
              <View className="flex-row items-center gap-3.5 overflow-hidden rounded-2xl border border-[#1E293B] bg-[#121722] p-4">
                <View style={{ width: 64, height: 80 }} className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#1C2029]">
                  <GameCover cover={game.cover} coverUrl={game.coverUrl} iconSize={24} />
                </View>
                <View className="flex-1 gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <View className="rounded-md border border-[#3B82F64D] bg-[#172554] px-2 py-0.5">
                      <Text className="text-[11px] font-bold text-[#93C5FD]">{game.platform}</Text>
                    </View>
                    {game.developer ? <Text className="flex-1 text-xs text-[#94A3B8]" numberOfLines={1}>{game.developer}</Text> : null}
                  </View>
                  <Text className="text-xl font-bold text-white" numberOfLines={2}>{game.title}</Text>
                  {game.status ? (
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_LABELS[game.status].color }} />
                      <Text className="text-xs" style={{ color: STATUS_LABELS[game.status].color }}>{STATUS_LABELS[game.status].label}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : record.loading ? null : record.error ? (
              <Text accessibilityRole="alert" className="text-sm text-red-400">{record.error}</Text>
            ) : null}

            {!loading && !error && items.length > 0 && (
              <View className="gap-4 rounded-2xl border border-[#1E293B] bg-[#121722] p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="trophy-outline" size={18} color="#3B82F6" />
                    <Text className="text-[15px] font-bold text-white">Progresso de Conquistas</Text>
                  </View>
                  <Text className="text-lg font-bold text-[#3B82F6]">{progress.percent}%</Text>
                </View>
                <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
                  className="h-2.5 overflow-hidden rounded-full bg-[#1E293B]">
                  <LinearGradient colors={["#3B82F6", "#38BDF8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ width: `${progress.percent}%`, height: "100%", borderRadius: 999 }} />
                </View>
                <View className="border-t border-white/5 pt-3">
                  <Text className="text-sm text-[#94A3B8]">
                    Desbloqueadas: <Text className="font-bold text-white">{progress.unlocked}</Text> de {progress.total}
                  </Text>
                </View>
              </View>
            )}

            {!loading && !error && items.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {filters.map(item => {
                  const active = filter === item.key;
                  return (
                    <Pressable key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button" accessibilityState={{ selected: active }}
                      className={`rounded-full border px-4 py-1.5 active:opacity-80 ${active ? "border-[#3B82F6] bg-[#3B82F6]" : "border-[#1E293B] bg-[#141B25]"}`}>
                      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-[#CBD5E1]"}`}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {actionError ? <Text accessibilityRole="alert" className="text-center text-sm text-red-400">{actionError}</Text> : null}

            {renderList()}
          </View>
        </ScrollView>
      </SafeAreaView>
      <Modal visible={!!confirmLock} transparent animationType="fade" onRequestClose={() => setConfirmLock(null)}>
        <View className="flex-1 justify-end bg-black/60">
          <Pressable onPress={() => setConfirmLock(null)} accessibilityRole="button" accessibilityLabel="Cancelar"
            className="absolute bottom-0 left-0 right-0 top-0" />
          <View accessibilityViewIsModal className="gap-4 rounded-t-[28px] bg-[#171A22] p-5" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
            <Text className="text-xl font-bold text-white">Desmarcar conquista?</Text>
            <Text className="text-base text-[#9CA3AF]">"{confirmLock?.title}" volta a ficar bloqueada.</Text>
            <Pressable onPress={confirmUnlock} accessibilityRole="button" accessibilityLabel="Confirmar desmarcar" className="items-center rounded-2xl bg-red-600 p-4 active:opacity-85">
              <Text className="font-bold text-white">Desmarcar</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmLock(null)} accessibilityRole="button" className="items-center p-4 active:opacity-70">
              <Text className="font-bold text-white">Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
