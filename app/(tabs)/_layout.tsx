import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabsInicioSkeleton } from '@/components/skeletons/TabsInicioSkeleton';
import { fonts } from '@/constants/theme';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Car Guy's five tabs (IMP 28092026, 03-screens.md): Inicio · Garaje ·
 * Historial · Cifras · Más. Chequeo left the bar for the Garaje; it lives at
 * `chequeo/index` and is reached from Inicio's QuickActions and telltale, from
 * Más and from its notification. Fuel is `carga/nueva`, from QuickActions.
 */
export default function TabLayout() {
  const { ready, data } = useStore();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // While the store opens: Inicio's outline (ADR-40), after 150 ms so a fast
  // open paints straight to the tabs; before that, the bare background.
  const showSkeleton = useDelayedLoading(!ready);

  if (showSkeleton) return <TabsInicioSkeleton />;
  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;

  if (data.vehicles.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.text.muted,
        tabBarStyle: {
          backgroundColor: theme.bg.surface,
          borderTopColor: theme.lineStrong,
          height: 68 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
        },
        tabBarHideOnKeyboard: true,
        // Saira's tall caps clip at the default line height on web; give them room.
        tabBarLabelStyle: { fontFamily: fonts.title, fontSize: 11, lineHeight: 15, letterSpacing: 0.9, textTransform: 'uppercase' },
      }}>
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
        name="cifras"
        options={{
          title: t.tabs.cifras,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
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
