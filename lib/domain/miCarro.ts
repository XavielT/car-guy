/**
 * Mi carro (SPEC-K §K2): the tone of a one-line status. Pure. A date that has passed is red, one within 14 days is amber, a missing
 * date is just quiet text, never an alarm.
 */
export type RowTone = 'ok' | 'proximo' | 'vencido' | 'neutral';

export function expiryTone(daysLeft: number | null): RowTone {
  if (daysLeft == null) return 'neutral';
  if (daysLeft < 0) return 'vencido';
  if (daysLeft <= 14) return 'proximo';
  return 'ok';
}

/** "hace 12 días" parts for a past date: today / yesterday / n days / n months, so the screen words it once, in the dictionary. */
export function agoParts(days: number | null): { unit: 'today' | 'yesterday' | 'days' | 'months'; n: number } | null {
  if (days == null || days < 0) return null;
  if (days === 0) return { unit: 'today', n: 0 };
  if (days === 1) return { unit: 'yesterday', n: 1 };
  if (days < 60) return { unit: 'days', n: days };
  return { unit: 'months', n: Math.round(days / 30) };
}
