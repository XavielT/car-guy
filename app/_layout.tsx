import '@/lib/polyfills';
// Per-weight subpaths, never the package root: importing a package root pulls
// every weight *and* every italic into the bundle — that once put 8 MB of
// unused .ttf into dist/.
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { Michroma_400Regular } from '@expo-google-fonts/michroma/400Regular';
import { SairaCondensed_400Regular } from '@expo-google-fonts/saira-condensed/400Regular';
import { SairaCondensed_600SemiBold } from '@expo-google-fonts/saira-condensed/600SemiBold';
import { SairaCondensed_800ExtraBold } from '@expo-google-fonts/saira-condensed/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, useWindowDimensions, View } from 'react-native';

import { AlertHost } from '@/components/AlertHost';
import { clearBootAttempts, DatabaseBoundary } from '@/components/BootError';
import { NovedadesSheet } from '@/components/changelog/NovedadesSheet';
import { LegalSheet } from '@/components/legal/LegalSheet';
import { FirstSyncBanner } from '@/components/FirstSyncBanner';
import { launchAlreadyRan, LaunchOverlay, markLaunchAppReady } from '@/components/LaunchOverlay';
import { TabsBootSkeleton } from '@/components/skeletons/TabsInicioSkeleton';
import { T } from '@/components/T';
import { fonts } from '@/constants/theme';
import { DATABASE_NAME } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrations';
import { FEATURE_LAUNCH_ANIM } from '@/lib/flags';
import { markGaugeSweptThisSession } from '@/lib/motion/gaugeSweep';
import { configure as configureNotifications, requestResync, routeOf } from '@/lib/notifications';
import { refreshFuelPriceRefOnLaunch } from '@/lib/cloud/fuelPriceRef';
import { initLanguage, localeTag, refreshSystemLanguage, t, useLanguage } from '@/lib/i18n';
import { StoreProvider, useStore } from '@/lib/store';
import { useSyncTriggers } from '@/lib/sync/triggers';
import { useTripService } from '@/lib/trips/useTripService';
import { useUpdateChecks } from '@/lib/updates/useUpdateChecks';
import { useFeedbackBoot } from '@/lib/feedback/useFeedbackBoot';
import { ThemeProvider, useTheme } from '@/lib/theme/useTheme';

/**
 * Car Guy's own boot-failure screen, in Spanish, and the automatic retry for the
 * OPFS handle race on reload. See components/BootError.tsx.
 */
export { BootError as ErrorBoundary } from '@/components/BootError';

SplashScreen.preventAutoHideAsync();

// The animated launch (ADR-36) takes over from the native splash with an
// identical frame, so the native one must go at once — a cross-fade would show
// its needle at rest over the overlay's moving one. It is also this session's
// gauge sweep: the cluster must not sweep again (one sweep per launch).
if (FEATURE_LAUNCH_ANIM) {
  SplashScreen.setOptions({ duration: 0, fade: false });
  markGaugeSweptThisSession();
}

