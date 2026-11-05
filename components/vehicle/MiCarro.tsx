import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { T } from '@/components/T';
import { StatusRow, type StatusTone } from '@/components/ui';
import { space } from '@/constants/theme';
import { albumItems, documents, mods, odometerNow, odometer as odometerRepo, serviceRecords, vehicleMembers } from '@/lib/db/repos';
import { daysBetween, todayIso } from '@/lib/domain/dates';
import { agoParts, expiryTone } from '@/lib/domain/miCarro';
import { km as fmtKm } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { loadCalibration } from '@/lib/trips/calibrationStore';
import { useTheme } from '@/lib/theme/useTheme';

type Line = { text: string; tone: StatusTone };
type Lines = Record<'service' | 'docs' | 'fuel' | 'mods' | 'photos' | 'odo' | 'cal' | 'share', Line>;

const ago = (days: number | null): string | null => {
  const p = agoParts(days);
  if (!p) return null;
  return p.unit === 'today' ? t.miCarro.ago.today : p.unit === 'yesterday' ? t.miCarro.ago.yesterday : p.unit === 'days' ? t.miCarro.ago.days(p.n) : t.miCarro.ago.months(p.n);
};

/**
 * Mi carro (SPEC-K §K2): the car as a short list of big rows, each with ONE line saying where it stands ("Marbete: vence en 12 días").
 * Every row opens what it names; nothing here replaces a tab, it is the way in. Statuses come from the real records.
 */
export function MiCarro({ vehicleId, onTab, onOdometer }: { vehicleId: string; onTab: (tab: 'docs' | 'build' | 'album') => void; onOdometer: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data } = useStore();
  const [lines, setLines] = useState<Lines | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const today = todayIso();
      const [svc, docs, modRows, album, odo, readings, cal, members] = await Promise.all([
        serviceRecords.listWhere({ vehicleId }, { orderBy: 'occurred_at', direction: 'DESC' }).catch(() => []),
        documents.listWhere({ vehicleId }).catch(() => []),
        mods.listWhere({ vehicleId }).catch(() => []),
        albumItems.listWhere({ vehicleId }).catch(() => []),
        odometerNow(vehicleId).catch(() => ({ km: null, estimated: false })),
        odometerRepo.list(vehicleId, { orderBy: 'occurred_at', direction: 'DESC' }).catch(() => []),
        loadCalibration(vehicleId),
        vehicleMembers.listWhere({ vehicleId }).catch(() => []),
      ]);
      if (!live) return;
      const fills = data.fillups.filter((f) => f.vehicleId === vehicleId);
      const lastFill = fills.reduce<string | null>((m, f) => (m == null || f.occurredAt > m ? f.occurredAt : m), null);
      const dated = docs.filter((d) => d.expiresAt).map((d) => ({ title: d.title, left: daysBetween(today, d.expiresAt as string) })).sort((a, b) => a.left - b.left);
      const nearest = dated[0];
      const last = svc[0];
      setLines({
        service: last ? { text: t.miCarro.serviceLast(last.title, ago(daysBetween(last.occurredAt, today)) ?? ''), tone: 'neutral' } : { text: t.miCarro.serviceNone, tone: 'neutral' },
        docs: nearest ? { text: t.miCarro.docExpires(nearest.title, nearest.left), tone: expiryTone(nearest.left) } : docs.length ? { text: t.miCarro.docsOk, tone: 'ok' } : { text: t.miCarro.docsNone, tone: 'neutral' },
        fuel: lastFill ? { text: t.miCarro.fuelLast(ago(daysBetween(lastFill, today)) ?? ''), tone: 'neutral' } : { text: t.miCarro.fuelNone, tone: 'neutral' },
        mods: modRows.length ? { text: t.miCarro.modsCount(modRows.length), tone: 'neutral' } : { text: t.miCarro.modsNone, tone: 'neutral' },
        photos: album.length ? { text: t.miCarro.photosCount(album.length), tone: 'neutral' } : { text: t.miCarro.photosNone, tone: 'neutral' },
        odo: odo.km == null ? { text: t.miCarro.odoNone, tone: 'neutral' } : { text: t.miCarro.odoStatus(fmtKm(Math.round(odo.km)), ago(readings[0] ? daysBetween(readings[0].occurredAt, today) : null)), tone: 'neutral' },
        cal: cal.speedFactor !== 1 ? { text: t.miCarro.calOn(((cal.speedFactor - 1) * 100).toFixed(1)), tone: 'ok' } : { text: t.miCarro.calNone, tone: 'neutral' },
        share: members.length ? { text: t.miCarro.shareN(members.length), tone: 'neutral' } : { text: t.miCarro.shareSolo, tone: 'neutral' },
      });
    })();
    return () => {
      live = false;
    };
  }, [vehicleId, data]);

  if (!lines) return null;
  const row = (key: keyof Lines, label: string, icon: React.ComponentProps<typeof StatusRow>['icon'], onPress: () => void) => <StatusRow key={key} label={label} status={lines[key].text} tone={lines[key].tone} icon={icon} onPress={onPress} />;
  return (
    <View style={{ marginBottom: space.md }}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11, marginBottom: space.sm }}>
        {t.miCarro.title}
      </T>
      {row('service', t.miCarro.service, 'construct-outline', () => router.push({ pathname: '/vehiculo/[id]/reparaciones', params: { id: vehicleId } }))}
      {row('docs', t.miCarro.docs, 'document-text-outline', () => onTab('docs'))}
      {row('fuel', t.miCarro.fuel, 'flash-outline', () => router.push('/(tabs)/historial'))}
      {row('mods', t.miCarro.mods, 'build-outline', () => onTab('build'))}
      {row('photos', t.miCarro.photos, 'images-outline', () => onTab('album'))}
      {row('odo', t.miCarro.odometer, 'speedometer-outline', onOdometer)}
      {row('cal', t.miCarro.calibration, 'options-outline', () => router.push({ pathname: '/vehiculo/[id]/calibracion', params: { id: vehicleId } }))}
      {row('share', t.miCarro.share, 'people-outline', () => router.push({ pathname: '/vehiculo/[id]/compartir', params: { id: vehicleId } }))}
    </View>
  );
}
