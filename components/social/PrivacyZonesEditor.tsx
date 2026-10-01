import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { privacyZones } from '@/lib/db/repos';
import type { PrivacyZone } from '@/lib/db/types';
import { recordError } from '@/lib/diagnostics';
import { id as newId } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/** 100–1000 m on the phone (the cloud allows up to 5 km); 300 m by default (ADR-56). */
const RADII = [100, 300, 500, 1000] as const;

/**
 * Perfil → Zonas privadas (ADR-56): places a shared route never shows. Local-first rows (privacy_zone, synced),
 * added from "mi ubicación ahora" — a fresh fix only (ADR-49), never a cached one.
 */
export function PrivacyZonesEditor() {
  const { theme } = useTheme();
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [label, setLabel] = useState('');
  const [radius, setRadius] = useState<number>(300);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => void privacyZones.list().then(setZones), []);
  useEffect(load, [load]);

  const addHere = async () => {
    setBusy(true);
    setNote(null);
    try {
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('permission');
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const fresh = Date.now() - fix.timestamp < 60_000 && (fix.coords.accuracy ?? 999) <= 100;
      if (!fresh) throw new Error('stale');
      await privacyZones.upsert({
        id: newId(),
        label: label.trim() || null,
        lat: Math.round(fix.coords.latitude * 1e6) / 1e6,
        lng: Math.round(fix.coords.longitude * 1e6) / 1e6,
        radiusM: radius,
      });
      setLabel('');
      load();
    } catch (e) {
      if (!(e instanceof Error && (e.message === 'permission' || e.message === 'stale'))) recordError('privacy-zone', e);
      setNote(t.social.zoneNoFix);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: space.lg }}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11, marginBottom: 4 }}>
        {t.social.zones}
      </T>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17, marginBottom: space.sm }}>
        {t.social.zonesHint}
      </T>
      {zones.length === 0 ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.sm }}>
          {t.social.zonesEmpty}
        </T>
      ) : (
        <Surface padded style={{ gap: space.xs, marginBottom: space.sm }}>
          {zones.map((z) => (
            <View key={z.id} style={styles.row}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 14, flex: 1 }}>
                {z.label || '—'} · {t.social.zoneRadius(z.radiusM)}
              </T>
              <Pressable onPress={() => void privacyZones.softDelete(z.id).then(load)} accessibilityRole="button" accessibilityLabel={`${t.social.zoneDelete}: ${z.label ?? ''}`} hitSlop={8}>
                <T face="semibold" style={{ color: theme.dangerText, fontSize: 13 }}>
                  {t.social.zoneDelete}
                </T>
              </Pressable>
            </View>
          ))}
        </Surface>
      )}
      <Field label={t.social.zoneLabel} value={label} onChangeText={setLabel} />
      <View style={styles.chips}>
        {RADII.map((r) => (
          <Chip key={r} label={t.social.zoneRadius(r)} selected={radius === r} onPress={() => setRadius(r)} />
        ))}
      </View>
      {note ? (
        <T face="body" style={{ color: theme.dangerText, fontSize: 13, marginBottom: space.xs }}>
          {note}
        </T>
      ) : null}
      <GhostButton label={t.social.zoneHere} disabled={busy} onPress={() => void addHere()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
});