/** False while server-rendering, true once the client owns the tree. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    // Never changes after hydration, so there is nothing to subscribe to.
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * A deep link (a notification, a shared link, carguy://…) opens one screen
 * with nothing under it, so Back left the app. The tabs are the anchor: a
 * deep-linked screen gets Inicio underneath, and Back returns there.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const mounted = useIsClient();
  // Every family named in constants/theme.ts `fonts` must appear here. A weight
  // that is referenced but not loaded falls back to the system font on web
  // without warning.
  const [loaded, error] = useFonts({
    SairaCondensed_400Regular,
    SairaCondensed_600SemiBold,
    SairaCondensed_800ExtraBold,
    // Rajdhani and Noto Sans JP are subset (tools/subset-fonts.sh): the
    // packages carry Devanagari / every kanji, which no screen can show.
    Rajdhani_500Medium: require('../assets/fonts/Rajdhani-Latin_500Medium.ttf'),
    Rajdhani_600SemiBold: require('../assets/fonts/Rajdhani-Latin_600SemiBold.ttf'),
    Rajdhani_700Bold: require('../assets/fonts/Rajdhani-Latin_700Bold.ttf'),
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    Michroma_400Regular,
    NotoSansJP_500Medium: require('../assets/fonts/NotoSansJP-CarGuy_500Medium.ttf'),
    NotoSansJP_700Bold: require('../assets/fonts/NotoSansJP-CarGuy_700Bold.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // The stored language (ADR-39) before the first frame, so a Spanish splash
  // never hands over to an English app or the other way round.
  const [languageRead, setLanguageRead] = useState(false);
  useEffect(() => {
    void initLanguage().finally(() => setLanguageRead(true));
  }, []);
  const ready = loaded && languageRead;

  // With the launch animation the overlay hides the native splash itself, on
  // its first layout (components/LaunchOverlay.tsx).
  useEffect(() => {
    if (ready && !FEATURE_LAUNCH_ANIM) SplashScreen.hideAsync();
  }, [ready]);

  // Once per process: a root rebuilt later (the activity recreated after a swipe
  // from Recents while the trip service kept the process, an error boundary's
  // retry) is not a launch — there is no native splash to take over from.
  const [launching, setLaunching] = useState(FEATURE_LAUNCH_ANIM && !launchAlreadyRan());
  const endLaunch = useCallback(() => setLaunching(false), []);
  // Always the second child of the same fragment, so it keeps its state while
  // the first child goes from nothing to the boot screen to the app.
  const overlay = launching ? <LaunchOverlay key="launch" ready={ready} onDone={endLaunch} /> : null;

  return (
    <>
      <RootContent loaded={ready} mounted={mounted} />
      {overlay}
    </>
  );
}

function RootContent({ loaded, mounted }: { loaded: boolean; mounted: boolean }) {
  // A switch in Más → Idioma re-renders every screen: the navigator is keyed on
  // the language (header titles set in `options` included). 'system' follows a
  // device change when the app comes back to the front — Android does not
  // restart the app for it.
  const { resolved } = useLanguage();
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshSystemLanguage();
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = localeTag(resolved);
  }, [resolved]);

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
              <ShellInLanguage />
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
  const { data, refresh } = useStore();

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

  // v8: the MICM weekly prices into the local cache, once per launch; silent until sql/027 exists.
  // Phase 5: when the newest week is > 8 days old, it also pings /api/precios (once a day).
  useEffect(() => {
    void refreshFuelPriceRefOnLaunch().then((n) => {
      if (n) void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per launch
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestResync();
    });
    return () => listener.remove();
  }, []);
}

/** The boot frame: Inicio's outline, still (ADR-40) — no theme, navigator or database yet. */
function Booting() {
  return <TabsBootSkeleton />;
}

/**
 * The navigator, remounted on a language switch so every screen and header
 * re-renders in the new language. It subscribes itself on purpose: expo-sqlite's
 * SQLiteProvider is memoized with a comparator that ignores `children`, so a
 * key set from RootContent above it never reaches the tree (found on the Redmi:
 * the tab bar stayed in the old language).
 */
function ShellInLanguage() {
  const { resolved } = useLanguage();
  return <Shell key={resolved} />;
}

