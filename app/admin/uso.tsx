import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/Field';
import { AdminPanelSkeleton } from '@/components/skeletons/AdminSkeleton';
import { T } from '@/components/T';
import { EmptyState, GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAdminGate } from '@/lib/cloud/admin';
import { loadUsage, readSupportConfig, setAppConfig, type AdminUsage } from '@/lib/cloud/appConfig';
import { proNeeded, supportTextFrom, usageLevel, type UsageSnapshot } from '@/lib/domain/usage';
import { monthLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

const MB = 1024 * 1024;
const bytes = (n: number) => (n >= 1024 * MB ? `${(n / (1024 * MB)).toFixed(2)} GB` : `${Math.round(n / MB)} MB`);

/**
 * Admin → Uso y costos (IMP 01102026 Phase 4, ADR-53): x-core against the Free plan — bars amber at 70 %,
 * red at 90 % — the date Pro would be needed at the current slope, "Publicar en Apoyar", and the editor for
 * what Apoyar shows (links, bank details, thanks list; all in app_config, never in the repo).
 */
export default function UsoScreen() {
  const { theme } = useTheme();
  const gate = useAdminGate();
  const [data, setData] = useState<{ usage: AdminUsage; history: UsageSnapshot[] } | null | 'error'>(null);
  const [links, setLinks] = useState('');
  const [bank, setBank] = useState('');
  const [thanks, setThanks] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (gate !== 'admin') return;
      void loadUsage().then((r) => setData(r ?? 'error'));
      void readSupportConfig().then((c) => {
        if (!c) return;
        setLinks(c.links.map((l) => `${l.label} | ${l.url}`).join('\n'));
        setBank(c.bank ?? '');
        setThanks(c.thanks.join('\n'));
      });
    }, [gate]),
  );

  const header = <Stack.Screen options={{ headerShown: true, title: t.usage.title }} />;
  if (gate !== 'admin') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg.base, justifyContent: 'center' }}>
        {header}
        {gate === 'loading' ? null : <EmptyState icon="lock-closed-outline" message={t.admin.notAdmin} />}
      </View>
    );
  }

  const bar = (label: string, used: number, limit: number, show: (n: number) => string) => {
    const level = usageLevel(used, limit);
    const color = level === 'red' ? theme.danger : level === 'amber' ? theme.accentFill : theme.statusText.ok;
    const pct = Math.round((used / limit) * 100);
    return (
      <View key={label} style={{ marginBottom: space.md }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
          {label}
        </T>
        <View style={[styles.rail, { backgroundColor: theme.line }]}>
          <View style={{ width: `${Math.min(100, Math.max(1, pct))}%`, height: '100%', backgroundColor: color }} />
        </View>
        <T face="mono" style={{ color: theme.text.secondary, fontSize: 12 }}>
          {t.usage.of(show(used), show(limit), pct)}
        </T>
      </View>
    );
  };

  const save = async () => {
    const parsed = links
      .split('\n')
      .map((line) => line.split('|').map((x) => x.trim()))
      .filter(([label, url]) => label && url && /^https:\/\//.test(url))
      .map(([label, url]) => ({ label, url }));
    const ok = (
      await Promise.all([
        setAppConfig('support_links', parsed, true),
        setAppConfig('support_bank', bank.trim() || null, true),
        setAppConfig('support_thanks', thanks.split('\n').map((x) => x.trim()).filter(Boolean), true),
      ])
    ).every(Boolean);
    setNote(ok ? t.usage.saved : t.usage.failed);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      {header}
      {data === 'error' ? (
        <T face="body" style={{ color: theme.statusText.vencido, fontSize: 14, marginBottom: space.md }}>
          {t.usage.loadFailed}
        </T>
      ) : data ? (
        (() => {
          const { usage, history } = data;
          const pro = proNeeded(history);
          return (
            <Surface padded style={{ marginBottom: space.lg }}>
              {bar(t.usage.db, Number(usage.db_bytes), usage.limits.db_bytes, bytes)}
              {bar(t.usage.storage, Number(usage.storage_bytes), usage.limits.storage_bytes, bytes)}
              {bar(t.usage.mau, Number(usage.mau), usage.limits.mau, (n) => String(n))}
              <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
                {[t.usage.users(Number(usage.users)), usage.juntes_30d != null ? t.usage.juntes(Number(usage.juntes_30d)) : null].filter(Boolean).join(' · ')}
              </T>
              <T face="title" style={{ color: pro?.when === 'reached' ? theme.dangerText : theme.text.primary, fontSize: 18, marginTop: space.md, textTransform: 'uppercase' }}>
                {pro == null ? t.usage.proFar : pro.when === 'reached' ? t.usage.proReached : t.usage.proEta(monthLabel(pro.when.toISOString().slice(0, 7)))}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4 }}>
                {t.usage.history(history.length)}
              </T>
              <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                {t.usage.egress}
              </T>
              <View style={{ marginTop: space.md }}>
                <PrimaryButton
                  label={t.usage.publish}
                  onPress={() => void setAppConfig('support_text', supportTextFrom(history), true).then((ok) => setNote(ok ? t.usage.published : t.usage.failed))}
                />
              </View>
            </Surface>
          );
        })()
      ) : (
        <AdminPanelSkeleton />
      )}

      {note ? (
        <T face="body" accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 13, marginBottom: space.md }}>
          {note}
        </T>
      ) : null}

      <Field label={t.usage.linksTitle} hint={t.usage.linksHint} value={links} onChangeText={setLinks} multiline autoCapitalize="none" />
      <Field label={t.usage.bankTitle} value={bank} onChangeText={setBank} multiline />
      <Field label={t.usage.thanksTitle} hint={t.usage.thanksHint} value={thanks} onChangeText={setThanks} multiline />
      <GhostButton label={t.usage.save} onPress={() => void save()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  rail: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 6 },
});
