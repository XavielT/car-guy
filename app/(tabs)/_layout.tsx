import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { TabsInicioSkeleton } from '@/components/skeletons/TabsInicioSkeleton';
import { CarGuyTabBar } from '@/components/tabbar';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { FEATURE_ONBOARDING_V2 } from '@/lib/flagsV8';
import { t } from '@/lib/i18n';
import { useWelcomeGate } from '@/lib/onboarding/welcome';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Car Guy's tabs (IMP 30092026 Phase 4, ADR-43): Inicio · Garaje · [CONDUCIR] ·
 * Historial · Más. Cifras left the bar for a stack screen (`app/cifras.tsx`),
 * reached from Más (first row) and Inicio's quick actions. Chequeo left the bar for the Garaje; it lives at
 * `chequeo/index` and is reached from Inicio's QuickActions and telltale, from
 * Más and from its notification. Fuel is `carga/nueva`, from QuickActions.
 */
export default function TabLayout() {
  const { ready, data } = useStore();
  const { theme } = useTheme();
  // While the store opens: Inicio's outline (ADR-40), after 150 ms so a fast
  // open paints straight to the tabs; before that, the bare background.
  // The welcome (PROMPT-06): `onboarded_version` unset → /bienvenida. An install
  // upgraded from 2.3.x (vehicles already there) is marked onboarded here, unseen.
  const welcome = useWelcomeGate(ready, data.vehicles.length, FEATURE_ONBOARDING_V2);
  const showSkeleton = useDelayedLoading(!ready || welcome === 'loading');

  if (showSkeleton) return <TabsInicioSkeleton />;
  if (!ready || welcome === 'loading') return <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;

  if (welcome === 'show') return <Redirect href="/bienvenida" />;

  if (data.vehicles.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      // The custom bar with the CONDUCIR disc in the middle (ADR-43); it draws the
      // icons and titles below and handles the safe area and the keyboard itself.
      tabBar={(props) => <CarGuyTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.inicio,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="garaje"
        options={{
          title: t.tabs.garaje,
          tabBarIcon: ({ color, size }) => <Ionicons name="car-sport-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: t.tabs.historial,
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: t.tabs.mas,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
