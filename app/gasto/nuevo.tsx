import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  currentOdometer as currentOdometerQuery,
  expenses as expenseRepo,
  media as mediaRepo,
} from '@/lib/db/repos';
import { saveExpense } from '@/lib/db/serviceOps';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/lib/db/types';
import { dateInputFromIso, isoFromDateInput, todayIsoDate } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { Alert } from '@/lib/alert';
import { parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Costs that are not work on the car: the marbete, the insurance, a fine, a
 * toll. Legal ones come first in the list because they are the ones people
 * actually record.
 */
export default function NuevoGastoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ?? null;
  const { theme } = useTheme();
  const { activeVehicle, refresh } = useStore();

  const [category, setCategory] = useState<ExpenseCategory>('marbete');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [odometer, setOdometer] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(null);
  const [currentKm, setCurrentKm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expenseId] = useState(() => editingId ?? `exp_${Date.now()}`);

  const vehicleId = activeVehicle?.id;

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    currentOdometerQuery(vehicleId)
      .then((km) => {
        if (!cancelled) setCurrentKm(km);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  // Editing reuses this form: an expense is six fields, and a second screen for
  // correcting them would only be this one with a different title.
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;

    (async () => {
      const row = await expenseRepo.getById(editingId);
      if (!row) return;
      const photos = await mediaRepo.listWhere({ ownerTable: 'expense', ownerId: editingId });
      if (cancelled) return;

      setCategory(row.category);
      setAmount(String(row.amountDop));
      setDate(dateInputFromIso(row.occurredAt));
      setOdometer(row.odometerKm != null ? String(Math.round(row.odometerKm)) : '');
      setDescription(row.description);
      setVendor(row.vendor);
      setPhotoMediaId(photos[0]?.id ?? null);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [editingId]);

  if (!activeVehicle) return null;

  function save() {
    const parsedAmount = parseDecimal(amount);
    if (parsedAmount == null || parsedAmount <= 0) return setError(es.expense.amountRequired);
    setError(null);

    void (async () => {
      const result = await saveExpense({
        id: expenseId,
        vehicleId: activeVehicle!.id,
        occurredAt: isoFromDateInput(date),
        odometerKm: odometer.trim() ? parseDecimal(odometer) : null,
        category,
        amountDop: parsedAmount,
        description: description.trim(),
        vendor: vendor.trim(),
      });
      await refresh();

      if (result.resets.length) {
        Alert.alert(
          es.service.savedTitle,
          `${es.expense.legalDone}\n\n${result.resets.map((r) => `· ${r}`).join('\n')}`,
        );
      }
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {editingId ? es.expense.editTitle : es.expense.newTitle}
        </T>

        <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
          {es.expense.category}
        </T>
        <View style={styles.row}>
          {EXPENSE_CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.chip,
                  { borderColor: on ? theme.accent : theme.line, backgroundColor: on ? theme.accent : theme.bg.raised },
                ]}>
                <T face="semibold" style={{ color: on ? theme.accentInk : theme.text.secondary, fontSize: 12 }}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </T>
              </Pressable>
            );
          })}
        </View>

        <Field label={es.expense.amount} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <DateField label={es.expense.date} value={date} onChange={setDate} />
        <Field
          label={es.expense.odometer}
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
          placeholder={currentKm != null ? String(Math.round(currentKm)) : undefined}
        />
        <Field label={es.expense.description} value={description} onChangeText={setDescription} />
        <Field label={es.expense.vendor} value={vendor} onChangeText={setVendor} />

        <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
          {es.expense.photo}
        </T>
        <PhotoPicker
          mediaId={photoMediaId}
          ownerTable="expense"
          ownerId={expenseId}
          vehicleId={activeVehicle.id}
          onChange={setPhotoMediaId}
        />

        {error ? (
          <T face="body" style={[styles.error, { color: theme.danger }]}>
            {error}
          </T>
        ) : null}
        <PrimaryButton label={es.expense.save} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, marginBottom: space.lg },
  label: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 6 },
  error: { fontSize: 13, marginBottom: space.md },
});
