import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiFieldMark, aiOutline } from '@/components/ai/AiFieldMark';
import { CaptureButton } from '@/components/ai/CaptureButton';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PhotoPicker } from '@/components/PhotoPicker';
import { T } from '@/components/T';
import { Collapsible, PrimaryButton } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import {
  currentOdometer as currentOdometerQuery,
  expenses as expenseRepo,
  media as mediaRepo,
} from '@/lib/db/repos';
import { saveExpense } from '@/lib/db/serviceOps';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/lib/db/types';
import { expensePrefillFrom, type ExpenseMarks } from '@/lib/ai/formMap';
import { recordReportable } from '@/lib/diagnostics';
import { dateInputFromIso, isoFromDateInput, todayIsoDate } from '@/lib/format';
import { storePhoto } from '@/lib/media';
import { t } from '@/lib/i18n';
import { Alert } from '@/lib/alert';
import { useAiDraftOnce, withoutMark } from '@/lib/ai/draft';
import { isInvalidNumber, parseDecimal } from '@/lib/math';
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

  const draft = useAiDraftOnce('expense');
  const dp = (draft?.prefill ?? {}) as Record<string, string | undefined>;
  const dm = (draft?.marks ?? {}) as Record<string, number | undefined>;
  const draftCategory = EXPENSE_CATEGORIES.find((c) => c === dp.category);
  const [category, setCategoryRaw] = useState<ExpenseCategory>(draftCategory ?? 'marbete');
  const [amount, setAmount] = useState(dp.amount ?? '');
  const [date, setDate] = useState(dp.date ?? todayIsoDate());
  const [odometer, setOdometer] = useState(dp.odometer ?? '');
  const [description, setDescription] = useState(dp.description ?? '');
  const [vendor, setVendor] = useState(dp.vendor ?? '');
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(null);
  const [currentKm, setCurrentKm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expenseId] = useState(() => editingId ?? `exp_${Date.now()}`);
  // IMP 03112026 (ADR-67): a receipt photo fills amount, date and vendor (never the category); the person saves as always.
  const [marks, setMarks] = useState<ExpenseMarks>(() => ({
    ...(dm.amount != null ? { amount: dm.amount } : {}),
    ...(dm.date != null ? { date: dm.date } : {}),
    ...(dm.vendor != null ? { vendor: dm.vendor } : {}),
    ...(draftCategory && dm.category != null ? { category: dm.category } : {}),
  }));
  const unmark = (k: keyof ExpenseMarks) => setMarks((m) => withoutMark(m as Record<string, number>, k) as ExpenseMarks);
  const setCategory = (c: ExpenseCategory) => {
    setCategoryRaw(c);
    unmark('category');
  };

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

      setCategoryRaw(row.category);
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
    if (parsedAmount == null || parsedAmount <= 0) return setError(t.expense.amountRequired);
    if (isInvalidNumber(odometer)) return setError(t.common.invalidNumber(t.expense.odometer));
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
          t.service.savedTitle,
          `${t.expense.legalDone}\n\n${result.resets.map((r) => `· ${r}`).join('\n')}`,
        );
      }
      router.back();
    })();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {editingId ? t.expense.editTitle : t.expense.newTitle}
        </T>

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.expense.category}
        </T>
        <AiFieldMark confidence={marks.category} />
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
                  { borderColor: on ? theme.accentFill : theme.line, backgroundColor: on ? theme.accentFill : theme.bg.raised },
                ]}>
                <T face="title" style={{ color: on ? theme.accentFillInk : theme.text.secondary, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </T>
              </Pressable>
            );
          })}
        </View>

        <CaptureButton
          kind="invoice"
          label={t.ai.capture.scanReceipt}
          onRead={(result, photo) => {
            const { prefill, marks: m } = expensePrefillFrom(result);
            if (prefill.amount == null && !prefill.date && !prefill.vendor) {
              Alert.alert(t.ai.consent.title, t.ai.capture.nothingRead);
              return;
            }
            if (prefill.amount) setAmount(prefill.amount);
            if (prefill.date) setDate(prefill.date);
            if (prefill.vendor) setVendor(prefill.vendor);
            if (prefill.noteLines.length && !description.trim()) setDescription(prefill.noteLines.join(' · '));
            setMarks((cur) => ({ ...cur, ...m }));
            // The photo stays as the expense's picture, unless the person already added one.
            if (!photoMediaId) {
              void storePhoto({ uri: photo.uri, width: null, takenAt: new Date().toISOString() }, { ownerTable: 'expense', ownerId: expenseId, vehicleId: activeVehicle!.id })
                .then((media) => media && setPhotoMediaId(media.id))
                .catch((e) => recordReportable('ai-photo-attach', e));
            }
          }}
        />
        <AiFieldMark confidence={marks.amount} />
        <Field label={t.expense.amount} keyboardType="decimal-pad" value={amount} style={aiOutline(marks.amount, theme.accent)} onChangeText={(v) => { setAmount(v); unmark('amount'); }} />
        <AiFieldMark confidence={marks.date} />
        <DateField label={t.expense.date} value={date} onChange={(v) => { setDate(v); unmark('date'); }} noFuture />
        <Collapsible id="form-expense-more" title={t.ux.moreDetails} hint={t.ux.expenseMoreHint} defaultOpen={Boolean(editingId)}>
        <Field
          label={t.expense.odometer}
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
          placeholder={currentKm != null ? String(Math.round(currentKm)) : undefined}
        />
        <Field label={t.expense.description} value={description} onChangeText={setDescription} />
        <AiFieldMark confidence={marks.vendor} />
        <Field label={t.expense.vendor} value={vendor} style={aiOutline(marks.vendor, theme.accent)} onChangeText={(v) => { setVendor(v); unmark('vendor'); }} />

        <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
          {t.expense.photo}
        </T>
        <PhotoPicker
          mediaId={photoMediaId}
          ownerTable="expense"
          ownerId={expenseId}
          vehicleId={activeVehicle.id}
          onChange={setPhotoMediaId}
        />
        </Collapsible>

        {error ? (
          <T face="body" style={[styles.error, { color: theme.dangerText }]}>
            {error}
          </T>
        ) : null}
        <PrimaryButton label={t.expense.save} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 40 },
  h: { fontSize: 28, lineHeight: 30, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: space.lg },
  label: { fontSize: 12, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 6 },
  error: { fontSize: 13, marginBottom: space.md },
});
