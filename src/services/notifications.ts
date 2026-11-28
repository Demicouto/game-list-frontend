import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const ACHIEVEMENTS_CHANNEL = "conquistas";

// Sem este handler, o Expo não mostra a notificação enquanto o app está aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let ready: Promise<boolean> | null = null;
// Fica true só se o canal "Conquistas" foi criado; senão a notificação usa o canal padrão.
let channelReady = false;

// Tenta criar o canal "Conquistas" e pede a permissão uma vez.
// O canal é opcional: no Expo Go o Android não deixa criar canais próprios, e no APK funciona normalmente.
// Se a pessoa negar a permissão, devolve false e o app segue sem notificar.
function ensureReady(): Promise<boolean> {
  ready ??= (async () => {
    if (Platform.OS === "web") return false;
    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync(ACHIEVEMENTS_CHANNEL, {
          name: "Conquistas",
          description: "Avisos de conquistas desbloqueadas",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#3B82F6",
        });
        channelReady = true;
      } catch {
        // Sem canal próprio (ex.: Expo Go): a notificação usa o canal padrão.
      }
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  })().catch(() => {
    ready = null; // Permite tentar de novo na próxima conquista.
    return false;
  });
  return ready;
}

// Notificação local imediata. Nunca lança erro: uma falha aqui não pode atrapalhar a marcação da conquista.
export async function notifyAchievementUnlocked(achievementTitle: string, gameTitle?: string) {
  try {
    if (!(await ensureReady())) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏆 Conquista desbloqueada!",
        body: gameTitle ? `${achievementTitle} — ${gameTitle}` : achievementTitle,
        color: "#3B82F6",
      },
      trigger: channelReady ? { channelId: ACHIEVEMENTS_CHANNEL } : null,
    });
  } catch {
    // Sem notificação; a conquista já foi salva.
  }
}
