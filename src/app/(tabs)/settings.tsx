import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../services/api';

type IconName = keyof typeof Ionicons.glyphMap;
type SettingItem = { key: string; label: string; icon: IconName; value?: string; onPress: () => void };

function comingSoon(label: string) {
  Alert.alert(label, 'Em breve.');
}

export default function SettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function handleLogout() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await logout(); }
    catch (error) { setError(error instanceof ApiError ? error.message : 'Não foi possível sair. Tente novamente.'); }
    finally { pending.current = false; setBusy(false); }
  }

  function confirmLogout() {
    Alert.alert('Sair da conta', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void handleLogout() },
    ]);
  }

  const items: SettingItem[] = [
    { key: 'profile', label: 'Perfil', icon: 'person-outline', onPress: () => router.replace('/profile') },
    { key: 'notifications', label: 'Notificações', icon: 'notifications-outline', onPress: () => comingSoon('Notificações') },
    { key: 'theme', label: 'Tema', icon: 'moon-outline', value: 'Escuro', onPress: () => comingSoon('Tema') },
    { key: 'language', label: 'Idioma', icon: 'globe-outline', value: 'Português', onPress: () => comingSoon('Idioma') },
    { key: 'privacy', label: 'Privacidade', icon: 'lock-closed-outline', onPress: () => comingSoon('Privacidade') },
    { key: 'help', label: 'Ajuda e suporte', icon: 'help-circle-outline', onPress: () => comingSoon('Ajuda e suporte') },
    {
      key: 'about', label: 'Sobre o app', icon: 'information-circle-outline',
      onPress: () => Alert.alert('GameList', `Versão ${Constants.expoConfig?.version ?? '1.0.0'}\nProjeto acadêmico.`),
    },
  ];

  return (
    <View className="flex-1 bg-[#0A0D14]">
      <Stack.Screen options={{ animation: 'ios_from_right' }} />
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View className="mx-auto w-full max-w-[480px] flex-1 justify-between gap-8">
            <View>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
                accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8}
                className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-[#181F28] active:opacity-80">
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" accessible={false} />
              </Pressable>

              <View className="mx-2 mt-5">
                <Text accessibilityRole="header" className="text-[32px] font-extrabold tracking-[-0.5px] text-white">Configurações</Text>
                <Text className="mt-1 text-sm text-[#A3A3A3]">Personalize sua experiência.</Text>
              </View>

              <View className="mt-6 gap-3">
                {items.map(item => (
                  <Pressable key={item.key} onPress={item.onPress} accessibilityRole="button"
                    accessibilityLabel={item.value ? `${item.label}: ${item.value}` : item.label}
                    className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-[#141A22] p-4 active:opacity-80">
                    <Ionicons name={item.icon} size={20} color="#CBD5E1" accessible={false} />
                    <Text className="flex-1 text-[15px] text-white">{item.label}</Text>
                    {item.value ? <Text className="text-sm text-[#A3A3A3]">{item.value}</Text> : null}
                    <Ionicons name="chevron-forward" size={16} color="#A3A3A3" accessible={false} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-3">
              {error ? <Text accessibilityRole="alert" className="text-center text-sm text-red-400">{error}</Text> : null}
              <Pressable onPress={confirmLogout} disabled={busy} accessibilityRole="button"
                accessibilityLabel="Sair da conta" accessibilityState={{ disabled: busy, busy }}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-[#EF44441A] bg-[#23171C] px-4 py-3.5 active:opacity-80">
                <Ionicons name="log-out-outline" size={18} color="#EF4444" accessible={false} />
                <Text className="text-base font-bold text-[#EF4444]">{busy ? 'Saindo…' : 'Sair da conta'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
