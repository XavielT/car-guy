import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { GhostButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { listFluids, saveFluid } from '@/lib/db/diyQueries';
import { vehicles as vehicleRepo } from '@/lib/db/repos';
import type { FluidGuideItem, Vehicle } from '@/lib/db/types';
import { FLUID_KINDS } from '@/lib/domain/fluids';
import { t } from '@/lib/i18n';
import { catalogText } from '@/lib/i18n/catalog';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The fluids guide (IMP 28092026 Phase 5): one card per thing under the hood,
 * with a photo of where it is on this car and the owner's own notes. The weekly
 * check shows the matching card inline ("Aquí está el refrigerante en tu DS3").
 */
export default function FluidsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [cards, setCards] = useState<Record<string, FluidGuideItem>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    const [v, list] = await Promise.all([vehicleRepo.getById(id), listFluids(id)]);
    setVehicle(v);
    const byKind = Object.fromEntries(list.map((c) => [c.kind, c]));
    setCards(byKind);
    setNotes(Object.fromEntries(list.map((c) => [c.kind, c.notes])));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!vehicle) return <View style={{ flex: 1, backgroundColor: theme.bg.base }} />;

  async function save(kind: FluidGuideItem['kind'], patch: Partial<FluidGuideItem>) {
    const info = FLUID_KINDS.find((f) => f.kind === kind);
    const saved = await saveFluid(vehicle!.id, kind, { how: info?.how ?? '', sortOrder: FLUID_KINDS.findIndex((f) => f.kind === kind), notes: notes[kind] ?? '', mediaId: cards[kind]?.mediaId ?? null, ...patch });
    setCards((c) => ({ ...c, [kind]: saved }));
  }

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.fluids.eyebrow((vehicle.nickname || vehicle.name).toUpperCase())}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 30, textTransform: 'uppercase' }}>
        {t.fluids.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.lg }}>
        {t.fluids.hint}
      </T>
      {FLUID_KINDS.map((f) => {
        const card = cards[f.kind];
        return (
          <View key={f.kind} style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: card?.mediaId ? theme.accentFill : theme.lineStrong }]}>
            <T face="title" style={{ color: theme.text.primary, fontSize: 17, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {catalogText('fluid', f.kind, 'label', f.label)}
            </T>
            <PhotoPicker
              mediaId={card?.mediaId ?? null}
              ownerTable="fluid_guide_item"
              ownerId={`fluid_${vehicle.id}_${f.kind}`}
              vehicleId={vehicle.id}
              onChange={(mediaId) => void save(f.kind, { mediaId })}
              height={160}
            />
            <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 10, marginTop: space.sm }}>
              {t.fluids.how}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19, marginBottom: space.sm }}>
              {catalogText('fluid', f.kind, 'how', f.how)}
            </T>
            <Field label={t.fluids.notes} placeholder={t.fluids.notesPlaceholder} value={notes[f.kind] ?? ''} onChangeText={(t) => setNotes((n) => ({ ...n, [f.kind]: t }))} multiline />
            {(notes[f.kind] ?? '') !== (card?.notes ?? '') ? <GhostButton label={t.fluids.save} onPress={() => void save(f.kind, { notes: notes[f.kind] ?? '' })} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: radius.button, padding: space.md, marginBottom: space.md, gap: space.sm },
});
