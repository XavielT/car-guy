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
import { clearBootAttempts, DatabaseBoundary } from '@/components/BootError';
import { FirstSyncBanner } from '@/components/FirstSyncBanner';
import { fonts, palette } from '@/constants/theme';
import { DATABASE_NAME } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrations';
import { es } from '@/lib/i18n/es';
import { configure as configureNotifications, requestResync, routeOf } from '@/lib/notifications';
import { StoreProvider, useStore } from '@/lib/store';
import { useSyncTriggers } from '@/lib/sync/triggers';
import { ThemeProvider, useTheme } from '@/lib/theme/useTheme';

/**
 * Car Guy's own boot-failure screen, in Spanish, and the automatic retry for the
 * OPFS handle race on reload. See components/BootError.tsx.
 */
export { BootError as ErrorBoundary } from '@/components/BootError';

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
      <DatabaseBoundary>
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
      </DatabaseBoundary>
    </ThemeProvider>
  );
}

/**
 * Notification wiring: create the channel, follow a tapped notification to its
 * screen — including the tap that launched the app from closed — and rebuild
 * the schedule after writes (debounced: `data` changes on every one) and
 * whenever the app comes back to the foreground, so a plan can never go stale
 * after a day of edits made elsewhere.
 */
function useNotifications() {
  const router = useRouter();
  const { data } = useStore();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void configureNotifications();

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    void import('expo-notifications').then(async (N) => {
      if (cancelled) return;
      subscription = N.addNotificationResponseReceivedListener((response) => {
        const route = routeOf(response);
        if (route) router.push(route as never);
      });
      // A tap on a notification while the app was closed arrives as the "last
      // response" rather than through the listener. Cleared once followed, so a
      // later remount does not send the user back there.
      const launch = await N.getLastNotificationResponseAsync();
      const route = launch ? routeOf(launch) : null;
      if (route && !cancelled) {
        await N.clearLastNotificationResponseAsync();
        router.push(route as never);
      }
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [router]);

  useEffect(() => {
    requestResync();
  }, [data]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestResync();
    });
    return () => listener.remove();
  }, []);
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
  useSyncTriggers();

  // The shell only renders once the database opened, so reaching here is the
  // proof that the boot succeeded — and the only place that can honestly give
  // this tab its reload budget back.
  useEffect(() => {
    clearBootAttempts();
  }, []);

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
        <Stack.Screen name="(tabs)" options={{ title: es.routes.home }} />
        <Stack.Screen name="onboarding" options={{ title: es.routes.home }} />
        <Stack.Screen
          name="vehiculo/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: es.routes.newVehicle }}
        />
        <Stack.Screen name="vehiculo/[id]" options={{ headerShown: true, title: es.routes.vehicle }} />
        <Stack.Screen name="vehiculo/[id]/editar" options={{ headerShown: true, title: es.routes.editVehicle }} />
        <Stack.Screen
          name="odometro"
          options={{ presentation: 'modal', headerShown: true, title: es.routes.odometer }}
        />
        <Stack.Screen name="carga/nueva" options={{ headerShown: true, title: es.routes.newFillUp }} />
        <Stack.Screen
          name="servicio/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: es.routes.newService }}
        />
        <Stack.Screen name="servicio/[id]" options={{ headerShown: true, title: es.routes.service }} />
        <Stack.Screen
          name="gasto/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: es.routes.expense }}
        />
        <Stack.Screen name="gasto/[id]" options={{ headerShown: true, title: es.routes.expense }} />
        <Stack.Screen name="chequeo/[templateId]/run" options={{ headerShown: true, title: es.routes.check }} />
        <Stack.Screen name="chequeo/guia" options={{ headerShown: true, title: es.routes.guide }} />
        <Stack.Screen name="chequeo/plantillas/[id]" options={{ headerShown: true, title: es.routes.templateEditor }} />
        <Stack.Screen name="inspeccion/[id]" options={{ headerShown: true, title: es.routes.inspection }} />
        <Stack.Screen name="recordatorios/index" options={{ headerShown: true, title: es.routes.reminders }} />
        <Stack.Screen name="recordatorio/[id]" options={{ headerShown: true, title: es.routes.reminder }} />
        <Stack.Screen name="recordatorio/nuevo" options={{ headerShown: true, title: es.reminders.newTitle }} />
        <Stack.Screen name="catalogo/index" options={{ headerShown: true, title: es.catalog.title }} />
        <Stack.Screen name="catalogo/[id]" options={{ headerShown: true, title: es.catalog.title }} />
        <Stack.Screen name="tareas/index" options={{ headerShown: true, title: es.routes.tasks }} />
        <Stack.Screen name="tarea/nueva" options={{ presentation: 'modal', headerShown: true, title: es.routes.newTask }} />
        <Stack.Screen name="tarea/[id]" options={{ headerShown: true, title: es.routes.task }} />
        <Stack.Screen name="documentos/index" options={{ headerShown: true, title: es.routes.documents }} />
        <Stack.Screen
          name="documento/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: es.routes.newDocument }}
        />
        <Stack.Screen name="documento/[id]" options={{ headerShown: true, title: es.routes.document }} />
        <Stack.Screen name="notificaciones" options={{ headerShown: true, title: es.routes.notifications }} />
        <Stack.Screen name="precios" options={{ headerShown: true, title: es.routes.prices }} />
        <Stack.Screen name="carga/[id]" options={{ headerShown: true, title: es.routes.editFillUp }} />
        <Stack.Screen name="reporte" options={{ headerShown: true, title: es.routes.report }} />
        <Stack.Screen name="exportar" options={{ headerShown: true, title: es.routes.export }} />
        <Stack.Screen name="cuenta" options={{ headerShown: true, title: es.routes.account }} />
      </Stack>
      <FirstSyncBanner />
      {/* Last child, so the dialog sits over every screen the Stack renders. */}
      <AlertHost />
    </>
  );
}
