import type { Reminder, Vehicle, VehicleOwnership, VehicleStatus } from '../db/types';
import type { ReminderState, ReminderStatus } from './reminders';

/**
 * The garage's derived facts (IMP 28092026, 03-screens.md): badges, the
 * ownership line, the katakana nickname and which telltale lamps are lit.
 * All derived — there is no "badge" column (PROMPT-02 "watch for") — and pure,
 * so every rule here is tested rather than eyeballed.
 */

// ---------------------------------------------------------------- badges ---

export type DerivedBadge = { label: string; tone: 'red' | 'amber' | 'green' | 'outline' };

/** "4A-GE 20V" → "4AGE 20V": the way it is written on a cam cover. */
export function engineBadge(engineCode: string | null | undefined): DerivedBadge | null {
  const code = engineCode?.trim();
  if (!code) return null;
  return { label: code.replace(/-/g, '').toUpperCase().slice(0, 12), tone: 'red' };
}

const DISCIPLINES: Record<string, string> = {
  drift: 'DRIFT',
  track: 'TRACK',
  track_day: 'TRACK',
  drag: 'DRAG',
  autocross: 'AUTOCROSS',
  junte: 'JUNTE',
};

/** From the latest track event's discipline, else from mod tags ("drift", "track"…). */
export function disciplineBadge(opts: { lastDiscipline?: string | null; tags?: string[] }): DerivedBadge | null {
  const fromEvent = opts.lastDiscipline ? DISCIPLINES[opts.lastDiscipline] : undefined;
  const fromTags = (opts.tags ?? []).map((t) => DISCIPLINES[t.toLowerCase().trim()]).find(Boolean);
  const label = fromEvent ?? fromTags;
  return label ? { label, tone: 'amber' } : null;
}

/**
 * What the car *is* right now. Proyecto and Ex say so; an active car with no
 * installed mods is the DAILY — stock and driven — and a modified active car
 * lets its engine and discipline badges speak instead.
 */
export function statusBadge(status: VehicleStatus, installedMods: number): DerivedBadge | null {
  switch (status) {
    case 'proyecto':
      return { label: 'PROYECTO', tone: 'outline' };
    case 'vendido':
    case 'perdido':
      return { label: 'EX', tone: 'outline' };
    case 'guardado':
      return { label: 'GUARDADO', tone: 'outline' };
    default:
      return installedMods === 0 ? { label: 'DAILY', tone: 'amber' } : null;
  }
}

/** At most one badge per tone family on a card, red first (05-design-jdm.md: one badge per card on small cards). */
export function vehicleBadges(
  vehicle: Pick<Vehicle, 'status' | 'engineCode'>,
  facts: { installedMods: number; lastDiscipline?: string | null; tags?: string[] },
): DerivedBadge[] {
  const out: DerivedBadge[] = [];
  const engine = facts.installedMods > 0 ? engineBadge(vehicle.engineCode) : null;
  if (engine) out.push(engine);
  const discipline = disciplineBadge(facts);
  if (discipline) out.push(discipline);
  const status = statusBadge(vehicle.status, facts.installedMods);
  if (status) out.push(status);
  return out;
}

/** Status ⇔ is_archived, kept consistent until a later version drops is_archived. */
export function isArchivedFor(status: VehicleStatus): boolean {
  return status === 'guardado' || status === 'vendido' || status === 'perdido';
}

export function isEx(status: VehicleStatus): boolean {
  return status === 'vendido' || status === 'perdido';
}

// ------------------------------------------------------- ownership line ---

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/**
 * "Desde jun 2019 · 3 años contigo" for a car you have; "2018 → vendido 2021"
 * for an Ex. Year-only dates (stored as 1 January) print as the year alone.
 */
