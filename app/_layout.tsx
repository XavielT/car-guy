import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { IBMPlexMono_400Regular, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { StoreProvider } from '@/lib/store';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_700Bold,
    Syne_700Bold,
    Syne_800ExtraBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F3EFE4' },
          headerTintColor: '#1C241F',
          headerStyle: { backgroundColor: '#F3EFE4' },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: 'Syne_700Bold', fontSize: 18 },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="vehiculo"
          options={{ presentation: 'modal', headerShown: true, title: 'Nuevo vehículo' }}
        />
        <Stack.Screen name="gastos" options={{ headerShown: true, title: 'Gastos y mantenimiento' }} />
        <Stack.Screen name="precios" options={{ headerShown: true, title: 'Precios MICM' }} />
        <Stack.Screen name="carga/[id]" options={{ headerShown: true, title: 'Editar carga' }} />
      </Stack>
    </StoreProvider>
  );
}
