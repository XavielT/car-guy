import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { categoryColors, radius, space } from '@/constants/theme';
import {
  media as mediaRepo,
  parts as partRepo,
  serviceRecordItems as itemRepo,
  serviceRecords as serviceRecordRepo,
  serviceTypes as serviceTypeRepo,
} from '@/lib/db/repos';
import type { Part, ServiceKind, ServiceRecord } from '@/lib/db/types';
import { dateLabel, km as fmtKm, money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

const KINDS: ServiceKind[] = ['mantenimiento', 'reparacion', 'mejora'];

const KIND_COLOR: Record<ServiceKind, string> = {
  mantenimiento: categoryColors.mantenimiento,
  reparacion: categoryColors.reparacion,
  mejora: categoryColors.mejora,
};

/**
 * One record, in full.
 *
 * "Reclasificar" exists because the three kinds are genuinely one table
 * (ADR-09) and the line between a maintenance item and a repair is a judgment
 * the user makes after the fact — changing it must not mean deleting and
 * re-typing, so the id survives and the history keeps its place.
 */
export default function ServicioDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, data } = useStore();

  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [itemNames, setItemNames] = useState<string[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const photoUri = useMediaUri(photoId);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const row = await serviceRecordRepo.getById(id);
      const [items, partRows, catalog, photos] = await Promise.all([
        itemRepo.listWhere({ serviceRecordId: id }),
        partRepo.listWhere({ serviceRecordId: id }),
        serviceTypeRepo.list(),
        mediaRepo.listWhere({ ownerTable: 'service_record', ownerId: id }),
      ]);
      if (cancelled) return;

      setRecord(row);
      setItemNames(
        items.map((i) => catalog.find((c) => c.id === i.serviceTypeId)?.name ?? i.serviceTypeId),
      );
      setParts(partRows);
      setPhotoId(photos[0]?.id ?? null);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, data]);

  if (!record) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.kindPill, { backgroundColor: `${KIND_COLOR[record.kind]}28` }]}>
          <View style={[styles.dot, { backgroundColor: KIND_COLOR[record.kind] }]} />
          <T face="semibold" style={{ color: KIND_COLOR[record.kind], fontSize: 12 }}>
            {es.service.kinds[record.kind]}
          </T>
        </View>

        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {record.title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.lg }}>
          {dateLabel(record.occurredAt)}
          {record.odometerKm != null ? ` · ${fmtKm(record.odometerKm)}` : ''}
          {record.shop ? ` · ${record.shop}` : ''}
        </T>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" /> : null}

        <Surface style={{ marginBottom: space.md }}>
          <Row label={es.service.total} value={money(record.totalDop)} big />
          {record.costPartsDop > 0 ? <Row label={es.service.costParts} value={money(record.costPartsDop)} /> : null}
          {record.costLaborDop > 0 ? <Row label={es.service.costLabor} value={money(record.costLaborDop)} /> : null}
        </Surface>

        {record.description ? (
          <T face="body" style={{ color: theme.text.secondary, marginBottom: space.md, lineHeight: 20 }}>
            {record.description}
          </T>
        ) : null}

        {itemNames.length ? (
          <>
            <T face="title" style={[styles.section, { color: theme.text.primary }]}>
              {es.service.items}
            </T>
            {itemNames.map((name) => (
              <T key={name} face="body" style={{ color: theme.text.secondary, marginBottom: 4 }}>
                · {name}
              </T>
            ))}
          </>
        ) : null}

        {parts.length ? (
          <>
            <T face="title" style={[styles.section, { color: theme.text.primary }]}>
              {es.service.parts}
            </T>
            {parts.map((part) => (
              <T key={part.id} face="body" style={{ color: theme.text.secondary, marginBottom: 4 }}>
                · {part.quantity}× {part.name}
                {part.unitCostDop != null ? ` — ${money(part.unitCostDop)}` : ''}
              </T>
            ))}
          </>
        ) : null}

        {record.warrantyUntilDate || record.warrantyUntilKm != null ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.md }}>
            {es.service.warranty}: {record.warrantyUntilDate ? dateLabel(record.warrantyUntilDate) : ''}
            {record.warrantyUntilKm != null ? ` · ${fmtKm(record.warrantyUntilKm)}` : ''}
          </T>
        ) : null}

        <T face="title" style={[styles.section, { color: theme.text.primary }]}>
          {es.service.reclassify}
        </T>
        <View style={styles.row}>
          {KINDS.map((k) => {
            const on = record.kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  if (on) return;
                  void (async () => {
                    // Same id, same place in the history — only the label moves.
                    await serviceRecordRepo.upsert({ id: record.id, kind: k });
                    await refresh();
                  })();
                }}
                style={[
                  styles.kindChip,
                  { borderColor: on ? KIND_COLOR[k] : theme.line, backgroundColor: on ? `${KIND_COLOR[k]}22` : theme.bg.raised },
                ]}>
                <T face="semibold" style={{ color: on ? theme.text.primary : theme.text.secondary, fontSize: 13 }}>
                  {es.service.kinds[k]}
                </T>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: space.lg }} />
        <GhostButton
          danger
          label={es.common.delete}
          onPress={() =>
            Alert.alert(record.title, '¿Borrar este registro?', [
              { text: es.common.cancel, style: 'cancel' },
              {
                text: es.common.delete,
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await serviceRecordRepo.softDelete(record.id);
                    await refresh();
                    router.back();
                  })();
                },
              },
            ])
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.kv}>
      <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
        {label}
      </T>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: big ? 20 : 14 }}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.chip,
    marginBottom: space.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 999 },
  h: { fontSize: 26 },
  photo: { width: '100%', height: 180, borderRadius: radius.card, marginBottom: space.md },
  section: { fontSize: 18, marginTop: space.lg, marginBottom: space.sm },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kindChip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm },
});