export function ownershipLine(
  own: Pick<VehicleOwnership, 'acquiredAt' | 'soldAt'> | null,
  today: Date = new Date(),
): string | null {
  if (!own?.acquiredAt && !own?.soldAt) return null;
  const acquired = own.acquiredAt ? new Date(own.acquiredAt) : null;
  if (own.soldAt) {
    const sold = new Date(own.soldAt);
    return acquired ? `${acquired.getUTCFullYear()} → vendido ${sold.getUTCFullYear()}` : `Vendido ${sold.getUTCFullYear()}`;
  }
  if (!acquired) return null;
  const yearOnly = acquired.getUTCMonth() === 0 && acquired.getUTCDate() === 1;
  const since = yearOnly ? String(acquired.getUTCFullYear()) : `${MONTHS[acquired.getUTCMonth()]} ${acquired.getUTCFullYear()}`;
  const months =
    (today.getFullYear() - acquired.getUTCFullYear()) * 12 + (today.getMonth() - acquired.getUTCMonth());
  const years = Math.floor(months / 12);
  const tenure =
    years >= 1 ? `${years} ${years === 1 ? 'año' : 'años'} contigo` : months >= 1 ? `${months} ${months === 1 ? 'mes' : 'meses'} contigo` : 'recién llegado';
  return `Desde ${since} · ${tenure}`;
}

// -------------------------------------------------------------- katakana ---

// Hepburn → katakana, enough for car nicknames (hachi-gō, hachiroku, sanpachi…).
const KANA: Record<string, string> = {
  kya: 'キャ', kyu: 'キュ', kyo: 'キョ', sha: 'シャ', shu: 'シュ', sho: 'ショ', cha: 'チャ', chu: 'チュ', cho: 'チョ',
  nya: 'ニャ', nyu: 'ニュ', nyo: 'ニョ', hya: 'ヒャ', hyu: 'ヒュ', hyo: 'ヒョ', rya: 'リャ', ryu: 'リュ', ryo: 'リョ',
  gya: 'ギャ', gyu: 'ギュ', gyo: 'ギョ', ja: 'ジャ', ju: 'ジュ', jo: 'ジョ', bya: 'ビャ', byu: 'ビュ', byo: 'ビョ',
  pya: 'ピャ', pyu: 'ピュ', pyo: 'ピョ', mya: 'ミャ', myu: 'ミュ', myo: 'ミョ',
  shi: 'シ', chi: 'チ', tsu: 'ツ', fu: 'フ', ji: 'ジ',
  ka: 'カ', ki: 'キ', ku: 'ク', ke: 'ケ', ko: 'コ', sa: 'サ', su: 'ス', se: 'セ', so: 'ソ',
  ta: 'タ', te: 'テ', to: 'ト', na: 'ナ', ni: 'ニ', nu: 'ヌ', ne: 'ネ', no: 'ノ',
  ha: 'ハ', hi: 'ヒ', he: 'ヘ', ho: 'ホ', ma: 'マ', mi: 'ミ', mu: 'ム', me: 'メ', mo: 'モ',
  ya: 'ヤ', yu: 'ユ', yo: 'ヨ', ra: 'ラ', ri: 'リ', ru: 'ル', re: 'レ', ro: 'ロ', wa: 'ワ', wo: 'ヲ',
  ga: 'ガ', gi: 'ギ', gu: 'グ', ge: 'ゲ', go: 'ゴ', za: 'ザ', zu: 'ズ', ze: 'ゼ', zo: 'ゾ',
  da: 'ダ', de: 'デ', do: 'ド', ba: 'バ', bi: 'ビ', bu: 'ブ', be: 'ベ', bo: 'ボ',
  pa: 'パ', pi: 'ピ', pu: 'プ', pe: 'ペ', po: 'ポ', a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ',
};
const LONG: Record<string, string> = { ā: 'a', ī: 'i', ū: 'u', ē: 'e', ō: 'o', â: 'a', ô: 'o', û: 'u' };

/**
 * The nickname in katakana when it *is* romanised Japanese ("hachi-gō" →
 * ハチゴー); null for anything else ("el daily"), so a Spanish nickname is never
 * mangled into fake Japanese. A macron is a long vowel (ー).
 */
