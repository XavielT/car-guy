import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { isMiuiPhone, useAutoReadiness } from '@/components/trips/TripPieces';
import { GhostButton, PrimaryButton, StatusRow, Surface } from '@/components/ui';
import type { StatusTone } from '@/components/ui/StatusRow';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { armAuto, isAutoArmed } from '@/lib/trips/auto';
import { shareTripDiagnostics } from '@/lib/trips/diagnostics';
import { activityPermissionGranted, importNativeEvents, ingestNativeSessions } from '@/lib/trips/nativeTrigger';
import { tripsMode, type TripsMode } from '@/lib/trips/settings';
import { readTimeline, summarize, type TimelineEntry } from '@/lib/trips/timeline';
import { getAutostartState, getBatteryState } from '@/modules/miui-autostart';
import { isNativeRecording, isTripTriggerArmed, lastExitReasons, tripTriggerAvailable } from '@/modules/trip-trigger';

/**
 * Viajes → Estado de la detección (PROMPT-09 step 7): one screen that says, in plain words, whether a trip will be recorded when
 * you get in the car, why not when it will not, and what the phone did the last times (the native events and the system's kills).
 * Every row is a real reading, never a guess; "Revisar ahora" re-arms and takes whatever the native recorder saved.
 */
type Row = { key: string; label: string; status: string; tone: StatusTone; onPress?: () => void };

const hhmm = (t0: number) => new Date(t0).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function DetectionStatusScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auto = useAutoReadiness();
  const [mode, setMode] = useState<TripsMode | null>(null);
  const [appService, setAppService] = useState(false);
  const [recent, setRecent] = useState<TimelineEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setMode(await tripsMode());
    setAppService(await isAutoArmed());
    importNativeEvents();
    setRecent((await readTimeline()).slice(-400));
    setTick((n) => n + 1);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads async device state (settings, native module) after the first await
    void refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    return () => sub.remove();
  }, [refresh]);

  const checkNow = async () => {
    setBusy(true);
    setNote(null);
    try {
      await armAuto();
      const r = await ingestNativeSessions();
      await auto.check();
      setNote(r.fixes ? t.tripStatus.tookTrip(r.fixes) : t.tripStatus.checked);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const native = tripTriggerAvailable;
  // `tick` re-reads the synchronous native answers after each refresh.
  void tick;
  const triggerArmed = native && isTripTriggerArmed();
  const rows: Row[] = [];
  rows.push({
    key: 'mode',
    label: t.tripStatus.mode,
    status: mode === 'auto' ? t.tripStatus.modeAuto : mode === 'manual' ? t.tripStatus.modeManual : t.tripStatus.modeOff,
    tone: mode === 'auto' ? 'ok' : 'vencido',
    onPress: () => router.push('/viajes/permisos'),
  });
  rows.push({
    key: 'perm',
    label: t.tripStatus.permissions,
    status: auto.state === 'ready' ? t.tripStatus.permOk : t.tripStatus.permMissing,
    tone: auto.state === 'ready' ? 'ok' : 'vencido',
    onPress: () => router.push('/preparar' as never),
  });
  if (Platform.OS === 'android') {
    rows.push({
      key: 'activity',
      label: t.tripStatus.activity,
      status: !native ? t.tripStatus.noModule : activityPermissionGranted() ? t.tripStatus.activityOk : t.tripStatus.activityMissing,
      tone: !native ? 'neutral' : activityPermissionGranted() ? 'ok' : 'vencido',
      onPress: () => router.push('/preparar' as never),
    });
    rows.push({
      key: 'trigger',
      label: t.tripStatus.trigger,
      status: !native ? t.tripStatus.noModule : triggerArmed ? t.tripStatus.triggerOn : t.tripStatus.triggerOff,
      tone: !native ? 'neutral' : triggerArmed ? 'ok' : 'proximo',
    });
    rows.push({
      key: 'service',
      label: t.tripStatus.appService,
      status: appService ? t.tripStatus.serviceOn : triggerArmed ? t.tripStatus.serviceIdle : t.tripStatus.serviceOff,
      tone: appService || triggerArmed ? 'ok' : 'proximo',
    });
    rows.push({
      key: 'recording',
      label: t.tripStatus.recordingNow,
      status: native && isNativeRecording() ? t.tripStatus.recordingYes : t.tripStatus.recordingNo,
      tone: 'neutral',
    });
    rows.push({
      key: 'battery',
      label: t.tripStatus.battery,
      status: getBatteryState() === 'unrestricted' ? t.tripStatus.batteryOk : getBatteryState() === 'optimized' ? t.tripStatus.batteryLimited : t.tripStatus.unknown,
      tone: getBatteryState() === 'unrestricted' ? 'ok' : getBatteryState() === 'optimized' ? 'vencido' : 'neutral',
      onPress: () => router.push('/preparar' as never),
    });
    if (isMiuiPhone()) {
      const a = getAutostartState();
      rows.push({
        key: 'autostart',
        label: t.tripStatus.autostart,
        status: a === 'enabled' ? t.tripStatus.autostartOn : a === 'disabled' ? t.tripStatus.autostartOff : t.tripStatus.unknown,
        tone: a === 'enabled' ? 'ok' : a === 'disabled' ? 'vencido' : 'neutral',
        onPress: () => router.push('/preparar' as never),
      });
    }
  }

  const summary = summarize(recent);
  const nativeLines = recent.filter((e): e is Extract<TimelineEntry, { kind: 'native' }> => e.kind === 'native').slice(-8).reverse();
  const kills = Platform.OS === 'android' && native ? lastExitReasons().slice(0, 3) : [];

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.trips.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {t.tripStatus.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginVertical: space.sm }}>
        {t.tripStatus.intro}
      </T>

      <View style={{ gap: space.sm }}>
        {rows.map((r) => (
          <StatusRow key={r.key} label={r.label} status={r.status} tone={r.tone} onPress={r.onPress ?? (() => void refresh())} />
        ))}
      </View>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        <PrimaryButton label={busy ? t.tripStatus.checking : t.tripStatus.checkNow} onPress={() => void checkNow()} disabled={busy} />
        {note ? (
          <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13 }}>
            {note}
          </T>
        ) : null}
      </View>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
        {t.tripStatus.lastTitle}
      </T>
      <Surface padded style={{ gap: 4 }}>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
          {t.tripStatus.tripsCreated(summary.tripsCreated)}
        </T>
        {nativeLines.length ? (
          nativeLines.map((e, i) => (
            <T key={i} face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
              {`${hhmm(e.at)}  ${e.event}${e.detail ? ` · ${e.detail}` : ''}`}
            </T>
          ))
        ) : (
          <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
            {t.tripStatus.noEvents}
          </T>
        )}
      </Surface>

      {kills.length ? (
        <>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
            {t.tripStatus.killsTitle}
          </T>
          <Surface padded style={{ gap: 4 }}>
            {kills.map((k, i) => (
              <T key={i} face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
                {`${hhmm(k.t)}  ${k.description || k.reason}`}
              </T>
            ))}
          </Surface>
        </>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <GhostButton label={t.trips.diagnosticsExport} onPress={() => void shareTripDiagnostics(t.trips.diagnosticsDialog).catch(() => {})} />
        <GhostButton label={t.tripStatus.prepare} onPress={() => router.push('/preparar' as never)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
