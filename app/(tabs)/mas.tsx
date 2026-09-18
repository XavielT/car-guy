import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import {
  GhostButton,
  NavRow,
  PrimaryButton,
  SectionHeader,
  Segmented,
  StatusPill,
  Surface,
} from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { useSession } from '@/lib/cloud/auth';
import { exportBackup, importBackup } from '@/lib/backup';
import { FUEL_CATALOG } from '@/lib/fuel';
import { es } from '@/lib/i18n/es';
import { describeCounts } from '@/lib/import/tucombustible';
import { useStore } from '@/lib/store';
import { useTheme, type ThemePreference } from '@/lib/theme/useTheme';

/**
 * Everything that is not a tab, in the order 03-screens-ia.md lays out: what you
 * own, what you do to it, what you paid, the papers, the account, the data, and
 * then the app's own settings.
 */
export default function MasScreen() {
  const router = useRouter();
  const { theme, preference, setPreference } = useTheme();
  const { data, activeVehicle, setActiveVehicle, resetAll, refresh } = useStore();
  const { session } = useSession();

  const version = Constants.expoConfig?.version ?? '—';

  async function handleExport() {
    try {
      const shared = await exportBackup();
      if (!shared) Alert.alert(es.more.backupTitle, es.more.backupUnsupported);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      Alert.alert(es.more.backupTitle, es.more.backupFailed(reason));
    }
  }

  async function handleImport() {
    try {
      const result = await importBackup();
      if (!result) return;
      await refresh();
      // A merge, never a wipe: rows are matched by id and the newer
      // updated_at wins, so restoring an old file cannot undo recent work.
      Alert.alert(
        es.more.restoredTitle,
        result.kind === 'legacy'
          ? es.more.restoredLegacy(describeCounts(result.counts))
          : es.more.restoredMerge(result.counts.merged, result.counts.tables),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      Alert.alert(es.more.restoreTitle, reason);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.more.title}
        </T>
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {es.more.subtitle}
        </T>

        <SectionHeader title={es.more.garage} caption={es.more.garageCaption} style={styles.firstSection} />
        {data.vehicles.map((v) => {
          const active = v.id === activeVehicle?.id;
          return (
            <Pressable
              key={v.id}
              onPress={() => router.push({ pathname: '/vehiculo/[id]', params: { id: v.id } })}
              accessibilityRole="button"
              style={[
                styles.vehicle,
                {
                  backgroundColor: theme.bg.surface,
                  borderColor: active ? theme.accent : theme.line,
                },
              ]}>
              <View style={{ flex: 1 }}>
                <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
                  {v.name}
                </T>
                <T face="body" style={[styles.meta, { color: theme.text.secondary }]}>
                  {v.plate ? `${v.plate} · ` : ''}
                  {FUEL_CATALOG[v.defaultFuelType].label}
                </T>
              </View>
              {active ? (
                <StatusPill status="ok" label={es.more.active} />
              ) : (
                <GhostButton label={es.more.activate} onPress={() => setActiveVehicle(v.id)} />
              )}
            </Pressable>
          );
        })}
        <PrimaryButton label={es.more.addVehicle} onPress={() => router.push('/vehiculo/nuevo')} />

        <SectionHeader title={es.more.maintenance} />
        <NavRow
          label={es.more.service}
          caption={es.more.serviceCaption}
          onPress={() => router.push('/servicio/nuevo')}
        />
        <NavRow
          label={es.more.history}
          caption={es.more.historyCaption}
          onPress={() => router.push('/(tabs)/historial')}
        />
        <NavRow
          label={es.more.reminders}
          caption={es.more.remindersCaption}
          onPress={() => router.push('/recordatorios')}
        />
        <NavRow
          label={es.more.tasks}
          caption={es.more.tasksCaption}
          onPress={() => router.push('/tareas')}
        />

        <SectionHeader title={es.more.fuelSection} />
        <NavRow
          label={es.more.newFillUp}
          caption={es.more.newFillUpCaption}
          onPress={() => router.push('/carga/nueva')}
        />
        <NavRow
          label={es.more.prices}
          caption={es.more.pricesCaption(data.settings.priceWeekLabel)}
          onPress={() => router.push('/precios')}
        />
        <NavRow
          label={es.more.expense}
          caption={es.more.expenseCaption}
          onPress={() => router.push('/gasto/nuevo')}
        />

        <SectionHeader title={es.more.documents} />
        <NavRow
          label={es.more.documents}
          caption={es.more.documentsCaption}
          onPress={() => router.push('/documentos')}
        />

        <SectionHeader title={es.more.account} />
        <NavRow
          label={session ? es.account.signedInAs : es.account.signIn}
          caption={session?.user.email ?? es.more.accountBody}
          onPress={() => router.push('/cuenta')}
          trailing={session ? <StatusPill status="ok" label={es.more.active} /> : undefined}
        />

        <SectionHeader title={es.more.data} caption={es.more.dataCaption} />
        <PrimaryButton label={es.more.backup} onPress={handleExport} />
        <GhostButton label={es.more.restore} onPress={handleImport} />
        <T face="body" style={[styles.meta, { color: theme.text.muted }]}>
          {es.more.restoreCaption}
        </T>
        <GhostButton
          danger
          label={es.more.wipe}
          onPress={() =>
            Alert.alert(es.more.wipeTitle, es.more.wipeBody, [
              { text: es.common.cancel, style: 'cancel' },
              { text: es.common.delete, style: 'destructive', onPress: resetAll },
            ])
          }
        />

        <SectionHeader title={es.more.appearance} caption={es.more.appearanceCaption} />
        <Segmented<ThemePreference>
          options={[
            { key: 'system', label: es.more.themes.system },
            { key: 'dark', label: es.more.themes.dark },
            { key: 'light', label: es.more.themes.light },
          ]}
          value={preference}
          onChange={setPreference}
        />

        <SectionHeader title={es.more.notifications} />
        <NavRow
          label={es.more.notifications}
          caption={es.more.notificationsCaption}
          onPress={() => router.push('/notificaciones')}
        />

        <SectionHeader title={es.more.about} />
        <Surface>
          <T face="monoBold" style={{ color: theme.text.primary, fontSize: 15 }}>
            {es.more.version(version)}
          </T>
          <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
            {es.more.aboutBody}
          </T>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: space.gutter, paddingBottom: 48 },
  h: { fontSize: 34 },
  sub: { marginTop: 6, lineHeight: 22 },
  firstSection: { marginTop: space.xl },
  meta: { marginTop: space.sm, lineHeight: 19, fontSize: 13 },
  cardBody: { fontSize: 14, marginTop: space.sm, lineHeight: 21 },
  vehicle: {
    borderRadius: radius.input,
    padding: space.md,
    paddingLeft: space.lg,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    borderWidth: 1,
  },
});
