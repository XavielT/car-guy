import { router as appRouter, useRouter } from 'expo-router';
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
import { FEATURE_DIY, FEATURE_FEEDBACK, FEATURE_I18N, FEATURE_SHARE, FEATURE_SYNC, FEATURE_TRACK, FEATURE_TRIPS } from '@/lib/flags';
import { FEEDBACK_ROUTE } from '@/lib/feedback';
import { t, useLanguage, type LanguagePreference } from '@/lib/i18n';
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
  const language = useLanguage();
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
    const tap = taps.current;
    tap.count = now - tap.last < 800 ? tap.count + 1 : 1;
    tap.last = now;
    if (tap.count >= 3 && tap.count < 7) showToast(t.dev.tapsLeft(7 - tap.count));
    if (tap.count >= 7) {
      tap.count = 0;
      void setDiagnosticsMode(!diagnostics);
      showToast(diagnostics ? t.dev.diagnosticsOff : t.dev.diagnosticsOn);
    }
  }

  async function handleExport() {
    try {
      const shared = await exportBackup();
      if (!shared) Alert.alert(t.more.backupTitle, t.more.backupUnsupported);
    } catch (error) {
      Alert.alert(t.more.backupTitle, userMessage('backup', error, t.more.backupFailed));
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
        t.more.restoredTitle,
        result.kind === 'legacy'
          ? t.more.restoredLegacy(describeCounts(result.counts))
          : t.more.restoredMerge(result.counts.merged, result.counts.tables),
      );
    } catch (error) {
      Alert.alert(t.more.restoreTitle, userMessage('restore', error, t.more.restoreFailed));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg.base }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <ScreenTitle title={t.more.title} size={34} sub={t.more.subtitle} />

        <MoreSection title={t.more.garage} caption={t.more.garageCaption} style={styles.firstSection} />
        <NavRow
          label={t.more.garageOpen}
          caption={t.more.garageOpenCaption(data.vehicles.filter((v) => !v.isArchived).length, archived.length)}
          onPress={() => router.push('/(tabs)/garaje')}
        />
        {activeVehicle ? (
          <NavRow
            label={t.more.activeVehicle(activeVehicle.name)}
            caption={t.more.activeVehicleCaption}
            onPress={() => router.push({ pathname: '/vehiculo/[id]', params: { id: activeVehicle.id } })}
          />
        ) : null}
        <PrimaryButton label={t.more.addVehicle} onPress={() => router.push('/vehiculo/nuevo')} />

        {/* Chequeo left the tab bar for the Garaje (IMP 28092026); this is one of its four doors. */}
        <MoreSection title={t.more.checksSection} />
        <NavRow label={t.more.checks} caption={t.more.checksCaption} onPress={() => router.push('/chequeo')} />
        <NavRow label={t.more.checkGuide} caption={t.more.checkGuideCaption} onPress={() => router.push('/chequeo/guia')} />

        <MoreSection title={t.more.maintenance} />
        <NavRow
          label={t.more.service}
          caption={t.more.serviceCaption}
          onPress={() => router.push('/servicio/nuevo')}
        />
        <NavRow
          label={t.more.history}
          caption={t.more.historyCaption}
          onPress={() => router.push('/(tabs)/historial')}
        />
        <NavRow
          label={t.more.reminders}
          caption={t.more.remindersCaption}
          onPress={() => router.push('/recordatorios')}
        />
        <NavRow
          label={t.catalog.title}
          caption={t.catalog.caption}
          onPress={() => router.push('/catalogo')}
        />
        <NavRow
          label={t.more.tasks}
          caption={t.more.tasksCaption}
          onPress={() => router.push('/tareas')}
        />

        <MoreSection title={t.more.fuelSection} />
        <NavRow
          label={t.more.newFillUp}
          caption={t.more.newFillUpCaption}
          onPress={() => router.push('/carga/nueva')}
        />
        <NavRow
          label={t.more.prices}
          caption={t.more.pricesCaption(data.settings.priceWeekLabel)}
          onPress={() => router.push('/precios')}
        />
        <NavRow
          label={t.more.expense}
          caption={t.more.expenseCaption}
          onPress={() => router.push('/gasto/nuevo')}
        />

        {FEATURE_DIY ? (
          <>
            <MoreSection title={t.diyMore.section} />
            <NavRow label={t.diyMore.contacts} caption={t.diyMore.contactsCaption} onPress={() => router.push('/contactos')} />
            <NavRow label={t.diyMore.obd} caption={t.diyMore.obdCaption} onPress={() => router.push('/obd')} />
            {FEATURE_TRACK ? <NavRow label={t.track.more} caption={t.track.moreCaption} onPress={() => router.push('/pista')} /> : null}
            {FEATURE_TRIPS ? <NavRow label={t.trips.more} caption={t.trips.moreCaption} onPress={() => router.push('/viajes')} /> : null}
          </>
        ) : null}

        {FEATURE_SHARE ? (
          <>
            <MoreSection title={t.routes.share} />
            <NavRow label={t.share.more} caption={t.share.moreCaption} onPress={() => router.push('/compartidos')} />
            <NavRow label={t.members.haveCode} caption={t.members.acceptIntro} onPress={() => router.push({ pathname: '/invitacion/[code]', params: { code: '-' } })} />
          </>
        ) : null}

        <MoreSection title={t.more.documents} />
        <NavRow
          label={t.more.documents}
          caption={t.more.documentsCaption}
          onPress={() => router.push('/documentos')}
        />

        <MoreSection title={t.more.account} />
        <NavRow
          label={session ? t.account.signedInAs : t.account.signIn}
          caption={session?.user.email ?? t.more.accountBody}
          onPress={() => router.push('/cuenta')}
          trailing={
            session ? (
              FEATURE_SYNC ? (
                <SyncPill />
              ) : (
                <StatusPill status="ok" label={t.more.active} />
              )
            ) : undefined
          }
        />

        <MoreSection
          title={t.more.data}
          caption={
            FEATURE_SYNC && session ? t.more.dataCaptionSynced : t.more.dataCaption
          }
        />
        <PrimaryButton label={t.more.backup} onPress={handleExport} />
        <GhostButton label={t.more.restore} onPress={handleImport} />
        <T face="body" style={[styles.meta, { color: theme.text.muted }]}>
          {t.more.restoreCaption}
        </T>
        <GhostButton
          danger
          label={t.more.wipe}
          onPress={() =>
            Alert.alert(t.more.wipeTitle, t.more.wipeBody, [
              { text: t.common.cancel, style: 'cancel' },
              { text: t.common.delete, style: 'destructive', onPress: resetAll },
            ])
          }
        />

        <MoreSection title={t.more.appearance} caption={t.more.appearanceCaption} />
        <Segmented<ThemePreference>
          options={[
            { key: 'system', label: t.more.themes.system },
            { key: 'dark', label: t.more.themes.dark },
            { key: 'light', label: t.more.themes.light },
          ]}
          value={preference}
          onChange={setPreference}
        />

        {FEATURE_I18N ? (
          <>
            <MoreSection title={t.language.title} caption={t.language.caption} />
            <Segmented<LanguagePreference>
              options={[
                { key: 'system', label: t.language.system },
                { key: 'es', label: t.language.es },
                { key: 'en', label: t.language.en },
              ]}
              value={language.preference}
              onChange={(next) => {
                // The navigator is keyed on the language (app/_layout.tsx), so the switch
                // remounts it on Inicio; bring the person back to where they were.
                language.setPreference(next);
                setTimeout(() => appRouter.navigate('/(tabs)/mas'), 0);
              }}
            />
          </>
        ) : null}

        <MoreSection title={t.more.notifications} />
        <NavRow
          label={t.more.notifications}
          caption={t.more.notificationsCaption}
          onPress={() => router.push('/notificaciones')}
        />

        <MoreSection title={t.more.about} />
        {installOffer ? <NavRow label={t.install.more} caption={t.install.moreCaption} onPress={() => router.push('/instalar')} /> : null}
        <NavRow
          label={t.versions.more}
          caption={versionUnseen ? t.versions.moreUnseen : t.versions.moreCaption}
          onPress={() => router.push('/versiones')}
          trailing={
            versionUnseen ? (
              <View
                accessibilityLabel={t.versions.moreUnseen}
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.redline }}
              />
            ) : undefined
          }
        />
        {FEATURE_FEEDBACK ? (
          <NavRow
            label={t.feedback.more}
            caption={t.feedback.moreCaption}
            onPress={() => router.push({ pathname: FEEDBACK_ROUTE, params: { from: '/mas' } })}
          />
        ) : null}
        {isAdmin ? <NavRow label={t.admin.more} caption={t.admin.moreCaption} onPress={() => router.push('/admin')} /> : null}
        <Surface>
          <Pressable onPress={tapVersion} accessibilityRole="text">
            <T face="monoBold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {t.more.version(version)}
            </T>
          </Pressable>
          {notice ? (
            <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 12, marginTop: 2 }}>
              {notice}
            </T>
          ) : null}
          {gitSha ? (
            <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
              {t.more.build(gitSha)}
            </T>
          ) : null}
          <T face="body" style={[styles.cardBody, { color: theme.text.secondary }]}>
            {t.more.aboutBody}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.sm, lineHeight: 17 }}>
            {t.more.aboutCredits}
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
