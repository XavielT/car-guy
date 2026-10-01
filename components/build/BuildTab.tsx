import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Badge, GhostButton, PrimaryButton } from '@/components/ui';
import { Hanko } from '@/components/ui/Hanko';
import { radius, space } from '@/constants/theme';
import { buildData, type BuildData } from '@/lib/db/buildQueries';
import { jsonObject } from '@/lib/domain/album';
import { currentSpecs, investedTotal, modBadge, parseTags } from '@/lib/domain/build';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { StockActualCard } from './StockActualCard';

function whole(n: number): string {
  return money(Math.round(n)).replace(/\.00$/, '');
}

function useBuild(vehicleId: string, version: number): BuildData | null {
  const { data } = useStore();
  const [build, setBuild] = useState<BuildData | null>(null);
  useEffect(() => {
    let cancelled = false;
    void buildData(vehicleId).then((b) => !cancelled && setBuild(b));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version, data]);
  return build;
}

/** The hub's Build tab: STOCK → ACTUAL, the money, and the way into the full build. */
export function BuildTab({ vehicleId, version }: { vehicleId: string; version: number }) {
  const router = useRouter();
  const build = useBuild(vehicleId, version);
  if (!build) return null;
  const current = currentSpecs(jsonObject(build.sheet?.stock), build.mods, jsonObject(build.sheet?.overrides));
  const open = (tab?: string) => router.push({ pathname: '/vehiculo/[id]/build', params: { id: vehicleId, ...(tab ? { tab } : {}) } });
  return (
    <View style={{ gap: space.sm }}>
      {/* 改 = modificado: the seal lives with the build it describes (note 9). */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Hanko char="改" size={28} accessibilityLabel={t.build.seal} />
      </View>
      <BuildSummary vehicleId={vehicleId} version={version} build={build} />
      <StockActualCard current={current} onPress={() => open('specs')} />
      <PrimaryButton label={t.build.open} onPress={() => open()} />
      <GhostButton label={t.build.add} onPress={() => router.push({ pathname: '/mod/nuevo', params: { vehicleId } })} />
    </View>
  );
}

/**
 * "5 mods · RD$ 120 000 invertido" and the build's top three badges — on the
 * hub's Resumen, so the build shows even before anyone opens its tab.
 */
export function BuildSummary({ vehicleId, version, build: given }: { vehicleId: string; version: number; build?: BuildData | null }) {
  const router = useRouter();
  const { theme } = useTheme();
  const fetched = useBuild(vehicleId, version);
  const build = given ?? fetched;
  if (!build || !build.mods.length) return null;
  const installed = build.mods.filter((m) => m.status === 'instalado');
  const badges = [...new Map(installed.map((m) => modBadge(parseTags(m.tags))).filter((b): b is NonNullable<typeof b> => Boolean(b)).map((b) => [b.label, b])).values()].slice(0, 3);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/vehiculo/[id]/build', params: { id: vehicleId } })}
      accessibilityRole="button"
      accessibilityLabel={t.build.summary(installed.length, whole(investedTotal(build.mods)))}
      style={[styles.summary, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <T face="mono" style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
        {t.build.summary(installed.length, whole(investedTotal(build.mods)))}
      </T>
      {badges.map((b) => (
        <Badge key={b.label} label={b.label} tone={b.tone} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.button, paddingVertical: 10, paddingHorizontal: space.md, marginBottom: space.md },
});
