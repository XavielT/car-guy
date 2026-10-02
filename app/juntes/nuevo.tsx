import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { createJunte, type JunteVisibility } from '@/lib/junte/api';
import { useTheme } from '@/lib/theme/useTheme';

const HOURS = [2, 4, 6] as const;
const VIS: JunteVisibility[] = ['invite', 'followers', 'public'];

/** Juntes → Nuevo (IMP 01102026 Phase 6): name, day and time, how long, the meeting point, who may join. */
export default function NuevoJunteScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(todayIsoDate());
  const [time, setTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60_000);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });
  const [hours, setHours] = useState<number>(4);
  const [meetLabel, setMeetLabel] = useState('');
  const [meet, setMeet] = useState<{ lat: number; lng: number } | null>(null);
  const [visibility, setVisibility] = useState<JunteVisibility>('invite');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const here = async () => {
    setError(null);
    try {
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('permission');
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (Date.now() - fix.timestamp > 60_000 || (fix.coords.accuracy ?? 999) > 100) throw new Error('stale');
      setMeet({ lat: Math.round(fix.coords.latitude * 1e5) / 1e5, lng: Math.round(fix.coords.longitude * 1e5) / 1e5 });
    } catch {
      setError(t.social.zoneNoFix);
    }
  };

  const create = async () => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    const [y, mo, d] = day.split('-').map(Number);
    if (!title.trim() || !m || !y) return;
    const start = new Date(y, mo - 1, d, Number(m[1]), Number(m[2]));
    const end = new Date(start.getTime() + hours * 3_600_000);
    setBusy(true);
    const r = await createJunte({
      title: title.trim().slice(0, 60),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      meet,
      meetLabel: meetLabel.trim() || null,
      visibility,
    });
    setBusy(false);
    if (r.ok) router.replace({ pathname: '/juntes/[id]', params: { id: r.data.id } });
    else setError(r.reason === 'bad_window' ? t.juntes.badWindow : t.juntes.joinFailed.error);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: true, title: t.juntes.newTitle }} />
      <Field label={t.juntes.titleField} placeholder={t.juntes.titlePlaceholder} value={title} onChangeText={(v) => setTitle(v.slice(0, 60))} />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <DateField label={t.juntes.date} value={day} onChange={setDay} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t.juntes.time} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="15:30" />
        </View>
      </View>
      <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
        {t.juntes.duration}
      </T>
      <View style={styles.chips}>
        {HOURS.map((h) => (
          <Chip key={h} label={t.juntes.hours(h)} selected={hours === h} onPress={() => setHours(h)} />
        ))}
      </View>
      <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
        {t.juntes.meet}
      </T>
      <Field label={t.juntes.meetLabel} value={meetLabel} onChangeText={(v) => setMeetLabel(v.slice(0, 80))} />
      <GhostButton label={meet ? `${t.juntes.meetSet} ✓` : t.juntes.meetHere} onPress={() => void here()} />
      <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
        {t.juntes.visibility}
      </T>
      <View style={styles.chips}>
        {VIS.map((v) => (
          <Chip key={v} label={t.juntes.visibilityOpts[v]} selected={visibility === v} onPress={() => setVisibility(v)} />
        ))}
      </View>
      {error ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.sm }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton label={t.juntes.createButton} disabled={busy || !title.trim()} onPress={() => void create()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  pair: { flexDirection: 'row', gap: space.sm },
  h: { fontSize: 11, marginTop: space.sm, marginBottom: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
});
