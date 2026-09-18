// Per-weight subpaths, never the package root: importing '@expo-google-fonts/manrope'
// pulls every weight *and* every italic into the bundle — that alone put 8 MB of
// unused .ttf into dist/.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';

import { AlertHost } from '@/components/AlertHost';
import { fonts, palette } from '@/constants/theme';
import { DATABASE_NAME } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrations';
import { configure as configureNotifications, resync } from '@/lib/notifications';
import { StoreProvider, useStore } from '@/lib/store';
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
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
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

/**
 * Notification wiring: create the channel, follow a tapped notification to its
 * screen, and rebuild the schedule whenever the app comes back to the
 * foreground — cheap, and it means a plan can never go stale after a day of
 * edits made elsewhere.
 */
function useNotifications() {
  const router = useRouter();
  const { activeVehicle, data } = useStore();
  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void configureNotifications();

    let subscription: { remove: () => void } | null = null;
    void import('expo-notifications').then((N) => {
      subscription = N.addNotificationResponseReceivedListener((response) => {
        const route = response.notification.request.content.data?.route;
        if (typeof route === 'string') router.push(route as never);
      });
    });
    return () => subscription?.remove();
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web' || !vehicleId) return;
    const run = () => void resync(vehicleId).catch(() => {});
    run();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => listener.remove();
  }, [vehicleId, data]);
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
  useNotifications();

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
          name="vehiculo/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: 'Nuevo vehículo' }}
        />
        <Stack.Screen name="vehiculo/[id]" options={{ headerShown: true, title: 'Vehículo' }} />
        <Stack.Screen name="vehiculo/[id]/editar" options={{ headerShown: true, title: 'Editar vehículo' }} />
        <Stack.Screen
          name="odometro"
          options={{ presentation: 'modal', headerShown: true, title: 'Odómetro' }}
        />
        <Stack.Screen name="carga/nueva" options={{ headerShown: true, title: 'Nueva carga' }} />
        <Stack.Screen
          name="servicio/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: 'Nuevo registro' }}
        />
        <Stack.Screen name="servicio/[id]" options={{ headerShown: true, title: 'Registro' }} />
        <Stack.Screen
          name="gasto/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: 'Gasto' }}
        />
        <Stack.Screen name="chequeo/[templateId]/run" options={{ headerShown: true, title: 'Chequeo' }} />
        <Stack.Screen name="chequeo/guia" options={{ headerShown: true, title: 'Qué revisar y cómo' }} />
        <Stack.Screen name="inspeccion/[id]" options={{ headerShown: true, title: 'Resultado' }} />
        <Stack.Screen name="recordatorios/index" options={{ headerShown: true, title: 'Recordatorios' }} />
        <Stack.Screen name="recordatorio/[id]" options={{ headerShown: true, title: 'Recordatorio' }} />
        <Stack.Screen name="tareas/index" options={{ headerShown: true, title: 'Tareas' }} />
        <Stack.Screen name="tarea/nueva" options={{ presentation: 'modal', headerShown: true, title: 'Nueva tarea' }} />
        <Stack.Screen name="tarea/[id]" options={{ headerShown: true, title: 'Tarea' }} />
        <Stack.Screen name="documentos/index" options={{ headerShown: true, title: 'Documentos' }} />
        <Stack.Screen
          name="documento/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: 'Nuevo documento' }}
        />
        <Stack.Screen name="documento/[id]" options={{ headerShown: true, title: 'Documento' }} />
        <Stack.Screen name="notificaciones" options={{ headerShown: true, title: 'Notificaciones' }} />
        <Stack.Screen name="precios" options={{ headerShown: true, title: 'Precios MICM' }} />
        <Stack.Screen name="carga/[id]" options={{ headerShown: true, title: 'Editar carga' }} />
      </Stack>
      {/* Last child, so the dialog sits over every screen the Stack renders. */}
      <AlertHost />
    </>
  );
}
