import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecapShareSheet } from '@/components/recap/RecapShareSheet';
import { RecapViewer } from '@/components/recap/RecapViewer';
import { T } from '@/components/T';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { loadRecapInput } from '@/lib/db/recapQueries';
import { todayIso } from '@/lib/domain/dates';
import { buildRecap, parseRecapId, recapId, type Recap, type RecapScope, type RecapVehicle } from '@/lib/domain/recap';
import { t } from '@/lib/i18n';
import { recapTitle } from '@/lib/recap/copy';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** `/resumen/2026-10` or `/resumen/2026` (`?scope=all` for the whole garage): the story viewer for one period (SPEC-J §J1, §J4). */
export default function RecapScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { period, scope: scopeParam } = useLocalSearchParams<{ period: string; scope?: string }>();
  const { data, activeVehicle } = useStore();
  const [recap, setRecap] = useState<Recap | null | 'missing'>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showThin, setShowThin] = useState(false);
  const [index, setIndex] = useState(0);
  const parsed = parseRecapId(String(period ?? ''));

  useEffect(() => {
    let live = true;
    if (!parsed) {
      void Promise.resolve().then(() => live && setRecap('missing'));
      return () => {
        live = false;
      };
    }
    // A car sold or archived still has its recaps.
    const all: RecapVehicle[] = data.vehicles.map((v) => ({ id: v.id, name: v.name, photoMediaId: v.detail?.photoMediaId ?? null }));
    const scope: RecapScope = scopeParam === 'all' || !activeVehicle ? { kind: 'all' } : { kind: 'vehicle', vehicleId: activeVehicle.id };
    void loadRecapInput(all, data.fillups).then((input) => {
      if (!live) return;
      setRecap(buildRecap(input, parsed, scope, todayIso()));
      setIndex(0);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, scopeParam, activeVehicle?.id, data]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/cifras'));

  if (recap === null)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0907', alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <T face="body" style={{ color: '#C9C2B6' }}>
          {t.recap.viewer.loading}
        </T>
      </SafeAreaView>
    );
  if (recap === 'missing')
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base, padding: space.gutter }}>
        <Stack.Screen options={{ headerShown: false }} />
        <T face="body" style={{ color: theme.text.primary }}>
          {t.recap.viewer.notFound}
        </T>
        <GhostButton label={t.recap.viewer.close} onPress={close} />
      </SafeAreaView>
    );

  // A thin period: the encouraging empty state with the one action (SPEC-J §J7), and what exists behind a button.
  if (recap.thin && !showThin)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }}>
        <Stack.Screen options={{ headerShown: true, title: recapTitle(recap) }} />
        <ScrollView contentContainerStyle={{ padding: space.gutter, gap: space.md }}>
          <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 26 }}>
            {t.recap.thin.title}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 15, lineHeight: 22 }}>
            {t.recap.thin.body}
          </T>
          <View style={{ gap: space.sm }}>
            <PrimaryButton label={t.recap.thin.fuel} onPress={() => router.push('/carga/nueva')} />
            <GhostButton label={t.recap.thin.trip} onPress={() => router.push('/conducir')} />
            {recap.cards.length > 1 ? <GhostButton label={t.recap.viewer.list} onPress={() => setShowThin(true)} /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0907' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <RecapViewer
        key={recapId(recap.period)}
        recap={recap}
        index={index}
        onIndex={setIndex}
        onClose={close}
        onShare={() => setShareOpen(true)}
        onMonth={(m) => {
          if (recap.period.kind === 'year') router.replace({ pathname: '/resumen/[period]', params: { period: recapId({ kind: 'month', year: recap.period.year, month: m }), scope: scopeParam } } as never);
        }}
      />
      <RecapShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} recap={recap} cardIndex={index} />
    </View>
  );
}
