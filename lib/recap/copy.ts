/**
 * Words for a recap card (SPEC-J §J0): templated, es/en, no AI. One function turns a card (the full one the viewer shows, or the reduced one a
 * share image is drawn from) into what is printed and what a screen reader says. It only ever reads fields that exist on the SHARE card, plus
 * optional extras, so the same renderer serves both and cannot print what the share model dropped.
 */
import { dateLabel, km as fmtKm, money, monthTitle } from '../format';
import { t } from '../i18n';
import type { Recap, RecapCard, RecapPeriod } from '../domain/recap';
import type { ShareCard } from '../domain/recapShare';
import type { Delta } from '../domain/stats';

export type AnyCard = RecapCard | ShareCard;
export type CardText = {
  eyebrow: string;
  /** The big numeral or phrase, and what it is. */
  big: string;
  caption: string;
  lines: string[];
  /** The whole thing as one sentence, for screen readers. */
  sentence: string;
  /** Tone of the accent (`delta` cards colour nothing by good/bad: neutral). */
  bars?: { label: string; value: number }[];
};

const monthName = (year: number, month: number) => monthTitle(year, month).split(' ')[0].toLowerCase();

export function periodWord(p: RecapPeriod): string {
  return p.kind === 'month' ? monthName(p.year, p.month) : String(p.year);
}

const deltaText = (d: Delta | null | undefined): string | null => {
  if (!d) return null;
  const pct = Math.round(Math.abs(d.percent ?? 0));
  if (d.percent == null || pct === 0) return t.recap.compare.same;
  return d.percent > 0 ? t.recap.compare.up(pct) : t.recap.compare.down(pct);
};

