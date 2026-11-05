import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { T } from '@/components/T';
import { EmptyState, StatusRow } from '@/components/ui';
import { space } from '@/constants/theme';
import { loadRecapInput } from '@/lib/db/recapQueries';
import { todayIso } from '@/lib/domain/dates';
import { periodsWithData, recapId, type RecapPeriod } from '@/lib/domain/recap';
import { monthTitle } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';

/** Cifras → Resúmenes (SPEC-J §J1): every month and year that has data, newest first, for this car or the whole garage. */
export default function RecapListScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, activeVehicle } = useStore();
  const [all, setAll] = useState(false);
  const [periods, setPeriods] = useState<RecapPeriod[] | null>(null);

  useEffect(() => {
    let live = true;
    const cars = (all || !activeVehicle ? data.vehicles : data.vehicles.filter((v) => v.id === activeVehicle.id)).map((v) => ({ id: v.id, name: v.name, photoMediaId: null }));
    void loadRecapInput(cars, data.fillups).then((input) => {
      if (live) setPeriods(periodsWithData(input, todayIso()));
    });
    return () => {
      live = false;
    };
  }, [all, activeVehicle, data]);

  const label = (p: RecapPeriod) => (p.kind === 'month' ? monthTitle(p.year, p.month) : t.recap.list.year(p.year));
  const open = (p: RecapPeriod) => router.push({ pathname: '/resumen/[period]', params: { period: recapId(p), ...(all ? { scope: 'all' } : {}) } } as never);

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={{ padding: space.gutter, paddingBottom: 48 }}>
      <Stack.Screen options={{ headerShown: true, title: t.recap.list.title }} />
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {t.recap.list.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginBottom: space.md }}>
        {t.recap.list.intro}
      </T>
      {data.vehicles.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          {([false, true] as const).map((v) => (
            <Pressable key={String(v)} onPress={() => setAll(v)} accessibilityRole="button" accessibilityState={{ selected: all === v }} style={{ flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderColor: all === v ? theme.accent : theme.lineStrong, backgroundColor: all === v ? theme.bg.raised : theme.bg.surface }}>
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 13 }}>
                {v ? t.recap.scope.all : t.recap.scope.vehicle}
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {periods && !periods.length ? <EmptyState icon="stats-chart-outline" message={t.recap.list.empty} actionLabel={t.hoy.actions.fuel} onAction={() => router.push('/carga/nueva')} /> : null}
      {(periods ?? []).map((p) => {
        const now = new Date();
        const partial = p.kind === 'year' ? p.year === now.getFullYear() : p.year === now.getFullYear() && p.month === now.getMonth();
        return <StatusRow key={recapId(p)} label={label(p)} status={partial ? t.recap.list.soFar : undefined} icon={p.kind === 'year' ? 'calendar-outline' : 'stats-chart-outline'} onPress={() => open(p)} />;
      })}
    </ScrollView>
  );
}