export function toKatakana(nickname: string | null | undefined): string | null {
  if (!nickname) return null;
  let s = nickname.trim().toLowerCase().replace(/[\s-]+/g, '');
  if (!s || /[^a-zāīūēōâôû]/.test(s)) return null;
  let out = '';
  while (s.length) {
    const macron = LONG[s[0]];
    if (macron) {
      // A bare long vowel after a syllable: ー.
      out += out ? 'ー' : KANA[macron];
      s = s.slice(1);
      continue;
    }
    // Doubled consonant → small tsu (ッ); n before a consonant or at the end → ン.
    if (s.length > 1 && s[0] === s[1] && !'aeioun'.includes(s[0])) {
      out += 'ッ';
      s = s.slice(1);
      continue;
    }
    if (s[0] === 'n' && (s.length === 1 || !'aeiouy'.includes(s[1]))) {
      out += 'ン';
      s = s.slice(1);
      continue;
    }
    let matched = false;
    for (const len of [3, 2, 1]) {
      let head = s.slice(0, len);
      // A macron vowel ends the syllable: "gō" = "go" + ー.
      const last = head[head.length - 1];
      const long = LONG[last];
      if (long) head = head.slice(0, -1) + long;
      const kana = KANA[head];
      if (kana) {
        out += kana + (long ? 'ー' : '');
        s = s.slice(len);
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return out;
}

// ------------------------------------------------------------- telltales ---

export type LampSource = 'oil' | 'coolant' | 'tire' | 'battery' | 'document' | 'checklist';
export type LampState = 'off' | 'ok' | 'proximo' | 'urgente' | 'vencido';

/** The six lamps on Inicio, in cluster order, and which reminders light each. */
export const LAMP_SOURCES: { icon: LampSource; label: string; serviceTypes?: string[]; legal?: string[] }[] = [
  { icon: 'oil', label: 'Aceite', serviceTypes: ['aceite_motor'] },
  { icon: 'coolant', label: 'Refrigerante', serviceTypes: ['refrigerante', 'mangueras'] },
  { icon: 'tire', label: 'Gomas', serviceTypes: ['rotacion_gomas', 'cambio_gomas', 'alineacion', 'balanceo'] },
  { icon: 'battery', label: 'Batería', serviceTypes: ['bateria'] },
  { icon: 'document', label: 'Marbete y seguro', legal: ['marbete', 'seguro'] },
  { icon: 'checklist', label: 'Chequeo semanal' },
];

const RANK: Record<LampState, number> = { off: 0, ok: 1, proximo: 2, urgente: 3, vencido: 4 };

function fromReminder(state: ReminderState): LampState {
  return state === 'sin_datos' ? 'ok' : state;
}

/**
 * One state per lamp: the worst of its reminders; `off` when the car has none
 * of that kind. The weekly-check lamp reads the last weekly inspection: never
 * done or > 7 days → próximo, > 14 → urgente, last one with failures → urgente.
 */
export function lampStates(
  evaluated: { reminder: Pick<Reminder, 'serviceTypeId' | 'legalKind' | 'isEnabled'>; status: Pick<ReminderStatus, 'status' | 'snoozed'> }[],
  weekly: { lastAt: string | null; lastHadFailures: boolean } | null,
  today: Date = new Date(),
): { icon: LampSource; label: string; state: LampState }[] {
  return LAMP_SOURCES.map((source) => {
    if (source.icon === 'checklist') {
      return { icon: source.icon, label: source.label, state: weeklyState(weekly, today) };
    }
    let state: LampState = 'off';
    for (const { reminder, status } of evaluated) {
      if (reminder.isEnabled === false) continue;
      const hit =
        (reminder.serviceTypeId && source.serviceTypes?.includes(reminder.serviceTypeId)) ||
        (reminder.legalKind && source.legal?.includes(reminder.legalKind));
      if (!hit) continue;
      const s = status.snoozed ? 'ok' : fromReminder(status.status);
      if (RANK[s] > RANK[state]) state = s;
    }
    return { icon: source.icon, label: source.label, state };
  });
}

function weeklyState(weekly: { lastAt: string | null; lastHadFailures: boolean } | null, today: Date): LampState {
  if (!weekly) return 'off';
  if (!weekly.lastAt) return 'proximo';
  const days = (today.getTime() - new Date(weekly.lastAt).getTime()) / 86_400_000;
  if (weekly.lastHadFailures) return 'urgente';
  if (days > 14) return 'urgente';
  if (days > 7) return 'proximo';
  return 'ok';
}
