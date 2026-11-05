jest.mock('@/lib/db/repos', () => ({ settings: { get: async (_k: string, d: unknown) => d, set: async () => undefined } }));
jest.mock('@/lib/trips/engine', () => ({ feed: jest.fn(), tick: jest.fn() }));
jest.mock('@/modules/trip-trigger', () => ({}));
jest.mock('../../modules/trip-trigger', () => ({
  tripTriggerAvailable: false,
  armTripTrigger: jest.fn(),
  disarmTripTrigger: jest.fn(),
  hasActivityPermission: jest.fn(),
  holdNativeForJs: jest.fn(),
  isNativeRecording: jest.fn(),
  stopNativeRecorder: jest.fn(),
  drainNativeSessions: jest.fn(() => []),
  ackNativeSession: jest.fn(),
  nativeEvents: jest.fn(() => []),
  clearNativeEvents: jest.fn(),
}));

import { CHUNK, chunks, parseSession } from '@/lib/trips/nativeTrigger';
import { summarize, type TimelineEntry } from '@/lib/trips/timeline';

const line = (t: number, extra: Record<string, unknown> = {}) => JSON.stringify({ t, la: 18.4861, lo: -69.9312, ac: 6.5, sp: 12.3, br: 90, al: 20, ...extra });

describe('native trigger session parsing (PROMPT-09)', () => {
  it('turns recorded lines into fixes, oldest first', () => {
    const text = [line(3000), line(1000), line(2000)].join('\n');
    const fixes = parseSession(text);
    expect(fixes.map((f) => f.t)).toEqual([1000, 2000, 3000]);
    expect(fixes[0]).toMatchObject({ lat: 18.4861, lng: -69.9312, speed: 12.3, acc: 6.5, heading: 90, alt: 20 });
  });

  it('skips a half-written last line, blank lines and anything without a position', () => {
    const text = [line(1000), '', '{"t":2000,"la":18.4', line(3000, { la: null }), line(4000)].join('\n');
    expect(parseSession(text).map((f) => f.t)).toEqual([1000, 4000]);
  });

  it('null speed / accuracy stay null (an unknown is not a zero)', () => {
    const [f] = parseSession(line(1000, { sp: null, ac: null, br: null, al: null }));
    expect(f.speed).toBeNull();
    expect(f.acc).toBeNull();
    expect(f.heading).toBeNull();
  });

  it('drops what was already ingested (t <= afterT) so a re-offered file does not duplicate a trip', () => {
    const text = [line(1000), line(2000), line(3000)].join('\n');
    expect(parseSession(text, 2000).map((f) => f.t)).toEqual([3000]);
  });

  it('chunks a long drive for the machine', () => {
    const list = Array.from({ length: CHUNK * 2 + 5 }, (_, i) => i);
    expect(chunks(list).map((c) => c.length)).toEqual([CHUNK, CHUNK, 5]);
    expect(chunks([])).toEqual([]);
  });
});

describe('the journal says what the native trigger did', () => {
  it('counts events and keeps the failure reason (the answer to "why did it not start")', () => {
    const t = Date.UTC(2026, 10, 6, 8);
    const list: TimelineEntry[] = [
      { at: t, kind: 'native', event: 'vehicle-enter' },
      { at: t + 1, kind: 'native', event: 'start-failed', detail: 'ForegroundServiceStartNotAllowedException' },
      { at: t + 2, kind: 'native', event: 'start-failed', detail: 'ForegroundServiceStartNotAllowedException' },
      { at: t + 3, kind: 'native', event: 'recorder-start' },
    ];
    const s = summarize(list);
    expect(s.native).toEqual(expect.arrayContaining([
      { event: 'start-failed: ForegroundServiceStartNotAllowedException', count: 2 },
      { event: 'vehicle-enter', count: 1 },
      { event: 'recorder-start', count: 1 },
    ]));
  });
});
