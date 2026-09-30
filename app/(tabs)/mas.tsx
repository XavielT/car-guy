import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncPill } from '@/components/SyncPill';
import { T } from '@/components/T';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import {
  GhostButton,
  NavRow,
  PrimaryButton,
  Segmented,
  StatusPill,
  Surface,
} from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { appVersion, gitSha } from '@/lib/appVersion';
import { useVersionSeen } from '@/lib/changelog/seen';
import { useIsAdmin } from '@/lib/cloud/admin';
import { useSession } from '@/lib/cloud/auth';
import { userMessage } from '@/lib/diagnostics';
import { setDiagnosticsMode, useDiagnosticsMode } from '@/lib/diagnosticsMode';
import { exportBackup, importBackup } from '@/lib/backup';
import { useInstallOffer } from '@/lib/release/useInstallOffer';
import { FEATURE_DIY, FEATURE_FEEDBACK, FEATURE_SHARE, FEATURE_SYNC, FEATURE_TRACK, FEATURE_TRIPS } from '@/lib/flags';
import { FEEDBACK_ROUTE } from '@/lib/feedback';
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
  const { data, activeVehicle, resetAll, refresh } = useStore();
  const archived = data.vehicles.filter((v) => v.isArchived);
  const installOffer = useInstallOffer();
  const isAdmin = useIsAdmin();
  const { session } = useSession();
  const { unseen: versionUnseen } = useVersionSeen();

  const version = appVersion;
  const diagnostics = useDiagnosticsMode();
  const taps = useRef({ count: 0, last: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2000);
  }

  // Seven quick taps on the version, like Android's developer options. Only a
  // release build needs it: in development the hints are always on.
  function tapVersion() {
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.last < 800 ? t.count + 1 : 1;
    t.last = now;
    if (t.count >= 3 && t.count < 7) showToast(es.dev.tapsLeft(7 - t.count));
    if (t.count >= 7) {
      t.count = 0;
      void setDiagnosticsMode(!diagnostics);
      showToast(diagnostics ? es.dev.diagnosticsOff : es.dev.diagnosticsOn);
    }
  }

  async function handleExport() {
    try {
      const shared = await exportBackup();
      if (!shared) Alert.alert(es.more.backupTitle, es.more.backupUnsupported);
    } catch (error) {
      Alert.alert(es.more.backupTitle, userMessage('backup', error, es.more.backupFailed));
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
      Alert.alert(es.more.restoreTitle, userMessage('restore', error, es.more.restoreFailed));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <ScreenTitle title={es.more.title} size={34} sub={es.more.subtitle} />

        <MoreSection title={es.more.garage} caption={es.more.garageCaption} style={styles.firstSection} />
        <NavRow
          label={es.more.garageOpen}
          caption={es.more.garageOpenCaption(data.vehicles.filter((v) => !v.isArchived).length, archived.length)}
          onPress={() => router.push('/(tabs)/garaje')}
        />
        {activeVehicle ? (
          <NavRow
            label={es.more.activeVehicle(activeVehicle.name)}
            caption={es.more.activeVehicleCaption}
            onPress={() => router.push({ pathname: '/vehiculo/[id]', params: { id: activeVehicle.id } })}
          />
        ) : null}
        <PrimaryButton label={es.more.addVehicle} onPress={() => router.push('/vehiculo/nuevo')} />

        {/* Chequeo left the tab bar for the Garaje (IMP 28092026); this is one of its four doors. */}
        <MoreSection title={es.more.checksSection} />
        <NavRow label={es.more.checks} caption={es.more.checksCaption} onPress={() => router.push('/chequeo')} />
        <NavRow label={es.more.checkGuide} caption={es.more.checkGuideCaption} onPress={() => router.push('/chequeo/guia')} />

        <MoreSection title={es.more.maintenance} />
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
          label={es.catalog.title}
          caption={es.catalog.caption}
          onPress={() => router.push('/catalogo')}
        />
        <NavRow
          label={es.more.tasks}
          caption={es.more.tasksCaption}
          onPress={() => router.push('/tareas')}
        />

        <MoreSection title={es.more.fuelSection} />
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

        {FEATURE_DIY ? (
          <>
            <MoreSection title={es.diyMore.section} />
            <NavRow label={es.diyMore.contacts} caption={es.diyMore.contactsCaption} onPress={() => router.push('/contactos')} />
            <NavRow label={es.diyMore.obd} caption={es.diyMore.obdCaption} onPress={() => router.push('/obd')} />
            {FEATURE_TRACK ? <NavRow label={es.track.more} caption={es.track.moreCaption} onPress={() => router.push('/pista')} /> : null}
            {FEATURE_TRIPS ? <NavRow label={es.trips.more} caption={es.trips.moreCaption} onPress={() => router.push('/viajes')} /> : null}
          </>
        ) : null}

        {FEATURE_SHARE ? (
          <>
            <MoreSection title={es.routes.share} />
            <NavRow label={es.share.more} caption={es.share.moreCaption} onPress={() => router.push('/compartidos')} />
            <NavRow label={es.members.haveCode} caption={es.members.acceptIntro} onPress={() => router.push({ pathname: '/invitacion/[code]', params: { code: '-' } })} />
          </>
        ) : null}

        <MoreSection title={es.more.documents} />
        <NavRow
          label={es.more.documents}
          caption={es.more.documentsCaption}
          onPress={() => router.push('/documentos')}
        />

        <MoreSection title={es.more.account} />
        <NavRow
          label={session ? es.account.signedInAs : es.account.signIn}
          caption={session?.user.email ?? es.more.accountBody}
          onPress={() => router.push('/cuenta')}
          trailing={
            session ? (
              FEATURE_SYNC ? (
                <SyncPill />
              ) : (
                <StatusPill status="ok" label={es.more.active} />
              )
            ) : undefined
          }
        />

        <MoreSection
          title={es.more.data}
          caption={
            FEATURE_SYNC && session ? es.more.dataCaptionSynced : es.more.dataCaption
          }
        />
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

        <MoreSection title={es.more.appearance} caption={es.more.appearanceCaption} />
        <Segmented<ThemePreference>
          options={[
            { key: 'system', label: es.more.themes.system },
            { key: 'dark', label: es.more.themes.dark },
            { key: 'light', label: es.more.themes.light },
          ]}
          value={preference}
          onChange={setPreference}
        />

        <MoreSection title={es.more.notifications} />
        <NavRow
          label={es.more.notifications}
          caption={es.more.notificationsCaption}
          onPress={() => router.push('/notificaciones')}
        />

        <MoreSection title={es.more.about} />
        {installOffer ? <NavRow label={es.install.more} caption={es.install.moreCaption} onPress={() => router.push('/instalar')} /> : null}
        <NavRow
          label={es.versions.more}
          caption={versionUnseen ? es.versions.moreUnseen : es.versions.moreCaption}
          onPress={() => router.push('/versiones')}
          trailing={
            versionUnseen ? (
              <View
                accessibilityLabel={es.versions.moreUnseen}
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.redline }}
              />
            ) : undefined
          }
        />
        {FEATURE_FEEDBACK ? (
          <NavRow
            label={es.feedback.more}
            caption={es.feedback.moreCaption}
            onPress={() => router.push({ pathname: FEEDBACK_ROUTE, params: { from: '/mas' } })}
          />
        ) : null}
        {isAdmin ? <NavRow label={es.admin.more} caption={es.admin.moreCaption} onPress={() => router.push('/admin')} /> : null}
        <Surface>
          <Pressable onPress={tapVersion} accessibilityRole="text">
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {es.more.version(version)}
            </T>
          </Pressable>
          {notice ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 12, marginTop: 2 }}>
              {notice}
            </T>
          ) : null}
          {gitSha ? (
            <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
              {es.more.build(gitSha)}
            </T>
          ) : null}
          <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
            {es.more.aboutBody}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm, lineHeight: 17 }}>
            {es.more.aboutCredits}
          </T>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  archivedLabel: { fontSize: 11, letterSpacing: 0.9, marginTop: space.md, marginBottom: space.sm },
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

/**
 * Más's section headers are eyebrows (IMP 28092026, 05-design-jdm.md): Saira
 * 400 tracked, muted, so the rows — not the headers — carry the weight.
 */
function MoreSection({ title, caption, style }: { title: string; caption?: string; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View style={[{ marginTop: space.xl, marginBottom: space.sm }, style]}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.accent, fontSize: 12 }}>
        {title}
      </T>
      {caption ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 4 }}>
          {caption}
        </T>
      ) : null}
    </View>
  );
}
