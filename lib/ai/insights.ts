/**
 * Car Health, the client side (IMP 03112026 SPEC-E §E2/§E3, PROMPT-05 step 3). The facts are computed ON THIS DEVICE by the pure
 * engine, so the card is right offline and for someone who never turned AI on: each fact already has a deterministic sentence
 * (`templateFor`, the same one the server falls back to). The AI layer only rewords: when it is available, an unchanged car costs
 * nothing (the answer is cached by the facts' hash), and every number in its text was checked by the server against the facts.
 *
 *   · `baseInsights`    facts → insights with the deterministic sentences (no AI, no network)
 *   · `askInsights`     cg-ai-insights → the same shape with the model's wording where it passed validation
 *   · dismissals        kept LOCALLY (settings), per car and per facts-hash: a dismissed insight does not return for the same
 *                       hash, and works with no connection and no SQL
 *   · `actionRoute`     a fact's action from the CLOSED list → a screen to open. Nothing is ever written by tapping one.
 */
import { settings } from '../db/repos';
import type { Fact, FactAction } from '../domain/predict';
import { insightId, templateFor, type Insight, type InsightsAnswer } from '../../supabase/functions/cg-ai-insights/insights';
import { callAi } from './client';
import { getSupabase } from '../cloud/supabase';

export type { Insight, InsightsAnswer };

const RANK = { act: 0, watch: 1, info: 2 } as const;
export const CARD_LIMIT = 3;
export const MAX_ASKED = 30;

/** Facts → one insight each with the deterministic sentence, most urgent first. Pure. */
export function baseInsights(facts: readonly Fact[], lang: 'es' | 'en'): Insight[] {
  return [...facts]
    .sort((a, b) => RANK[a.severity] - RANK[b.severity])
    .map((f) => {
      const t = templateFor(f as never, lang);
      return { id: insightId([f.id]), headline: t.headline, why: t.why, fact_ids: [f.id], severity: f.severity, action: (f.actions[0] ?? null) as Insight['action'], source: 'template' as const };
    });
}

/** The action offered by the cited facts, never the model's: used to re-attach an action to an insight the app already has. */
export function actionFor(insight: Insight, facts: readonly Fact[]): FactAction | null {
  const type = insight.action?.type;
  if (!type) return null;
  return facts.filter((f) => insight.fact_ids.includes(f.id)).flatMap((f) => f.actions).find((a) => a.type === type) ?? null;
}

// ───────────────────────── dismissals (local) ─────────────────────────

const key = (vehicleId: string) => `ai_insights_dismissed:${vehicleId}`;
type Dismissed = { hash: string; ids: string[] };

export async function dismissedFor(vehicleId: string, hash: string): Promise<string[]> {
  const raw = await settings.get<Dismissed | null>(key(vehicleId), null).catch(() => null);
  return raw && raw.hash === hash && Array.isArray(raw.ids) ? raw.ids : [];
}

/** Dismiss one insight for THIS facts-hash. A changed car (a new hash) starts clean: the world moved on. */
export async function dismissInsight(vehicleId: string, hash: string, insightIdValue: string): Promise<void> {
  const cur = await dismissedFor(vehicleId, hash);
  if (cur.includes(insightIdValue)) return;
  await settings.set(key(vehicleId), { hash, ids: [...cur, insightIdValue] });
}

export const withoutDismissed = (list: readonly Insight[], dismissed: readonly string[]): Insight[] => list.filter((i) => !dismissed.includes(i.id));

// ───────────────────────── routes for the closed list of actions ─────────────────────────

export type ActionRoute = { pathname: string; params?: Record<string, string> } | null;

export function actionRoute(a: FactAction | null | undefined): ActionRoute {
  if (!a) return null;
  switch (a.type) {
    case 'open_reminder': return { pathname: '/recordatorio/[id]', params: { id: String(a.reminderId) } };
    case 'open_fillup': return { pathname: '/carga/[id]', params: { id: String(a.fillupId) } };
    case 'new_service': return { pathname: '/servicio/nuevo' };
    case 'new_reminder': return { pathname: '/recordatorio/nuevo' };
    case 'open_tires': return { pathname: '/gomas' };
    case 'open_costs': return { pathname: '/cifras' };
    case 'open_obd': return { pathname: '/obd' };
  }
}

// ───────────────────────── the AI layer ─────────────────────────

export async function askInsights(facts: readonly Fact[], vehicleLabel: string, lang: 'es' | 'en'): Promise<InsightsAnswer> {
  return callAi<InsightsAnswer>('cg-ai-insights', { vehicleLabel, lang, facts: facts.slice(0, MAX_ASKED) });
}

type Insights = { select(c: string): Query; upsert(row: unknown, o?: unknown): Promise<{ error: unknown }> };
type Query = { eq(c: string, v: unknown): Query; maybeSingle(): Promise<{ data: unknown; error: unknown }> };
const table = (): Insights | null => {
  const s = getSupabase();
  return s ? (s as unknown as { from(t: string): Insights }).from('ai_insights') : null;
};

/** The stored AI wording for this car + facts-hash, or null (no account, offline, nothing stored). Never throws. */
export async function readCachedInsights(vehicleId: string, hash: string): Promise<InsightsAnswer | null> {
  try {
    const t = table();
    if (!t) return null;
    const { data, error } = await t.select('payload').eq('vehicle_id', vehicleId).eq('kind', 'insight').eq('input_hash', hash).maybeSingle();
    const p = (data as { payload?: InsightsAnswer } | null)?.payload;
    return !error && p && Array.isArray(p.insights) ? p : null;
  } catch {
    return null;
  }
}

export async function saveCachedInsights(vehicleId: string, hash: string, answer: InsightsAnswer): Promise<boolean> {
  try {
    const t = table();
    if (!t) return false;
    const { error } = await t.upsert({ vehicle_id: vehicleId, kind: 'insight', input_hash: hash, payload: answer, status: 'new' }, { onConflict: 'user_id,vehicle_id,kind,input_hash' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * The AI's wording laid over the deterministic insights: an AI insight REPLACES the template ones for the same facts; the rest
 * stay as they are, so a partial answer never hides a fact. Actions are re-taken from the facts.
 */
export function mergeAi(base: readonly Insight[], ai: InsightsAnswer | null, facts: readonly Fact[]): Insight[] {
  if (!ai?.insights.length) return [...base];
  const covered = new Set(ai.insights.flatMap((i) => i.fact_ids));
  const fromAi = ai.insights.map((i) => ({ ...i, action: actionFor(i, facts) as Insight['action'] }));
  const rest = base.filter((b) => !b.fact_ids.every((id) => covered.has(id)));
  return [...fromAi, ...rest].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
