import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type BottomNavTab = "home" | "library" | "search" | "profile";

type IconName = keyof typeof Ionicons.glyphMap;
type TabItem = { key: BottomNavTab; label: string; href: Href; icon: IconName; activeIcon: IconName };

const ACTIVE_COLOR = "#7BD0FF";
const INACTIVE_COLOR = "#9CA3AF";

const LEFT_TABS: TabItem[] = [
  { key: "home", label: "Início", href: "/home", icon: "home-outline", activeIcon: "home" },
  { key: "library", label: "Biblioteca", href: "/library", icon: "library-outline", activeIcon: "library" },
];
const RIGHT_TABS: TabItem[] = [
  { key: "search", label: "Descobrir", href: "/search", icon: "compass-outline", activeIcon: "compass" },
  { key: "profile", label: "Perfil", href: "/profile", icon: "person-circle-outline", activeIcon: "person-circle" },
];

// Altura aproximada da barra, para as telas reservarem espaço no fim da rolagem.
export const BOTTOM_NAV_SPACE = 120;

export function BottomNav({ active }: { active: BottomNavTab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function renderTab(tab: TabItem) {
    const selected = tab.key === active;
    const color = selected ? ACTIVE_COLOR : INACTIVE_COLOR;
    return (
      <Pressable key={tab.key} onPress={() => { if (!selected) router.replace(tab.href); }}
        accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }}
        className="min-w-16 items-center active:opacity-70">
        <Ionicons name={selected ? tab.activeIcon : tab.icon} size={24} color={color} accessible={false} />
        <Text className="mt-1 text-xs font-medium" style={{ color }}>{tab.label}</Text>
      </Pressable>
    );
  }

  return (
    <View accessibilityRole="tablist"
      className="absolute bottom-0 left-0 right-0 flex-row items-center justify-around border-t border-white/5 bg-[#161A22] px-2 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      {LEFT_TABS.map(renderTab)}
      <Pressable onPress={() => router.push("/game/add")} accessibilityRole="button" accessibilityLabel="Adicionar novo jogo"
        className="-mt-8 h-14 w-14 items-center justify-center rounded-full bg-blue-500 active:opacity-85">
        <Ionicons name="add" size={30} color="#FFFFFF" accessible={false} />
      </Pressable>
      {RIGHT_TABS.map(renderTab)}
    </View>
  );
}
