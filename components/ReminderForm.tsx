import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Segmented } from '@/components/ui';
import { space } from '@/constants/theme';
import { reminders as reminderRepo, serviceTypes as serviceTypeRepo } from '@/lib/db/repos';
import type { Reminder, ReminderMetric, ServiceType, Vehicle } from '@/lib/db/types';
import { addMonths, todayIso } from '@/lib/domain/dates';
import { dateInputFromIso, isoFromDateInput } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { parseDecimal } from '@/lib/math';
import { useTheme } from '@/lib/theme/useTheme';

const isDiesel = (fuel: string) => fuel === 'gasoil_regular' || fuel === 'gasoil_optimo';

/** Hides the motorcycle chain from a pickup, the water separator from a gasoline car. */
function appliesTo(type: ServiceType, vehicle: Pick<Vehicle, 'type' | 'defaultFuelType'>): boolean {
  if (type.appliesTo === 'all') return true;
  if (type.appliesTo === 'motor') return vehicle.type === 'motor';
  if (type.appliesTo === 'diesel') return isDiesel(vehicle.defaultFuelType);
  return vehicle.type !== 'motor' && !isDiesel(vehicle.defaultFuelType);
}

const numberText = (n: number | null | undefined) => (n == null ? '' : String(n));
const parseInt0 = (text: string) => {
  const value = text.trim() ? parseDecimal(text) : null;
  return value == null || !Number.isFinite(value) ? null : Math.round(value);
};

/**
 * The reminder form (03-screens-ia.md): one component for "nuevo" and for the
 * edit half of the detail screen, so the two can never drift.
 *
 * Picking a catalog item fills the title and the intervals from the catalog
 * while the user has not typed their own, which turns "Cambio de aceite" into
 * two taps. Thresholds are folded away: the defaults are right for almost
 * everyone, and a field nobody understands is worse than no field.
 */
