import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { fonts } from '@/constants/theme';
import { StoreProvider } from '@/lib/store';
import { ThemeProvider, useTheme } from '@/lib/theme/useTheme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Every family named in constants/theme.ts `fonts` must appear here. A weight
  // that is referenced but not loaded falls back to the system font on web
  // without warning.
  const [loaded, error] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ThemeProvider>
  );
}

function Shell() {
  const { theme, scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg.base },
          headerTintColor: theme.text.primary,
          headerStyle: { backgroundColor: theme.bg.surface },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.title, fontSize: 18 },
        }}>
        {/* These titles are what the browser tab shows on web: expo-router feeds
            the screen title to react-helmet, and a screen without one renders an
            empty <title> that wins over anything static in +html.tsx. */}
        <Stack.Screen name="(tabs)" options={{ title: 'Car Guy' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Car Guy' }} />
        <Stack.Screen
          name="vehiculo"
          options={{ presentation: 'modal', headerShown: true, title: 'Nuevo vehículo' }}
        />
        <Stack.Screen name="gastos" options={{ headerShown: true, title: 'Gastos y mantenimiento' }} />
        <Stack.Screen name="precios" options={{ headerShown: true, title: 'Precios MICM' }} />
        <Stack.Screen name="carga/[id]" options={{ headerShown: true, title: 'Editar carga' }} />
      </Stack>
    </>
  );
}