export function cardText(card: AnyCard, period: RecapPeriod): CardText {
  const what = period.kind === 'month' ? monthName(period.year, period.month) : t.recap.eyebrow.year.toLowerCase().replace('tu ', '');
  switch (card.kind) {
    case 'cover': {
      const car = card.vehicleNames.join(', ');
      const yearWhat = period.kind === 'year' ? String(period.year) : what;
      return {
        eyebrow: period.kind === 'month' ? t.recap.eyebrow.month : t.recap.eyebrow.year,
        big: card.headlineKm != null ? fmtKm(card.headlineKm) : t.recap.cover.noKm,
        caption: card.headlineKm != null ? t.recap.cover.km : '',
        lines: [period.kind === 'month' ? monthTitle(period.year, period.month) : String(period.year), ...(car ? [car] : [])],
        sentence: t.recap.cover.sentence(yearWhat, card.headlineKm ?? 0, car),
      };
    }
    case 'distance': {
      const lines = [t.recap.distance.trips(card.trips), t.recap.distance.hours(card.hours)];
      if (card.longestTripKm != null) lines.push(t.recap.distance.longest(`${card.longestTripKm} km`, 'longestTripDate' in card && card.longestTripDate ? dateLabel(card.longestTripDate) : '').replace(' ()', ''));
      if ('busiestDay' in card && card.busiestDay) lines.push(t.recap.distance.busiest(card.busiestDay));
      return { eyebrow: t.recap.distance.eyebrow, big: fmtKm(card.km), caption: t.recap.cover.km, lines: card.trips > 0 ? lines : [], sentence: t.recap.distance.sentence(card.km, card.trips) };
    }
    case 'speed':
      return {
        eyebrow: t.recap.speed.eyebrow,
        big: `${card.topKmh} km/h`,
        caption: t.recap.speed.top,
        lines: [...(card.avgMovingKmh != null ? [t.recap.speed.avg(card.avgMovingKmh)] : []), ...('topDate' in card && card.topDate ? [t.recap.speed.on(dateLabel(card.topDate))] : [])],
        sentence: t.recap.speed.sentence(card.topKmh),
      };
    case 'fuel': {
      const vol = `${card.volume} gal`;
      const eff = card.efficiency != null ? `${card.efficiency} km/gal` : null;
      const lines: string[] = [];
      if ('spend' in card && card.spend != null) lines.push(t.recap.fuel.spent(money(card.spend)));
      if ('avgPrice' in card && card.avgPrice != null) lines.push(t.recap.fuel.price(money(card.avgPrice)));
      if (eff == null) lines.push(t.recap.fuel.needTwo);
      return { eyebrow: t.recap.fuel.eyebrow, big: eff ?? vol, caption: eff ? t.recap.fuel.eff : '', lines: eff ? [vol, ...lines] : lines, sentence: t.recap.fuel.sentence(vol, eff) };
    }
    case 'cost': {
      const lines: string[] = [];
      if (card.costPerKm != null) lines.push(t.recap.cost.perKm(money(card.costPerKm)));
      if ('biggest' in card && card.biggest) lines.push(t.recap.cost.biggest(money(card.biggest.amount)));
      return { eyebrow: t.recap.cost.eyebrow, big: money(card.total), caption: '', lines, sentence: t.recap.cost.sentence(money(card.total)) };
    }
    case 'care': {
      const lines = [t.recap.care.services(card.services), t.recap.care.repairs(card.repairs)];
      if ('overdueNow' in card && card.overdueNow > 0) lines.push(t.recap.care.overdue(card.overdueNow));
      if ('docsExpiring' in card && card.docsExpiring > 0) lines.push(t.recap.care.docs(card.docsExpiring));
      return { eyebrow: t.recap.care.eyebrow, big: String(card.services + card.repairs), caption: '', lines, sentence: t.recap.care.sentence(card.services, card.repairs) };
    }
    case 'build':
      return { eyebrow: t.recap.build.eyebrow, big: String(card.mods), caption: t.recap.build.mods(card.mods).replace(/^\d+ /, ''), lines: 'invested' in card && card.invested != null ? [t.recap.build.invested(money(card.invested))] : [], sentence: t.recap.build.sentence(card.mods) };
    case 'compare': {
      const rows: [string, string | null][] = [
        [t.recap.compare.km, deltaText(card.deltas.km)],
        [t.recap.compare.spend, 'spend' in card.deltas ? deltaText(card.deltas.spend) : null],
        [t.recap.compare.eff, deltaText(card.deltas.efficiency)],
      ];
      return { eyebrow: t.recap.compare.eyebrow, big: card.previousLabel, caption: '', lines: rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), sentence: t.recap.compare.sentence };
    }
    case 'months': {
      const bars = card.months.map((m) => ({ label: monthName(period.kind === 'year' ? period.year : 2000, m.month).slice(0, 3), value: m.km }));
      const best = [...card.months].sort((a, b) => b.km - a.km)[0];
      const bestName = best ? monthName(period.kind === 'year' ? period.year : 2000, best.month) : '';
      return { eyebrow: t.recap.months.eyebrow, big: best ? fmtKm(best.km) : '', caption: bestName, lines: [], bars, sentence: t.recap.months.sentence(bestName) };
    }
    case 'odometer':
      return { eyebrow: t.recap.odometer.eyebrow, big: fmtKm(card.km), caption: '', lines: [`${t.recap.odometer.from} ${fmtKm(card.startKm)} ${t.recap.odometer.to} ${fmtKm(card.endKm)}`], sentence: t.recap.odometer.sentence(card.km) };
    case 'garage': {
      const cars = card.cars;
      const most = cars[0]?.name ?? null;
      return { eyebrow: t.recap.garage.eyebrow, big: String(cars.length), caption: '', lines: cars.map((c) => `${c.name ?? '—'}: ${fmtKm(c.km)}`), sentence: t.recap.garage.sentence(cars.length), ...(most ? { caption: t.recap.garage.most(most) } : {}) };
    }
    case 'closer': {
      const h = card.highlight;
      const big = !h ? t.recap.closer.line : h.kind === 'km' ? t.recap.closer.km(h.value) : h.kind === 'trips' ? t.recap.closer.trips(h.value) : t.recap.closer.top(h.value);
      return { eyebrow: t.recap.closer.eyebrow, big, caption: '', lines: [t.recap.closer.line], sentence: t.recap.closer.sentence(big) };
    }
  }
}

export const recapTitle = (r: Pick<Recap, 'period'>): string => (r.period.kind === 'month' ? monthTitle(r.period.year, r.period.month) : t.recap.list.year(r.period.year));