function Shell() {
  const { theme, scheme } = useTheme();
  useNotifications();
  useSyncTriggers();
  useTripService();
  useFeedbackBoot();
  useUpdateChecks();

  // The shell only renders once the database opened, so reaching here is the
  // proof that the boot succeeded — and the only place that can honestly give
  // this tab its reload budget back.
  useEffect(() => {
    clearBootAttempts();
    markLaunchAppReady();
  }, []);

  // On a desktop browser the app is a 560 px column in the middle of the page
  // (NEXT.md backlog): a phone layout stretched to 1400 px wide reads as broken.
  const { width } = useWindowDimensions();
  const column = Platform.OS === 'web' && width >= 900;

  return (
    <View style={{ flex: 1, backgroundColor: column ? theme.bg.well : theme.bg.base }}>
      <View style={column ? { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.line } : { flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg.base },
          headerTintColor: theme.text.primary,
          headerStyle: { backgroundColor: theme.bg.surface },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.title, fontSize: 18 },
          // Titles are Saira uppercase (05-design-jdm.md). Drawn here rather than
          // by uppercasing `title`, which is also the browser tab's text.
          // An @handle keeps its case: handles are what people type to find you.
          headerTitle: ({ children, tintColor }) => (
            <T face="title" numberOfLines={1} style={{ color: tintColor ?? theme.text.primary, fontSize: 18, letterSpacing: 0.8, textTransform: typeof children === 'string' && children.startsWith('@') ? 'none' : 'uppercase' }}>
              {children}
            </T>
          ),
        }}>
        {/* These titles are what the browser tab shows on web: expo-router feeds
            the screen title to react-helmet, and a screen without one renders an
            empty <title> that wins over anything static in +html.tsx. */}
        <Stack.Screen name="(tabs)" options={{ title: t.routes.home }} />
        <Stack.Screen name="onboarding" options={{ title: t.routes.home }} />
        <Stack.Screen name="bienvenida/index" options={{ title: t.welcome.route, gestureEnabled: false }} />
        <Stack.Screen
          name="vehiculo/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: t.routes.newVehicle }}
        />
        <Stack.Screen name="vehiculo/[id]" options={{ headerShown: true, title: t.routes.vehicle }} />
        <Stack.Screen name="vehiculo/[id]/editar" options={{ headerShown: true, title: t.routes.editVehicle }} />
        <Stack.Screen name="vehiculo/[id]/album/index" options={{ headerShown: true, title: t.routes.album }} />
        <Stack.Screen name="vehiculo/[id]/album/estado" options={{ headerShown: true, title: t.routes.albumState }} />
        <Stack.Screen name="album/importar" options={{ headerShown: true, title: t.routes.importPhotos }} />
        {/* Always dark and edge to edge: a photo reads best on black. */}
        <Stack.Screen name="foto/[id]" options={{ presentation: 'fullScreenModal', headerShown: false, title: t.routes.photo, contentStyle: { backgroundColor: '#000000' } }} />
        {/* 2.3's hito routes redirect to the event editor (ADR-44). */}
        <Stack.Screen name="hito/nuevo" options={{ headerShown: false, title: t.routes.newMilestone }} />
        <Stack.Screen name="hito/[id]" options={{ headerShown: false, title: t.routes.milestone }} />
        <Stack.Screen name="evento/nuevo" options={{ presentation: 'modal', headerShown: true, title: t.events.routeNew }} />
        <Stack.Screen name="evento/[id]" options={{ headerShown: true, title: t.events.route }} />
        <Stack.Screen name="vehiculo/[id]/build" options={{ headerShown: true, title: t.routes.build }} />
        <Stack.Screen name="mod/nuevo" options={{ presentation: 'modal', headerShown: true, title: t.routes.newMod }} />
        <Stack.Screen name="mod/[id]" options={{ headerShown: true, title: t.routes.mod }} />
        <Stack.Screen name="wishlist/nuevo" options={{ presentation: 'modal', headerShown: true, title: t.routes.newWish }} />
        <Stack.Screen name="wishlist/[id]" options={{ headerShown: true, title: t.routes.wish }} />
        <Stack.Screen name="inventario/nuevo" options={{ presentation: 'modal', headerShown: true, title: t.routes.newInventory }} />
        <Stack.Screen name="inventario/[id]" options={{ headerShown: true, title: t.routes.inventory }} />
        <Stack.Screen name="ruedas/[setId]" options={{ headerShown: true, title: t.routes.wheelSet }} />
        <Stack.Screen name="goma/[id]" options={{ headerShown: true, title: t.routes.tire }} />
        <Stack.Screen name="vehiculo/[id]/ficha" options={{ headerShown: true, title: t.routes.ficha }} />
        <Stack.Screen name="vehiculo/[id]/fluidos" options={{ headerShown: true, title: t.routes.fluids }} />
        <Stack.Screen name="obd/index" options={{ headerShown: true, title: t.routes.obd }} />
        <Stack.Screen name="obd/[code]" options={{ headerShown: true, title: t.routes.obdCode }} />
        <Stack.Screen name="contactos/index" options={{ headerShown: true, title: t.routes.contacts }} />
        <Stack.Screen name="contactos/nuevo" options={{ presentation: 'modal', headerShown: true, title: t.routes.newContact }} />
        <Stack.Screen name="contactos/[id]" options={{ headerShown: true, title: t.routes.contact }} />
        <Stack.Screen name="vehiculo/[id]/compartir" options={{ headerShown: true, title: t.routes.share }} />
        <Stack.Screen name="vehiculo/[id]/libro" options={{ headerShown: true, title: t.routes.book }} />
        <Stack.Screen name="garaje/miembros" options={{ headerShown: true, title: t.routes.members }} />
        <Stack.Screen name="invitacion/[code]" options={{ headerShown: true, title: t.routes.invite }} />
        <Stack.Screen name="compartidos" options={{ headerShown: true, title: t.routes.shares }} />
        <Stack.Screen name="pista/index" options={{ headerShown: true, title: t.routes.track }} />
        <Stack.Screen name="pista/evento/nuevo" options={{ presentation: 'modal', headerShown: true, title: t.routes.newTrackEvent }} />
        <Stack.Screen name="pista/evento/[id]" options={{ headerShown: true, title: t.routes.trackEvent }} />
        <Stack.Screen name="pista/sesion/nueva" options={{ headerShown: true, title: t.routes.newTrackSession }} />
        <Stack.Screen name="pista/sesion/[id]" options={{ headerShown: true, title: t.routes.trackSession }} />
        <Stack.Screen name="cifras" options={{ headerShown: true, title: t.tabs.cifras }} />
        <Stack.Screen
          name="conducir"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', headerShown: false, title: t.drive.eyebrow, contentStyle: { backgroundColor: '#0B0F14' } }}
        />
        <Stack.Screen name="viajes/index" options={{ headerShown: true, title: t.routes.trips }} />
        <Stack.Screen name="viajes/ajustes" options={{ headerShown: true, title: t.routes.tripSettings }} />
        <Stack.Screen name="viajes/permisos" options={{ headerShown: true, title: t.routes.tripPermissions }} />
        <Stack.Screen name="viaje/[id]" options={{ headerShown: true, title: t.routes.trip }} />
        <Stack.Screen
          name="odometro"
          options={{ presentation: 'modal', headerShown: true, title: t.routes.odometer }}
        />
        <Stack.Screen name="carga/nueva" options={{ headerShown: true, title: t.routes.newFillUp }} />
        <Stack.Screen
          name="servicio/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: t.routes.newService }}
        />
        <Stack.Screen name="servicio/[id]" options={{ headerShown: true, title: t.routes.service }} />
        <Stack.Screen
          name="gasto/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: t.routes.expense }}
        />
        <Stack.Screen name="gasto/[id]" options={{ headerShown: true, title: t.routes.expense }} />
        <Stack.Screen name="chequeo/index" options={{ headerShown: true, title: t.routes.check }} />
        <Stack.Screen name="chequeo/[templateId]/run" options={{ headerShown: true, title: t.routes.check }} />
        <Stack.Screen name="chequeo/guia" options={{ headerShown: true, title: t.routes.guide }} />
        <Stack.Screen name="chequeo/plantillas/[id]" options={{ headerShown: true, title: t.routes.templateEditor }} />
        <Stack.Screen name="inspeccion/[id]" options={{ headerShown: true, title: t.routes.inspection }} />
        <Stack.Screen name="recordatorios/index" options={{ headerShown: true, title: t.routes.reminders }} />
        <Stack.Screen name="recordatorio/[id]" options={{ headerShown: true, title: t.routes.reminder }} />
        <Stack.Screen name="recordatorio/nuevo" options={{ headerShown: true, title: t.reminders.newTitle }} />
        <Stack.Screen name="catalogo/index" options={{ headerShown: true, title: t.catalog.title }} />
        <Stack.Screen name="catalogo/[id]" options={{ headerShown: true, title: t.catalog.title }} />
        <Stack.Screen name="tareas/index" options={{ headerShown: true, title: t.routes.tasks }} />
        <Stack.Screen name="tarea/nueva" options={{ presentation: 'modal', headerShown: true, title: t.routes.newTask }} />
        <Stack.Screen name="tarea/[id]" options={{ headerShown: true, title: t.routes.task }} />
        <Stack.Screen name="documentos/index" options={{ headerShown: true, title: t.routes.documents }} />
        <Stack.Screen
          name="documento/nuevo"
          options={{ presentation: 'modal', headerShown: true, title: t.routes.newDocument }}
        />
        <Stack.Screen name="documento/[id]" options={{ headerShown: true, title: t.routes.document }} />
        <Stack.Screen name="notificaciones" options={{ headerShown: true, title: t.routes.notifications }} />
        <Stack.Screen name="precios/index" options={{ headerShown: true, title: t.routes.prices }} />
        <Stack.Screen name="precios/nuevo" options={{ presentation: 'modal', headerShown: true, title: t.fuelPricesUi.newTitle }} />
        <Stack.Screen name="carga/[id]" options={{ headerShown: true, title: t.routes.editFillUp }} />
        <Stack.Screen name="reporte" options={{ headerShown: true, title: t.routes.report }} />
        <Stack.Screen name="exportar" options={{ headerShown: true, title: t.routes.export }} />
        <Stack.Screen name="cuenta" options={{ headerShown: true, title: t.routes.account }} />
        <Stack.Screen name="nueva-contrasena" options={{ headerShown: true, title: t.routes.newPassword }} />
        <Stack.Screen name="versiones" options={{ headerShown: true, title: t.versions.title }} />
        <Stack.Screen name="apoyar" options={{ headerShown: true, title: t.support.title }} />
        <Stack.Screen name="instalar" options={{ headerShown: true, title: t.install.title }} />
        <Stack.Screen name="legal/index" options={{ headerShown: true, title: t.legalUi.title }} />
        <Stack.Screen name="legal/[doc]" options={{ headerShown: true, title: t.legalUi.title }} />
        <Stack.Screen name="borrar-cuenta" options={{ headerShown: true, title: t.deleteAccount.title }} />
      </Stack>
      <NovedadesSheet />
      {/* After Novedades in the tree; it waits for that sheet to close (ADR-47). */}
      <LegalSheet />
      <FirstSyncBanner />
      {/* Last child, so the dialog sits over every screen the Stack renders. */}
      <AlertHost />
      </View>
    </View>
  );
}
