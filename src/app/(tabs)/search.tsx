import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, BOTTOM_NAV_SPACE } from '../../components/BottomNav';

export default function SearchPage() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-[#0A0D14]">
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: BOTTOM_NAV_SPACE + insets.bottom }}>
          <Text accessibilityRole="header" className="text-[32px] font-extrabold tracking-[-0.5px] text-[#E5E7EB]">Descobrir</Text>
          <Text className="mt-1 text-base text-[#9CA3AF]">Encontre novos jogos para a sua lista.</Text>
        </ScrollView>
      </SafeAreaView>
      <BottomNav active="search" />
    </View>
  );
}
