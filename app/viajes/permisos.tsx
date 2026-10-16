import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { MiuiChecklist, useAutoReadiness } from '@/components/trips/TripPieces';
import { Badge, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { recordError } from '@/lib/diagnostics';
import { checkPermission } from '@/lib/permissions/store';
import { armAuto } from '@/lib/trips/auto';
import { setTripsMode, tripsMode, type TripsMode } from '@/lib/trips/settings';

/**
 * Viajes → permisos (03-screens.md "Phase 5"): the three levels explained —
 * Nada / Solo manual / Automático. Automático asks in order: the foreground
 * permission, then "todo el tiempo" (Android 11+ sends the user to the system
 * settings for it; the screen re-checks on return and arms the service), and
 * on Xiaomi phones shows the MIUI checklist.
 */
export default function TripPermissionsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  // The registry's flows (ADR-59): each explains first (primer), then asks, or shows how when it is blocked.
  const fg = usePermissionRequest('location_foreground');
  const bg = usePermissionRequest('location_background');
  const notifications = usePermissionRequest('notifications');
  const auto = useAutoReadiness();
  const [mode, setMode] = useState<TripsMode | null>(null);
  /** "Activar automático" was tapped: turn it on once the permission comes back granted. */
  const pending = useRef(false);
  useEffect(() => {
    void tripsMode().then(setMode);
  }, []);
  const turnOn = async () => {
    pending.current = false;
    await setTripsMode('auto');
    setMode('auto');
    await armAuto();
  };
  // Back from the system settings with "todo el tiempo" granted.
  useEffect(() => {
    if (pending.current && auto.state === 'ready') void turnOn();
  }, [auto.state]);

  const enableAuto = async () => {
    pending.current = true;
    try {
      if (!(await fg.ensure())) {
        pending.current = false;
        return;
      }
      // (read again: the closure's `fg.detail` is from before the primer)
      if ((await checkPermission('location_foreground')).detail !== 'approximate') {
        // Android 13+: without this the service still runs, but its fixed notification ("Detección automática de
        // viajes activa") is never shown — and the person should always see that the app is watching. Optional.
        await notifications.ensure();
        // "Todo el tiempo": the primer carries Play's prominent disclosure and the steps; Android 11+ then opens the
        // settings page, and the screen re-reads on return (the effect above arms the service).
        if ((await bg.outcome()) === 'declined') {
          pending.current = false;
          return;
        }
      }
    } catch (error) {
      recordError('trip-permission', error);
    }
    // Already granted (the prompt returned at once): the state does not change,
    // so the effect above would not run — turn it on here.
    if ((await auto.check()) === 'ready') await turnOn();
  };
  const autoOn = mode === 'auto' && auto.state === 'ready';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/viajes/ajustes'));

  const card = (key: 'none' | 'manual' | 'auto', action?: React.ReactNode, badge?: string) => (
    <Surface padded style={styles.card}>
      <View style={styles.cardTop}>
        <T face="title" style={{ color: theme.text.primary, fontSize: 18, textTransform: 'uppercase', flex: 1 }}>
          {t.trips.permCards[key].title}
        </T>
        {badge ? <Badge label={badge} tone={key === 'manual' ? 'amber' : 'red'} /> : null}
      </View>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
        {t.trips.permCards[key].body}
      </T>
      {action}
    </Surface>
  );

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.trips.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {t.trips.permTitle}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginVertical: space.md }}>
        {t.trips.permIntro}
      </T>

      {card(
        'none',
        <GhostButton
          label={t.trips.permOff}
          onPress={() => {
            void setTripsMode('off');
            back();
          }}
        />,
      )}
      {card(
        'manual',
        fg.status === 'granted' ? (
          <T face="semibold" style={{ color: theme.statusText.ok, fontSize: 14, marginTop: space.sm }}>
            {t.trips.permGranted}
          </T>
        ) : (
          <View style={{ marginTop: space.sm }}>
            <PrimaryButton
              label={fg.status === 'denied_blocked' || fg.status === 'services_off' ? t.permissions.actions.how : t.trips.permRequest}
              onPress={() =>
                void (async () => {
                  await setTripsMode('manual');
                  await fg.ensure();
                })()
              }
            />
          </View>
        ),
        t.permissions.states[fg.status].toUpperCase(),
      )}
      {Platform.OS !== 'web'
        ? card(
            'auto',
            autoOn ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <T face="semibold" style={{ color: theme.statusText.ok, fontSize: 14 }}>
                  {t.trips.permAutoOn}
                </T>
                <GhostButton
                  label={t.trips.permAutoOff}
                  onPress={() =>
                    void (async () => {
                      await setTripsMode('manual');
                      setMode('manual');
                      await armAuto();
                    })()
                  }
                />
              </View>
            ) : (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {auto.state && auto.state !== 'ready' && auto.state !== 'foreground' ? (
                  <T face="body" style={{ color: theme.statusText.proximo, fontSize: 13, lineHeight: 18 }}>
                    {t.trips.readiness[auto.state]}
                  </T>
                ) : null}
                <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
                  {t.trips.permAutoStep}
                </T>
                <PrimaryButton label={t.trips.permAuto} onPress={() => void enableAuto()} disabled={auto.state === 'unavailable'} />
              </View>
            ),
            autoOn ? t.trips.modes.auto.toUpperCase() : undefined,
          )
        : card('auto')}
      {Platform.OS !== 'web' ? <MiuiChecklist /> : null}
      {fg.sheet}
      {bg.sheet}
      {notifications.sheet}

      {Platform.OS === 'web' ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginBottom: space.md }}>
          {t.trips.permWeb}
        </T>
      ) : null}
      <GhostButton label={t.trips.permLater} onPress={back} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  card: { marginBottom: space.md, gap: space.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
