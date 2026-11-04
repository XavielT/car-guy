import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { AiError } from '@/lib/ai/codes';
import { setAiDraft } from '@/lib/ai/draft';
import { askIntent } from '@/lib/ai/intent';
import { intentToRoute, needsVehicleChoice, type IntentResult } from '@/lib/ai/intentRoute';
import { currentOdometer } from '@/lib/db/repos';
import { recordReportable } from '@/lib/diagnostics';
import { answerQuery, queryPlan, type QueryAnswer, type QueryPlan } from '@/lib/domain/smartQuery';
import { FEATURES, featureHref } from '@/lib/features/registry';
import { FEATURE_AI_SEARCH } from '@/lib/flagsAi';
import { dateLabel, money, todayIsoDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { useAiGate } from './useAiGate';
import { VoiceButton } from './VoiceButton';

/** Typed text that is a sentence rather than a feature word: three words or more, or nothing matched at all. */
export const looksLikeQuestion = (text: string, matches: number) => text.trim().length >= 3 && (matches === 0 || text.trim().split(/\s+/).length >= 3);

/**
 * Smart search in Herramientas (SPEC-G §G1). Not a chatbot: ONE sentence → `cg-ai-intent` → either
 *  - an ANSWER CARD ("how much / when / how many"): the number or date is computed here from the person's own records (the model only
 *    classified the question), shown with the question restated and a link to the screen where it lives; or
 *  - the same navigation / pre-filled form the dictation sheet opens (closed list of targets, nothing saved).
 * The microphone fills the search box with an editable transcript first.
 */
export function SmartSearch({ query, matches, onQuery }: { query: string; matches: number; onQuery: (q: string) => void }) {
  const { theme } = useTheme();
  const router = useRouter();
  const { ready, sheet } = useAiGate();
  const { data, activeVehicle, setActiveVehicle } = useStore();
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<IntentResult | null>(null);
  const [card, setCard] = useState<{ answer: QueryAnswer; plan: QueryPlan; question: string } | null>(null);
  const [fromVoice, setFromVoice] = useState(false);

  if (!FEATURE_AI_SEARCH) return null;
  const x = t.ai.search;
  const show = looksLikeQuestion(query, matches);

  function answerFor(result: IntentResult, vehicleId: string | null) {
    const target = vehicleId ?? activeVehicle?.id ?? null;
    if (!target) return;
    const plan = queryPlan(result.fields);
    if (!plan) return Alert.alert(t.ai.consent.title, t.ai.voice.notUnderstood);
    const mine = data.expenses.filter((e) => e.vehicleId === target);
    const answer = answerQuery(plan, {
      vehicleId: target,
      today: todayIsoDate(),
      fuel: data.fillups.map((f) => ({ vehicleId: f.vehicleId, occurredAt: f.occurredAt, amount: f.totalDop })),
      expenses: data.expenses.map((e) => ({ vehicleId: e.vehicleId, occurredAt: e.occurredAt, amount: e.amountDop })),
      services: mine.filter((e) => e.category === 'maintenance' || e.category === 'repair').map((e) => ({ vehicleId: e.vehicleId, occurredAt: e.occurredAt, odometerKm: e.odometerKm, title: e.description })),
      reminders: data.reminders.map((r) => ({ vehicleId: r.vehicleId, title: r.title, dueDate: r.dueDate, dueOdometerKm: r.dueOdometerKm, completedAt: r.completedAt })),
    });
    if (target !== activeVehicle?.id) setActiveVehicle(target);
    setChoice(null);
    setCard({ answer, plan, question: query.trim() });
  }

  function open(result: IntentResult, vehicleId: string | null) {
    if (result.target === 'query') return answerFor(result, vehicleId);
    const target = vehicleId ?? activeVehicle?.id ?? null;
    const detail = data.vehicles.find((v) => v.id === target)?.detail;
    const route = intentToRoute(result, {
      volumeUnit: detail?.volumeUnit ?? 'gal',
      featureHref: (id) => {
        const def = FEATURES.find((f) => f.id === id);
        return def ? featureHref(def, target) : null;
      },
    });
    if (!route) return Alert.alert(t.ai.consent.title, t.ai.voice.notUnderstood);
    if (target && target !== activeVehicle?.id) setActiveVehicle(target);
    if (route.draft) setAiDraft({ form: route.draft.form, prefill: route.draft.prefill, marks: route.draft.marks, photos: [], source: fromVoice ? 'voice' : 'text', vehicleId: target });
    router.push({ pathname: route.pathname as never, params: route.params as never });
  }

  async function understand() {
    const sentence = query.trim();
    if (!sentence || busy || !ready()) return;
    setBusy(true);
    setCard(null);
    try {
      const lastOdometer = activeVehicle ? await currentOdometer(activeVehicle.id).catch(() => null) : null;
      const result = await askIntent(sentence, {
        vehicles: data.vehicles.filter((v) => !v.isArchived).map((v) => ({ id: v.id, name: v.name })),
        today: todayIsoDate(),
        lastOdometer,
        fuelType: null,
        features: FEATURES.map((f) => f.id),
      });
      if (needsVehicleChoice(result)) return setChoice(result);
      open(result, result.vehicle?.id ?? null);
    } catch (e) {
      if (e instanceof AiError) Alert.alert(t.ai.consent.title, e.code === 'unreadable' ? t.ai.voice.notUnderstood : t.ai.errors[e.code]);
      else {
        recordReportable('ai-search', e);
        Alert.alert(t.ai.consent.title, t.ai.errors.internal);
      }
    } finally {
      setBusy(false);
    }
  }

  const period = (p: QueryPlan) => (p.from && p.to ? `${dateLabel(`${p.from}T12:00:00Z`)} – ${dateLabel(`${p.to}T12:00:00Z`)}` : x.allTime);
  const sentence = (a: QueryAnswer, p: QueryPlan): { big: string; line: string } => {
    switch (a.kind) {
      case 'fuel_spend':
      case 'total_spend':
        return { big: money(a.amount), line: x.spendLine(a.kind === 'fuel_spend' ? x.fuelWord : x.totalWord, period(p), a.count) };
      case 'last_service':
        return a.found ? { big: dateLabel(`${a.found.date}T12:00:00Z`), line: x.lastLine(a.found.title, a.found.km) } : { big: '—', line: x.noneLast(a.keyword) };
      case 'next_due':
        if (!a.found) return { big: '—', line: x.noneDue(a.keyword) };
        return a.found.dueDate
          ? { big: dateLabel(`${a.found.dueDate}T12:00:00Z`), line: x.dueLine(a.found.title, a.found.daysLeft ?? 0) }
          : { big: `${Math.round(a.found.dueKm ?? 0).toLocaleString('es-DO')} km`, line: x.dueKmLine(a.found.title) };
      case 'show_repairs':
        return { big: '', line: '' };
    }
  };

  function go(a: QueryAnswer) {
    const id = activeVehicle?.id ?? '';
    const path = a.link === 'cifras' ? '/cifras' : a.link === 'historial' ? '/(tabs)/historial' : a.link === 'recordatorios' ? '/recordatorios' : `/vehiculo/${id}/reparaciones`;
    router.push(path as never);
  }

  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      <VoiceButton
        disabled={busy}
        onTranscript={(spoken) => {
          onQuery(spoken);
          setFromVoice(true);
        }}
      />
      {show ? (
        <Surface padded>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.title}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 2 }}>
            {matches === 0 ? x.hintNone : x.hintSentence}
          </T>
          {choice ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
              {(choice.choices ?? []).map((c) => (
                <Pressable key={c.id} onPress={() => open(choice, c.id)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.accent, borderRadius: radius.chip, paddingHorizontal: space.md, backgroundColor: theme.bg.raised }}>
                  <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
                    {c.name}
                  </T>
                </Pressable>
              ))}
            </View>
          ) : (
            <PrimaryButton label={busy ? x.working : x.ask} onPress={() => void understand()} disabled={busy} />
          )}
        </Surface>
      ) : null}

      {card ? (
        <Surface padded>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.answerTitle}
          </T>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, marginTop: 2 }}>
            {x.understood(card.question)}
          </T>
          {card.answer.kind === 'show_repairs' ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginTop: space.xs }}>
              {x.repairsLine(card.answer.keyword)}
            </T>
          ) : (
            (() => {
              const s = sentence(card.answer, card.plan);
              return (
                <View accessibilityLiveRegion="polite" style={{ marginTop: space.xs }}>
                  <T face="display" style={{ color: theme.text.primary, fontSize: 30 }}>
                    {s.big}
                  </T>
                  <T face="body" style={{ color: theme.text.secondary, fontSize: 14 }}>
                    {s.line}
                  </T>
                </View>
              );
            })()
          )}
          <GhostButton label={x.links[card.answer.link]} onPress={() => go(card.answer)} />
          <T face="body" style={{ color: theme.text.muted, fontSize: 11 }}>
            {x.computed}
          </T>
        </Surface>
      ) : null}
      {sheet}
    </View>
  );
}
