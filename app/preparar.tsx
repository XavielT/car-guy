import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { isMiuiPhone } from '@/components/trips/TripPieces';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { openAppSettings, recheckPermissions } from '@/lib/permissions';
import { useTheme } from '@/lib/theme/useTheme';
import { armAuto } from '@/lib/trips/auto';
import { setTripsMode } from '@/lib/trips/settings';
import { getAutostartState, openAutostartSettings } from '@/modules/miui-autostart';
import { activityPermissionGranted } from '@/lib/trips/nativeTrigger';

/**
 * "Prepara tu teléfono": every switch automatic trips need, in one place, one at a time. The person taps one button;
 * the app explains, asks (or opens the exact system page), and moves on by itself when the phone says it is granted
 * (re-read whenever the app comes back to the foreground). Android only: a phone that is not Xiaomi skips autostart.
 */
type StepId = 'notifications' | 'location_foreground' | 'location_background' | 'activity' | 'battery_unrestricted' | 'autostart';

export default function PrepareScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const notifications = usePermissionRequest('notifications');
  const fg = usePermissionRequest('location_foreground');
  const bg = usePermissionRequest('location_background');
  const battery = usePermissionRequest('battery_unrestricted');
  const miui = isMiuiPhone();
  const [autostart, setAutostart] = useState(() => getAutostartState());
  /** MIUI does not always say its autostart state (`unknown`): then the person confirms by hand. */
  const [autostartConfirmed, setAutostartConfirmed] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  /** Activity Recognition (Android 10+): lets the phone say "you are in a vehicle" while the app is closed. */
  const [activity, setActivity] = useState<boolean>(() => Platform.OS !== 'android' || Number(Platform.Version) < 29 || activityPermissionGranted());

  const reread = useCallback(() => {
    void recheckPermissions();
    setAutostart(getAutostartState());
    setActivity(Platform.OS !== 'android' || Number(Platform.Version) < 29 || activityPermissionGranted());
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && reread());
    return () => sub.remove();
  }, [reread]);

  const granted = (s: string) => s === 'granted';
  const doneOf: Record<StepId, boolean> = {
    notifications: granted(notifications.status),
    location_foreground: granted(fg.status),
    location_background: granted(bg.status),
    activity,
    // `unknown` = an old APK or a phone that does not say: treat as done so a person is never stuck on it.
    battery_unrestricted: granted(battery.status) || battery.status === 'unknown',
    autostart: !miui || autostart === 'enabled' || autostartConfirmed,
  };
  const order: StepId[] = ['notifications', 'location_foreground', 'location_background', 'activity', 'battery_unrestricted', ...(miui ? (['autostart'] as StepId[]) : [])];
  const current = order.find((id) => !doneOf[id]) ?? null;
  const doneCount = order.filter((id) => doneOf[id]).length;

  const act = async (id: StepId) => {
    if (id === 'notifications') await notifications.ensure();
    else if (id === 'location_foreground') await fg.ensure();
    else if (id === 'location_background') {
      // "Todo el tiempo" needs the foreground permission first; ask it in the same tap if it is missing.
      if (!doneOf.location_foreground && !(await fg.ensure())) return;
      await bg.outcome();
    } else if (id === 'activity') {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
      // "No volver a preguntar": the system will not show the dialog again, so send the person to the app's settings.
      if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) await openAppSettings();
    } else if (id === 'battery_unrestricted') await battery.ensure();
    else if (!openAutostartSettings()) await openAppSettings();
    reread();
  };

  const enableAuto = async () => {
    await setTripsMode('auto');
    await armAuto();
    setAutoOn(true);
  };

  if (Platform.OS === 'web') {
    return (
      <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
        <T face="body" style={{ color: theme.text.secondary }}>
          {t.permissions.intro}
        </T>
        <GhostButton label={t.prepare.back} onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.prepare.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {t.prepare.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginVertical: space.md }}>
        {t.prepare.intro}
      </T>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 13, marginBottom: space.sm }}>
        {t.prepare.progress(doneCount, order.length)}
      </T>

      {order.map((id) => {
        const copy = t.prepare.steps[id];
        const isDone = doneOf[id];
        const isNow = id === current;
        return (
          <Surface key={id} padded style={[styles.card, isNow && { borderColor: theme.accent, borderWidth: 1 }]}>
            <View style={styles.row}>
              <Ionicons name={isDone ? 'checkmark-circle' : isNow ? 'ellipse-outline' : 'ellipse-outline'} size={22} color={isDone ? theme.statusText.ok : isNow ? theme.accent : theme.text.secondary} />
              <T face="title" style={{ color: theme.text.primary, fontSize: 16, flex: 1 }}>
                {copy.title}
              </T>
              <T face="semibold" style={{ color: isDone ? theme.statusText.ok : isNow ? theme.accent : theme.text.secondary, fontSize: 12 }}>
                {isDone ? t.prepare.done : isNow ? t.prepare.now : t.prepare.todo}
              </T>
            </View>
            {isNow ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
                  {copy.why}
                </T>
                <PrimaryButton label={copy.cta} onPress={() => void act(id)} />
                {id === 'autostart' ? <GhostButton label={t.prepare.steps.autostart.confirm} onPress={() => setAutostartConfirmed(true)} /> : null}
              </View>
            ) : null}
          </Surface>
        );
      })}

      {current === null ? (
        <Surface padded style={styles.card}>
          <T face="title" style={{ color: theme.text.primary, fontSize: 17 }}>
            {t.prepare.allDone}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginVertical: space.sm }}>
            {t.prepare.allDoneBody}
          </T>
          {autoOn ? (
            <T face="semibold" style={{ color: theme.statusText.ok, fontSize: 14 }}>
              {t.prepare.autoOn}
            </T>
          ) : (
            <PrimaryButton label={t.prepare.enableAuto} onPress={() => void enableAuto()} />
          )}
        </Surface>
      ) : null}

      <GhostButton label={t.prepare.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {notifications.sheet}
      {fg.sheet}
      {bg.sheet}
      {battery.sheet}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg, gap: space.sm, paddingBottom: space.xl * 2 },
  card: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
