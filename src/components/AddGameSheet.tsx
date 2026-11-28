import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "../services/api";
import { gamesApi } from "../services/games-api";
import type { CatalogGame } from "../types/game";
import SearchBar from "./SearchBar";

type Props = { onClose: () => void };

export function AddGameSheet({ onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [catalog, setCatalog] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Busca no catálogo depois de uma pausa na digitação; a resposta anterior é cancelada.
  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    const timer = setTimeout(() => {
      gamesApi.searchCatalog(query, controller.signal)
        .then(items => { setResults(items); setLoading(false); })
        .catch(failure => {
          if (controller.signal.aborted) return;
          setResults([]); setLoading(false);
          setError(failure instanceof ApiError ? failure.message : "Não foi possível buscar jogos. Tente novamente.");
        });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [catalog, query]);

  function openForm() {
    onClose();
    router.push("/game/add");
  }

  // Jogo ainda não importado (id nulo) é trazido da IGDB antes de abrir o formulário.
  async function pick(game: CatalogGame) {
    const key = game.id ?? String(game.igdbId);
    if (selecting) return;
    setSelecting(key); setError(null);
    try {
      const ready = game.id ? game : await gamesApi.importCatalogGame(game.igdbId!);
      onClose();
      router.push({ pathname: "/game/add", params: {
        catalogId: ready.id!, title: ready.title, developer: ready.developer ?? "", genre: ready.genre ?? "", coverUrl: ready.coverUrl ?? "",
      } });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Não foi possível importar o jogo. Tente novamente.");
      setSelecting(null);
    }
  }

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end">
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar menu de jogos"
          className="absolute bottom-0 left-0 right-0 top-0 bg-black/60" />
        <View accessibilityViewIsModal className="max-h-[85%] rounded-t-[28px] border-t border-[#252C3C] bg-[#171A22] px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8, paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) }}>
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-[#394153]" />
          <View className="mb-2 flex-row items-center gap-3">
            {catalog && <Pressable onPress={() => setCatalog(false)} accessibilityRole="button" accessibilityLabel="Voltar para opções"
              className="h-11 w-11 items-center justify-center rounded-full bg-[#252C3C]">
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>}
            <Text accessibilityRole="header" className="flex-1 text-2xl font-extrabold text-[#E5E7EB]">
              {catalog ? "Jogos existentes" : "Adicionar à biblioteca"}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" className="h-11 w-11 items-center justify-center rounded-full bg-[#252C3C]">
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </Pressable>
          </View>
          <Text className="mb-5 text-sm leading-5 text-[#9CA3AF]">
            {catalog ? "Busque um jogo e confirme os dados antes de salvar." : "Como você quer adicionar seu próximo jogo?"}
          </Text>
          {catalog ? <>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar jogo…" accessibilityLabel="Buscar jogos no catálogo" />
            <ScrollView keyboardShouldPersistTaps="handled" className="mt-3 shrink" contentContainerStyle={{ paddingBottom: 8 }}>
              {results.map(game => {
                const key = game.id ?? String(game.igdbId);
                return <Pressable key={key} onPress={() => void pick(game)} disabled={!!selecting} accessibilityRole="button"
                  accessibilityLabel={`Selecionar ${game.title}`} className="mb-2 flex-row items-center gap-3 rounded-2xl border border-[#252C3C] bg-[#1D2330] p-4 active:opacity-80">
                  {game.coverUrl
                    ? <Image source={{ uri: game.coverUrl }} contentFit="cover" style={{ width: 44, height: 58, borderRadius: 8 }} accessible={false} />
                    : <View style={{ width: 44, height: 58, borderRadius: 8 }} className="bg-[#252C3C]" />}
                  <View className="flex-1"><Text className="font-bold text-[#E5E7EB]">{game.title}</Text>
                    <Text className="mt-1 text-xs text-[#9CA3AF]">{[game.developer, game.genre].filter(Boolean).join(" · ") || "Catálogo"}</Text></View>
                  {selecting === key ? <ActivityIndicator color="#9CA3AF" /> : <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
                </Pressable>;
              })}
              {loading && <ActivityIndicator className="py-8" color="#9CA3AF" accessibilityLabel="Buscando jogos" />}
              {!loading && error && <Text accessibilityRole="alert" className="py-8 text-center text-[#F87171]">{error}</Text>}
              {!loading && !error && results.length === 0 && <Text className="py-8 text-center text-[#9CA3AF]">Nenhum jogo encontrado</Text>}
            </ScrollView>
          </> : <View className="flex-row items-stretch gap-3">
            <Pressable onPress={() => setCatalog(true)} accessibilityRole="button" accessibilityLabel="Jogos existentes"
              className="flex-1 rounded-3xl border border-[#2C3E5C] bg-[#17263C] px-4 py-6 active:opacity-80">
              <View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl bg-[#233F65]"><Ionicons name="library-outline" size={30} color="#60A5FA" /></View>
              <Text className="text-base font-extrabold text-white">Jogos existentes</Text>
              <Text className="mt-2 text-sm leading-5 text-[#A8B8CD]">Escolha um jogo do catálogo.</Text>
            </Pressable>
            <Pressable onPress={() => openForm()} accessibilityRole="button" accessibilityLabel="Adicionar novo jogo"
              className="flex-1 rounded-3xl border border-[#252C3C] bg-[#1D2330] px-4 py-6 active:opacity-80">
              <View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl bg-[#30364A]"><Ionicons name="add" size={32} color="#C4B5FD" /></View>
              <Text className="text-base font-extrabold text-white">Adicionar novo jogo</Text>
              <Text className="mt-2 text-sm leading-5 text-[#9CA3AF]">Cadastre os dados manualmente.</Text>
            </Pressable>
          </View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
