import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  DEFAULT_SETTINGS,
  getSettings,
  requestPermission,
  resync,
  scheduledCount,
  sendTest,
  setSettings,
  type NotificationSettings,
} from '@/lib/notifications';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const HOURS = [6, 7, 8, 9, 10, 18, 19, 20];

export default function NotificacionesScreen() {
  const { theme } = useTheme();
  const { activeVehicle } = useStore();
  const [config, setConfig] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [current, pending] = await Promise.all([getSettings(), scheduledCount()]);
      if (cancelled) return;
      setConfig(current);
      setCount(pending);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function apply(next: NotificationSettings) {
    setConfig(next);
    await setSettings(next);
    if (activeVehicle) {
      const plan = await resync(activeVehicle.id);
      setCount(plan.length);
    }
  }

  async function toggle() {
    if (!config.enabled) {
      // Permission is asked here, the first time the user says yes — not on
      // first launch, when the request means nothing to them yet.
      const granted = await requestPermission();
      if (!granted) return Alert.alert(es.notifications.title, es.notifications.denied);
    }
    await apply({ ...config, enabled: !config.enabled });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.notifications.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.notifications.subtitle}
        </T>

        {Platform.OS === 'web' ? (
          <Surface>
            <T face="body" style={{ color: theme.text.secondary, lineHeight: 20 }}>
              {es.notifications.webUnsupported}
            </T>
          </Surface>
        ) : (
          <>
            <PrimaryButton
              label={config.enabled ? `${es.notifications.enable} · activado` : es.notifications.enable}
              onPress={() => void toggle()}
            />

            {config.enabled ? (
              <>
                <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
                  {es.notifications.hour}
                </T>
                <View style={styles.row}>
                  {HOURS.map((h) => {
                    const on = config.hour === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => void apply({ ...config, hour: h })}
                        style={[
                          styles.chip,
                          { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.line },
                        ]}>
                        <T face="mono" style={{ color: on ? theme.accentInk : theme.text.secondary, fontSize: 13 }}>
                          {String(h).padStart(2, '0')}:00
                        </T>
                      </Pressable>
                    );
                  })}
                </View>

                <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
                  {es.notifications.weekday}
                </T>
                <View style={styles.row}>
                  {es.notifications.weekdays.map((name, index) => {
                    const weekday = index + 1;
                    const on = config.weeklyWeekday === weekday;
                    return (
                      <Pressable
                        key={name}
                        onPress={() => void apply({ ...config, weeklyWeekday: weekday })}
                        style={[
                          styles.chip,
                          { backgroundColor: on ? theme.accent : theme.bg.raised, borderColor: on ? theme.accent : theme.line },
                        ]}>
                        <T face="semibold" style={{ color: on ? theme.accentInk : theme.text.secondary, fontSize: 12 }}>
                          {name.slice(0, 3)}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>

                <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.lg }}>
                  {es.notifications.scheduled(count)}
                </T>

                <GhostButton
                  label={es.notifications.test}
                  onPress={() => {
                    void sendTest();
                    Alert.alert(es.notifications.title, es.notifications.testSent);
                  }}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  label: { fontSize: 13, marginTop: space.lg, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
});
