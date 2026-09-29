import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { T } from '@/components/T';
import { Chip, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { deliverBook, generateBook } from '@/lib/book';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import { flagsOf, getShare } from '@/lib/db/shareQueries';
import type { Vehicle } from '@/lib/db/types';
import type { ShareFlags } from '@/lib/share/dossier';
import { saveShareSettings } from '@/lib/share/publish';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

const FLAG_KEYS: (keyof ShareFlags)[] = ['story', 'mods', 'maintenance', 'track', 'odometer', 'costs', 'plate', 'vin'];
type Period = 'todo' | 'ano' | 'este';

function range(p: Period, now = new Date()): { from: string | null; to: string | null; label: string | null } {
  if (p === 'todo') return { from: null, to: null, label: null };
  if (p === 'ano') return { from: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString(), to: now.toISOString(), label: es.book.periods.ano };
  return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: now.toISOString(), label: String(now.getFullYear()) };
}

/**
 * Libro del carro (03-screens.md Block F): the share switches (shared with the
 * public page, so "costos" means the same thing in both), the period, photos
 * and documents, then one PDF — the share sheet on the phone, a download on web.
 */
export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [flags, setFlags] = useState<ShareFlags | null>(null);
  const [photos, setPhotos] = useState(true);
  const [docs, setDocs] = useState(false);
  const [period, setPeriod] = useState<Period>('todo');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([vehicleRepo.getById(id), getShare(id)]).then(([v, s]) => {
      if (cancelled) return;
      setVehicle(v);
      setFlags(flagsOf(s));
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!vehicle || !flags) return null;

  async function setFlag(k: keyof ShareFlags, on: boolean) {
    const next = { ...flags!, [k]: on };
    setFlags(next);
    await saveShareSettings(id, { flags: next });
  }

  async function generate() {
    setNotice(null);
    setProgress({ done: 0, total: 1 });
    try {
      const r = range(period);
      const book = await generateBook(id, { flags: flags!, photos, docs, from: r.from, to: r.to, periodLabel: r.label }, (done, total) => setProgress({ done, total }));
      if (!book) return setNotice(es.book.failed);
      const how = await deliverBook(book.bytes, book.filename, es.book.dialog);
      setNotice(how === 'unavailable' ? es.book.unavailable : es.book.done(book.filename, Math.round(book.bytes.byteLength / 1024)));
    } catch (error) {
      console.warn('[book]', error);
      setNotice(es.book.failed);
    } finally {
      setProgress(null);
    }
  }

  const row = (label: string, value: boolean, onChange: (v: boolean) => void, hint?: string) => (
    <View key={label} style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
          {label}
        </T>
        {hint ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} disabled={Boolean(progress)} />
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {es.book.eyebrow(vehicle.name.toUpperCase())}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase', marginBottom: space.sm }}>
        {es.book.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
        {es.book.intro}
      </T>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {es.book.period}
      </T>
      <View style={styles.chips}>
        {(['todo', 'ano', 'este'] as Period[]).map((p) => (
          <Chip key={p} label={p === 'este' ? String(new Date().getFullYear()) : es.book.periods[p]} selected={period === p} onPress={() => setPeriod(p)} />
        ))}
      </View>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.md, marginBottom: space.sm }}>
        {es.share.sections}
      </T>
      <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
        {FLAG_KEYS.map((k) => row(es.share.flags[k], flags[k], (on) => void setFlag(k, on), es.share.flagHints[k] || undefined))}
        {row(es.book.docs, docs, setDocs, es.book.docsHint)}
        {row(es.book.photos, photos, setPhotos, es.book.photosHint)}
      </View>

      <View style={{ height: space.lg }} />
      <PrimaryButton label={progress ? es.book.generating(progress.done, progress.total) : es.book.generate} disabled={Boolean(progress)} onPress={() => void generate()} />
      {notice ? (
        <T face="body" style={{ color: theme.accent, fontSize: 13, marginTop: space.sm }}>
          {notice}
        </T>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
});
