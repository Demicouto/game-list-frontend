import "../global.css";

import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { GamesProvider } from "../context/GamesContext";
import { AuthProvider } from "../context/AuthContext";

// Fundo escuro da janela raiz: evita a piscada branca ao sair de um grupo de telas.
SystemUI.setBackgroundColorAsync("#0A0D14");

// Fundo escuro da navegação: evita a piscada branca durante as transições de tela.
const appTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#0A0D14" },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <GamesProvider>
        <ThemeProvider value={appTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="game" />
          </Stack>
        </ThemeProvider>
      </GamesProvider>
    </AuthProvider>
  );
}
