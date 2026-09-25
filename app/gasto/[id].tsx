import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { categoryColors, radius, space } from '@/constants/theme';
import { expenses as expenseRepo, media as mediaRepo } from '@/lib/db/repos';
import { EXPENSE_CATEGORY_LABELS, type Expense } from '@/lib/db/types';
import { dateLabel, km as fmtKm, money } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * One expense, in full.
 *
 * It exists so the Historial is honest: a row you can see but not open is a
 * dead end, and the marbete you recorded for RD$3,500 is exactly the number
 * you will want to correct a year later when the receipt says otherwise.
 */
export default function GastoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh, data } = useStore();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const photoUri = useMediaUri(photoId);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [row, photos] = await Promise.all([
        expenseRepo.getById(id),
        mediaRepo.listWhere({ ownerTable: 'expense', ownerId: id }),
      ]);
      if (cancelled) return;
      setExpense(row);
      setPhotoId(photos[0]?.id ?? null);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, data]);

  if (!expense) return null;

  const label = EXPENSE_CATEGORY_LABELS[expense.category];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.kindPill, { backgroundColor: `${categoryColors.otros}28` }]}>
          <View style={[styles.dot, { backgroundColor: categoryColors.otros }]} />
          <T face="semibold" style={{ color: categoryColors.otros, fontSize: 12 }}>
            {label}
          </T>
        </View>

        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {expense.description.trim() || label}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginBottom: space.lg }}>
          {dateLabel(expense.occurredAt)}
          {expense.odometerKm != null ? ` · ${fmtKm(expense.odometerKm)}` : ''}
          {expense.vendor ? ` · ${expense.vendor}` : ''}
        </T>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" /> : null}

        <Surface style={{ marginBottom: space.lg }}>
          <View style={styles.kv}>
            <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
              {es.expense.amount}
            </T>
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 20 }}>
              {money(expense.amountDop)}
            </T>
          </View>
        </Surface>

        <PrimaryButton
          label={es.common.edit}
          onPress={() => router.push({ pathname: '/gasto/nuevo', params: { id: expense.id } })}
        />
        <View style={{ height: space.sm }} />
        <GhostButton
          danger
          label={es.common.delete}
          onPress={() =>
            Alert.alert(expense.description.trim() || label, es.expense.deleteConfirm, [
              { text: es.common.cancel, style: 'cancel' },
              {
                text: es.common.delete,
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await expenseRepo.softDelete(expense.id);
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
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 4 },
});
