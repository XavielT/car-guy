import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { askInsights, actionFor, actionRoute, baseInsights, CARD_LIMIT, dismissedFor, dismissInsight, mergeAi, readCachedInsights, saveCachedInsights, withoutDismissed, type InsightsAnswer } from '@/lib/ai/insights';
import { useAiStatus } from '@/lib/ai/useAiStatus';
import { loadFacts, type CarFacts } from '@/lib/db/predictQueries';
import type { FactAction } from '@/lib/domain/predict';
import { currentLanguage, t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import type { FillUp, Vehicle } from '@/lib/types';

const ACTION_LABEL: Record<FactAction['type'], () => string> = {
  open_reminder: () => t.ai.health.actions.open_reminder,
  open_fillup: () => t.ai.health.actions.open_fillup,
  new_service: () => t.ai.health.actions.new_service,
  new_reminder: () => t.ai.health.actions.new_reminder,
  open_tires: () => t.ai.health.actions.open_tires,
  open_costs: () => t.ai.health.actions.open_costs,
  open_obd: () => t.ai.health.actions.open_obd,
};

/**
 * Car Health (IMP 03112026 SPEC-E §E2/§E3, ADR-68): what the engine knows about this car right now, in a few plain lines.
 * The facts are computed on the device, so the card is right offline and without AI; each one already has a deterministic sentence.
 * When AI is available and the car CHANGED since the last time, the model rewords them (the server checks every number against the
 * facts, and an unchanged car is answered from the cache at no cost). Tapping an action opens the normal screen; nothing is written.
 * Dismissing hides an insight for this state of the car; if the car changes it may come back.
 */
export function CarHealth({ vehicle, fillups, limit = CARD_LIMIT, showEmpty = false }: { vehicle: Vehicle; fillups: FillUp[]; limit?: number; showEmpty?: boolean }) {
  const { theme } = useTheme();
  const router = useRouter();
  const ai = useAiStatus();
  const [car, setCar] = useState<CarFacts | null>(null);
  const [answer, setAnswer] = useState<InsightsAnswer | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const asked = useRef<string | null>(null);

  const vehicleId = vehicle.id;
  const fillCount = fillups.length;

  // The facts, from this device's data (re-read when the car's records change).
  useEffect(() => {
    let live = true;
    void loadFacts(vehicle, fillups)
      .then(async (r) => {
        const gone = await dismissedFor(vehicleId, r.hash);
        if (live) {
          setCar(r);
          setDismissed(gone);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // `vehicle` and `fillups` change identity on every store refresh; the ids and the count are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, fillCount, vehicle.detail?.updatedAt]);

  // The AI wording: only when it is available, only for a facts-hash not asked before, cached by that hash.
  const hash = car?.hash ?? null;
  const factList = car?.facts;
  const aiReady = ai.state === 'available';
  useEffect(() => {
    if (!aiReady || !hash || !factList?.length || asked.current === hash) return;
    asked.current = hash;
    let live = true;
    void (async () => {
      const cached = await readCachedInsights(vehicleId, hash);
      if (cached) return live && setAnswer(cached);
      const fresh = await askInsights(factList, vehicle.name, currentLanguage() === 'en' ? 'en' : 'es');
      if (live) setAnswer(fresh);
      void saveCachedInsights(vehicleId, hash, fresh);
    })().catch(() => {
      // Offline, a cap, a switched-off AI: the deterministic sentences are already on screen.
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiReady, hash, vehicleId]);

  if (!car) return null;
  const lang = currentLanguage() === 'en' ? 'en' : 'es';
  const merged = mergeAi(baseInsights(car.facts, lang), answer, car.facts);
  const shown = withoutDismissed(merged, dismissed).slice(0, limit);
  if (!shown.length) {
    return showEmpty ? (
      <Surface style={{ marginBottom: space.md }}>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
          {t.ai.health.title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginTop: 2 }}>
          {t.ai.health.allGood}
        </T>
      </Surface>
    ) : null;
  }
  const tone = (s: 'info' | 'watch' | 'act') => (s === 'act' ? theme.statusText.vencido : s === 'watch' ? theme.statusText.proximo : theme.text.muted);

  return (
    <Surface style={{ marginBottom: space.md }}>
      <T face="eyebrow" accessibilityRole="header" style={{ color: theme.text.muted, fontSize: 11 }}>
        {t.ai.health.title}
      </T>
      {shown.map((i) => {
        const action = actionFor(i, car.facts) ?? (i.action as FactAction | null);
        const route = actionRoute(action);
        return (
          <View key={i.id} style={[styles.item, { borderLeftColor: tone(i.severity) }]}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 20 }}>
              {i.headline}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
              {i.why}
            </T>
            <View style={styles.row}>
              {route && action ? (
                <Pressable onPress={() => router.push(route as never)} accessibilityRole="button" style={styles.btn}>
                  <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
                    {ACTION_LABEL[action.type]()}
                  </T>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  setDismissed((d) => [...d, i.id]);
                  void dismissInsight(vehicleId, car.hash, i.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={t.ai.health.dismiss}
                style={styles.btn}>
                <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
                  {t.ai.health.dismiss}
                </T>
              </Pressable>
            </View>
          </View>
        );
      })}
      {shown.some((i) => i.source === 'ai') ? (
        <T face="body" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.sm }}>
          {t.ai.health.aiNote}
        </T>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  item: { borderLeftWidth: 3, paddingLeft: space.md, marginTop: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: 2 },
  btn: { minHeight: 44, justifyContent: 'center', borderRadius: radius.chip },
});
