import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  DEFAULT_SETTINGS,
  getSettings,
  resync,
  scheduledCount,
  sendTest,
  setSettings,
  type NotificationSettings,
} from '@/lib/notifications';
import { t } from '@/lib/i18n';
import { Alert } from '@/lib/alert';
import { useTheme } from '@/lib/theme/useTheme';

const HOURS = [6, 7, 8, 9, 10, 18, 19, 20];

export default function NotificacionesScreen() {
  const { theme } = useTheme();
  const [config, setConfig] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [count, setCount] = useState(0);
  // The registry's flow (ADR-59): the primer first, then the system dialog; blocked → the steps and the settings.
  const notif = usePermissionRequest('notifications');
  // Null until checked, so the warning never flashes on a phone that is fine.
  const permitted = notif.loaded ? notif.status === 'granted' : null;

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
    await resync();
    // What is actually pending, not what the plan meant to schedule.
    setCount(await scheduledCount());
  }

  async function toggle() {
    if (!config.enabled) {
      // Permission is asked here, the first time the user says yes — not on first launch, when the request
      // means nothing to them yet — and after the primer. (The registry creates the channel first: Android 13+
      // shows no prompt without one.) "Ahora no" or blocked: the switch stays off.
      if (!(await notif.ensure())) return;
    }
    await apply({ ...config, enabled: !config.enabled });
  }

  /** The "on but blocked" case: ask again, or send the user to the phone's settings. */
  async function fixPermission() {
    // Primer, or — once Android stops showing the prompt — the steps and the button to the settings.
    if (await notif.ensure()) {
      await resync();
      setCount(await scheduledCount());
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {t.notifications.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {t.notifications.subtitle}
        </T>

        {Platform.OS === 'web' ? (
          <Surface>
            <T face="body" style={{ color: theme.text.secondary, lineHeight: 20 }}>
              {t.notifications.webUnsupported}
            </T>
          </Surface>
        ) : (
          <>
            <Surface>
              <View style={styles.switchRow}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
                  {t.notifications.enable}
                </T>
                <Switch
                  value={config.enabled}
                  onValueChange={() => void toggle()}
                  accessibilityLabel={t.notifications.enable}
                  trackColor={{ true: theme.accentFill, false: theme.lineStrong }}
                />
              </View>
            </Surface>

            {config.enabled && permitted === false ? (
              <Surface style={{ marginTop: space.md, borderColor: theme.status.urgente }}>
                <T face="semibold" style={{ color: theme.statusText.urgente, fontSize: 14 }}>
                  {t.notifications.blockedTitle}
                </T>
                <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                  {t.notifications.blockedBody}
                </T>
                <GhostButton label={t.notifications.blockedAction} onPress={() => void fixPermission()} />
              </Surface>
            ) : null}

            {config.enabled ? (
              <>
                <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
                  {t.notifications.hour}
                </T>
                <View style={styles.row}>
                  {HOURS.map((h) => {
                    const on = config.hour === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => void apply({ ...config, hour: h })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: config.hour === h }}
                        style={[
                          styles.chip,
                          { backgroundColor: on ? theme.accentFill : theme.bg.raised, borderColor: on ? theme.accentFill : theme.line },
                        ]}>
                        <T face="mono" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13 }}>
                          {String(h).padStart(2, '0')}:00
                        </T>
                      </Pressable>
                    );
                  })}
                </View>

                <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
                  {t.notifications.weekday}
                </T>
                <View style={styles.row}>
                  {t.notifications.weekdays.map((name, index) => {
                    const weekday = index + 1;
                    const on = config.weeklyWeekday === weekday;
                    return (
                      <Pressable
                        key={name}
                        onPress={() => void apply({ ...config, weeklyWeekday: weekday })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: config.weeklyWeekday === weekday }}
                        style={[
                          styles.chip,
                          { backgroundColor: on ? theme.accentFill : theme.bg.raised, borderColor: on ? theme.accentFill : theme.line },
                        ]}>
                        <T face="title" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                          {name.slice(0, 3)}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>

                <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.lg }}>
                  {t.notifications.scheduled(count)}
                </T>

                <GhostButton
                  label={t.notifications.test}
                  onPress={() => {
                    void sendTest();
                    Alert.alert(t.notifications.title, t.notifications.testSent);
                  }}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      {notif.sheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 30, lineHeight: 32, textTransform: 'uppercase', letterSpacing: 0.3 },
  sub: { fontSize: 13, marginTop: 2, marginBottom: space.lg, lineHeight: 19 },
  label: { fontSize: 12, marginTop: space.lg, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
});
