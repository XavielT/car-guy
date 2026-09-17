// Per-weight subpaths, never the package root: importing '@expo-google-fonts/inter'
// pulls every weight *and* every italic into the bundle — that alone put 8 MB of
// unused .ttf into dist/.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { fonts, palette } from '@/constants/theme';
import { DATABASE_NAME } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrations';
import { StoreProvider } from '@/lib/store';
import { ThemeProvider, useTheme } from '@/lib/theme/useTheme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

/** False while server-rendering, true once the client owns the tree. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    // Never changes after hydration, so there is nothing to subscribe to.
    () => () => {},
    () => true,
    () => false,
  );
}

export default function RootLayout() {
  const mounted = useIsClient();
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

  // Car Guy's content comes from a local database, which exists only in the
  // browser: static rendering runs this file in Node, where there is no SQLite
  // and no OPFS. Rendering the app there makes React abandon the Suspense
  // boundary (#419), and rendering something different on each side is a
  // hydration mismatch (#418).
  //
  // So both sides paint the same thing first — the boot screen — and the app
  // mounts only once the client has taken over. One extra frame, no errors.
  if (!mounted) return <Booting />;

  return (
    <ThemeProvider>
      {/* The database opens and migrates before anything renders. useSuspense
          turns that wait into one fallback instead of every screen having to
          cope with a half-open database. */}
      <Suspense fallback={<Booting />}>
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          onInit={migrate}
          options={{ enableChangeListener: true }}
          useSuspense>
          <StoreProvider>
            <Shell />
          </StoreProvider>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

function Booting() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.dark.bg.base, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={palette.dark.accent} />
    </View>
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