export function ReminderForm({
  vehicle,
  reminder,
  onSaved,
}: {
  vehicle: Pick<Vehicle, 'id' | 'type' | 'defaultFuelType'>;
  /** Missing for a new reminder. */
  reminder?: Reminder | null;
  onSaved: (saved: Reminder) => void;
}) {
  const { theme } = useTheme();
  const editing = reminder != null;

  const [catalog, setCatalog] = useState<ServiceType[]>([]);
  const [title, setTitle] = useState(reminder?.title ?? '');
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(reminder?.serviceTypeId ?? null);
  const [metric, setMetric] = useState<ReminderMetric>(reminder?.metric ?? 'date');
  const [dueDate, setDueDate] = useState(reminder?.dueDate ? dateInputFromIso(reminder.dueDate) : '');
  const [dueKm, setDueKm] = useState(numberText(reminder?.dueKm));
  const [recurring, setRecurring] = useState(reminder?.isRecurring ?? true);
  const [intervalMonths, setIntervalMonths] = useState(numberText(reminder?.intervalMonths));
  const [intervalDays, setIntervalDays] = useState(numberText(reminder?.intervalDays));
  const [intervalKm, setIntervalKm] = useState(numberText(reminder?.intervalKm));
  const [fixed, setFixed] = useState(reminder?.fixedInterval ?? false);
  const [showAdvanced, setShowAdvanced] = useState(
    reminder?.thresholdDays != null || reminder?.thresholdKm != null,
  );
  const [thresholdDays, setThresholdDays] = useState(numberText(reminder?.thresholdDays));
  const [thresholdKm, setThresholdKm] = useState(numberText(reminder?.thresholdKm));
  const [notes, setNotes] = useState(reminder?.notes ?? '');
  const [enabled, setEnabled] = useState(reminder?.isEnabled ?? true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    serviceTypeRepo
      .list(undefined, { orderBy: 'sort_order', direction: 'ASC' })
      .then((rows) => {
        if (!cancelled) setCatalog(rows.filter((t) => appliesTo(t, vehicle) && t.id !== 'otro'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicle]);

  const wantsDate = metric !== 'km';
  const wantsKm = metric !== 'date';

  function pickType(type: ServiceType | null) {
    setServiceTypeId(type?.id ?? null);
    if (!type || editing) return;
    // Only fills what the user has not already typed.
    if (!title.trim()) setTitle(type.name);
    if (!intervalKm && type.defaultIntervalKm != null) setIntervalKm(String(type.defaultIntervalKm));
    if (!intervalMonths && type.defaultIntervalMonths != null) {
      setIntervalMonths(String(type.defaultIntervalMonths));
      if (!dueDate) setDueDate(dateInputFromIso(addMonths(todayIso(), type.defaultIntervalMonths)));
    }
    if (type.defaultIntervalKm != null && type.defaultIntervalMonths != null) setMetric('both');
    else if (type.defaultIntervalKm != null) setMetric('km');
  }

  function save() {
    if (!title.trim()) return setError(es.reminders.form.titleRequired);
    const km = parseInt0(dueKm);
    // Required for a new reminder only: the seeded Seguro and Licencia start
    // without a date, and editing their notes must not demand one first.
    const missingDue =
      (metric === 'date' && !dueDate) ||
      (metric === 'km' && km == null) ||
      (metric === 'both' && !dueDate && km == null);
    if (!editing && enabled && missingDue) {
      return setError(es.reminders.form.dueRequired);
    }
    setError(null);

    void (async () => {
      const saved = await reminderRepo.upsert({
        ...(reminder ? { id: reminder.id } : {}),
        vehicleId: vehicle.id,
        title: title.trim(),
        serviceTypeId,
        metric,
        dueDate: wantsDate && dueDate ? isoFromDateInput(dueDate) : null,
        dueKm: wantsKm ? km : null,
        isRecurring: recurring,
        intervalMonths: recurring ? parseInt0(intervalMonths) : null,
        intervalDays: recurring ? parseInt0(intervalDays) : null,
        intervalKm: recurring ? parseInt0(intervalKm) : null,
        fixedInterval: recurring && fixed,
        thresholdDays: parseInt0(thresholdDays),
        thresholdKm: parseInt0(thresholdKm),
        notes: notes.trim(),
        isEnabled: enabled,
        // Editing the due point is a fresh start; an old snooze no longer applies.
        snoozedUntil: null,
      });
      onSaved(saved);
    })();
  }

  return (
    <View>
      <Field label={es.reminders.form.title} value={title} onChangeText={setTitle} />

      <Label text={es.reminders.form.catalog} />
      <View style={styles.chips}>
        <Chip label={es.reminders.form.catalogNone} selected={serviceTypeId == null} onPress={() => pickType(null)} />
        {catalog.map((type) => (
          <Chip
            key={type.id}
            label={type.name}
            selected={serviceTypeId === type.id}
            onPress={() => pickType(type)}
          />
        ))}
      </View>

      <Label text={es.reminders.form.metric} />
      <Segmented
        options={(['date', 'km', 'both'] as const).map((key) => ({
          key,
          label: es.reminders.form.metrics[key],
        }))}
        value={metric}
        onChange={setMetric}
        style={{ marginBottom: space.sm }}
      />
      {metric === 'both' ? <Hint text={es.reminders.form.bothHint} /> : null}

      {wantsDate ? <DateField label={es.reminders.form.dueDate} value={dueDate} onChange={setDueDate} /> : null}
      {wantsKm ? (
        <Field label={es.reminders.form.dueKm} keyboardType="number-pad" value={dueKm} onChangeText={setDueKm} />
      ) : null}

      <Label text={es.reminders.form.recurring} />
      <Segmented
        options={[
          { key: 'yes', label: es.reminders.form.yes },
          { key: 'no', label: es.reminders.form.no },
        ]}
        value={recurring ? 'yes' : 'no'}
        onChange={(v) => setRecurring(v === 'yes')}
        style={{ marginBottom: space.md }}
      />

      {recurring ? (
        <>
          <View style={styles.pair}>
            {wantsDate ? (
              <View style={styles.half}>
                <Field
                  label={es.reminders.form.intervalMonths}
                  keyboardType="number-pad"
                  value={intervalMonths}
                  onChangeText={setIntervalMonths}
                />
              </View>
            ) : null}
            {wantsDate ? (
              <View style={styles.half}>
                <Field
                  label={es.reminders.form.intervalDays}
                  keyboardType="number-pad"
                  value={intervalDays}
                  onChangeText={setIntervalDays}
                />
              </View>
            ) : null}
          </View>
          {wantsKm ? (
            <Field
              label={es.reminders.form.intervalKm}
              keyboardType="number-pad"
              value={intervalKm}
              onChangeText={setIntervalKm}
            />
          ) : null}

          <Label text={es.reminders.form.fixed} />
          <Segmented
            options={[
              { key: 'yes', label: es.reminders.form.yes },
              { key: 'no', label: es.reminders.form.no },
            ]}
            value={fixed ? 'yes' : 'no'}
            onChange={(v) => setFixed(v === 'yes')}
            style={{ marginBottom: space.sm }}
          />
          <Hint text={es.reminders.form.fixedHint} />
        </>
      ) : null}

      <Pressable
        onPress={() => setShowAdvanced((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showAdvanced }}
        style={{ paddingVertical: space.md }}>
        <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
          {showAdvanced ? es.reminders.form.advancedHide : es.reminders.form.advanced}
        </T>
      </Pressable>
      {showAdvanced ? (
        <>
          <Field
            label={es.reminders.form.thresholdDays}
            keyboardType="number-pad"
            value={thresholdDays}
            onChangeText={setThresholdDays}
          />
          <Field
            label={es.reminders.form.thresholdKm}
            keyboardType="number-pad"
            value={thresholdKm}
            onChangeText={setThresholdKm}
            hint={es.reminders.form.thresholdHint}
          />
        </>
      ) : null}

      <Field label={es.reminders.form.notes} value={notes} onChangeText={setNotes} multiline />

      <Label text={es.reminders.form.enabled} />
      <Segmented
        options={[
          { key: 'yes', label: es.reminders.enabledLabel },
          { key: 'no', label: es.reminders.disabledLabel },
        ]}
        value={enabled ? 'yes' : 'no'}
        onChange={(v) => setEnabled(v === 'yes')}
        style={{ marginBottom: space.lg }}
      />

      {error ? (
        <T face="body" style={{ color: theme.danger, fontSize: 13, marginBottom: space.md }}>
          {error}
        </T>
      ) : null}

      {editing ? (
        <GhostButton label={es.reminders.form.save} onPress={save} />
      ) : (
        <PrimaryButton label={es.reminders.form.save} onPress={save} />
      )}
    </View>
  );
}

function Label({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
      {text}
    </T>
  );
}

function Hint({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
      {text}
    </T>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 6 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
