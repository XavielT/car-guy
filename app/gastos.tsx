import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Card, Chip, GhostButton, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { dateLabel, km, money, todayIsoDate } from '@/lib/format';
import { lastOdometer, parseDecimal } from '@/lib/math';
import { useStore } from '@/lib/store';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/types';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  maintenance: 'Mantenimiento',
  repair: 'Reparación',
  insurance: 'Seguro',
  tax: 'Impuesto',
  toll: 'Peaje',
  parking: 'Parqueo',
  wash: 'Lavado',
  other: 'Otro',
};

export default function GastosScreen() {
  const router = useRouter();
  const {
    activeVehicle,
    vehicleExpenses,
    vehicleReminders,
    upsertExpense,
    deleteExpense,
    upsertReminder,
    deleteReminder,
    vehicleFillups,
  } = useStore();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIsoDate());
  const [expenseOdo, setExpenseOdo] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('maintenance');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueOdo, setDueOdo] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');

  if (!activeVehicle) return null;
  const vehicle = activeVehicle;
  const odoHint = lastOdometer(vehicleFillups);
  const pending = vehicleReminders.filter((r) => !r.completedAt);

  function saveExpense() {
    const amountDop = parseDecimal(amount);
    if (!amountDop || !description.trim()) {
      Alert.alert('Gasto', 'Pon un monto y una descripción.');
      return;
    }
    upsertExpense({
      vehicleId: vehicle.id,
      occurredAt: new Date(`${expenseDate}T12:00:00`).toISOString(),
      odometerKm: parseDecimal(expenseOdo),
      amountDop,
      category,
      description: description.trim(),
    });
    setAmount('');
    setDescription('');
    setExpenseOdo('');
    setExpenseOpen(false);
  }

  function saveReminder() {
    if (!title.trim() || (!dueDate.trim() && !dueOdo.trim())) {
      Alert.alert('Recordatorio', 'Pon un nombre y una fecha o kilometraje de vencimiento.');
      return;
    }
    upsertReminder({
      vehicleId: vehicle.id,
      title: title.trim(),
      dueDate: dueDate.trim() ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      dueOdometerKm: parseDecimal(dueOdo),
      completedAt: null,
      notes: reminderNotes.trim(),
    });
    setTitle('');
    setDueDate('');
    setDueOdo('');
    setReminderNotes('');
    setReminderOpen(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <T face="display" style={styles.h}>Gastos</T>
        <T face="body" style={styles.sub}>{activeVehicle.name} · mantenimiento, costos y pendientes.</T>

        <View style={styles.actions}>
          <PrimaryButton label={expenseOpen ? 'Cerrar gasto' : 'Registrar gasto'} onPress={() => setExpenseOpen(!expenseOpen)} />
          <GhostButton label={reminderOpen ? 'Cerrar recordatorio' : 'Agregar recordatorio'} onPress={() => setReminderOpen(!reminderOpen)} />
        </View>

        {expenseOpen ? (
          <Card style={styles.form}>
            <T face="title" style={styles.formTitle}>Nuevo gasto</T>
            <Field label="Descripción" placeholder="Cambio de aceite, seguro…" value={description} onChangeText={setDescription} />
            <Field label="Monto (RD$)" keyboardType="decimal-pad" placeholder="3500" value={amount} onChangeText={setAmount} />
            <Field label="Fecha" placeholder="AAAA-MM-DD" value={expenseDate} onChangeText={setExpenseDate} />
            <Field label="Odómetro (km, opcional)" keyboardType="decimal-pad" placeholder={odoHint ? String(odoHint) : '45210'} value={expenseOdo} onChangeText={setExpenseOdo} />
            <T face="semibold" style={styles.label}>Categoría</T>
            <View style={styles.chips}>{EXPENSE_CATEGORIES.map((item) => <Chip key={item} label={CATEGORY_LABELS[item]} selected={category === item} onPress={() => setCategory(item)} />)}</View>
            <PrimaryButton label="Guardar gasto" onPress={saveExpense} />
          </Card>
        ) : null}

        {reminderOpen ? (
          <Card style={styles.form}>
            <T face="title" style={styles.formTitle}>Nuevo recordatorio</T>
            <Field label="Qué hay que hacer" placeholder="Cambiar aceite" value={title} onChangeText={setTitle} />
            <Field label="Vence el (opcional)" placeholder="AAAA-MM-DD" value={dueDate} onChangeText={setDueDate} />
            <Field label="Vence a los km (opcional)" keyboardType="decimal-pad" placeholder="50000" value={dueOdo} onChangeText={setDueOdo} />
            <Field label="Nota (opcional)" placeholder="Aceite  sintético 5W-30" value={reminderNotes} onChangeText={setReminderNotes} />
            <PrimaryButton label="Guardar recordatorio" onPress={saveReminder} />
          </Card>
        ) : null}

        <T face="title" style={styles.sec}>Pendientes</T>
        {pending.length === 0 ? <T face="body" style={styles.empty}>No tienes mantenimientos pendientes.</T> : pending.map((reminder) => (
          <Card key={reminder.id} style={styles.item}>
            <T face="semibold" style={styles.itemTitle}>{reminder.title}</T>
            <T face="body" style={styles.meta}>{reminder.dueDate ? `Fecha: ${dateLabel(reminder.dueDate)}` : ''}{reminder.dueDate && reminder.dueOdometerKm ? ' · ' : ''}{reminder.dueOdometerKm ? `Odómetro: ${km(reminder.dueOdometerKm)}` : ''}</T>
            {reminder.notes ? <T face="body" style={styles.meta}>{reminder.notes}</T> : null}
            <View style={styles.itemActions}>
              <GhostButton label="Marcar listo" onPress={() => upsertReminder({ ...reminder, completedAt: new Date().toISOString() })} />
              <GhostButton danger label="Borrar" onPress={() => deleteReminder(reminder.id)} />
            </View>
          </Card>
        ))}

        <T face="title" style={styles.sec}>Gastos recientes</T>
        {vehicleExpenses.length === 0 ? <T face="body" style={styles.empty}>Registra mantenimiento, seguros, peajes y otros costos para conocer el precio real de tu vehículo.</T> : [...vehicleExpenses].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).map((expense) => (
          <Pressable key={expense.id} onLongPress={() => Alert.alert('Borrar gasto', expense.description, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => deleteExpense(expense.id) }])}>
            <View style={styles.expenseRow}>
              <View style={{ flex: 1 }}><T face="semibold" style={styles.itemTitle}>{expense.description}</T><T face="body" style={styles.meta}>{CATEGORY_LABELS[expense.category]} · {dateLabel(expense.occurredAt)}{expense.odometerKm ? ` · ${km(expense.odometerKm)}` : ''}</T></View>
              <T face="monoBold" style={styles.amountText}>{money(expense.amountDop)}</T>
            </View>
          </Pressable>
        ))}
        <GhostButton label="Volver a Más" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.receipt },
  pad: { padding: 20, paddingBottom: 48 },
  h: { fontSize: 36, color: colors.ink },
  sub: { color: colors.muted, marginTop: 6, marginBottom: 12, lineHeight: 22 },
  actions: { gap: 4 },
  form: { marginTop: 12 },
  formTitle: { color: colors.ink, fontSize: 22, marginBottom: 6 },
  label: { color: colors.ink, fontSize: 13, marginBottom: 8, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  sec: { fontSize: 22, color: colors.ink, marginTop: 28, marginBottom: 12 },
  empty: { color: colors.muted, lineHeight: 22 },
  item: { marginBottom: 10 },
  itemTitle: { color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 18 },
  itemActions: { flexDirection: 'row', justifyContent: 'flex-start', gap: 18, marginTop: 4 },
  expenseRow: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 13, flexDirection: 'row', alignItems: 'center' },
  amountText: { color: colors.ink, fontSize: 14, marginLeft: 12 },
});
