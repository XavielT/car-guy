import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Car Guy's five tabs (03-screens-ia.md). "Cargar" is deliberately not one of
 * them any more: fuel is one kind of care among several, so it moved to
 * `carga/nueva` and is reached from the home screen's QuickActions.
 */
export default function TabLayout() {
  const { ready, data } = useStore();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg.base,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

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
          borderTopColor: theme.line,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: es.tabs.inicio,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chequeo"
        options={{
          title: es.tabs.chequeo,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: es.tabs.historial,
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cifras"
        options={{
          title: es.tabs.cifras,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: es.tabs.mas,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
