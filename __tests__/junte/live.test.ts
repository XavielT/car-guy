/** IMP 01102026 Phase 6: the junte live gate, payload and peers. */
import { inLiveWindow, isStale, liveWindow, minutesLeft, positionPayload, prunePeers, readPayload, shouldPublish, upsertPeer, type Fix } from '@/lib/junte/live';

const T0 = Date.parse('2026-10-03T14:00:00Z');
const fix = (over: Partial<Fix> = {}): Fix => ({ lat: 18.47861, lng: -69.93121, heading: 271.4, accuracy: 8, t: T0, ...over });

describe('the live window (mirrors sql/035)', () => {
  const j = { starts_at: '2026-10-03T14:00:00Z', ends_at: null };
  it('opens 30 min before and closes 6 h after the start (or at the end)', () => {
    expect(inLiveWindow(j, T0 - 31 * 60_000)).toBe(false);
    expect(inLiveWindow(j, T0 - 29 * 60_000)).toBe(true);
    expect(inLiveWindow(j, T0 + 6 * 3_600_000 + 1)).toBe(false);
    expect(liveWindow({ ...j, ends_at: '2026-10-03T16:00:00Z' }).to).toBe(T0 + 2 * 3_600_000);
    expect(inLiveWindow({ ...j, status: 'ended' }, T0)).toBe(false);
    expect(minutesLeft({ ...j, ends_at: '2026-10-03T16:00:00Z' }, T0)).toBe(120);
  });
});

describe('the publish gate', () => {
  it('first fix always; then 15 s heartbeat, or T and 20 m', () => {
    expect(shouldPublish(null, fix(), T0, 3)).toBe(true);
    const last = { t: T0, lat: 18.47861, lng: -69.93121 };
    expect(shouldPublish(last, fix({ t: T0 + 5000 }), T0 + 5000, 3)).toBe(false); // 5 s, not moved
    expect(shouldPublish(last, fix({ t: T0 + 5000, lat: 18.4789 }), T0 + 5000, 3)).toBe(true); // 5 s, ~32 m
    expect(shouldPublish(last, fix({ t: T0 + 3000, lat: 18.4789 }), T0 + 3000, 3)).toBe(false); // < 4 s
    expect(shouldPublish(last, fix({ t: T0 + 15000 }), T0 + 15000, 3)).toBe(true); // heartbeat
  });
  it('20 cars stretch the interval to n²/60 s', () => {
    const last = { t: T0, lat: 18.47861, lng: -69.93121 };
    expect(shouldPublish(last, fix({ t: T0 + 5000, lat: 18.4795 }), T0 + 5000, 20)).toBe(false); // T = 6.7 s
    expect(shouldPublish(last, fix({ t: T0 + 7000, lat: 18.4795 }), T0 + 7000, 20)).toBe(true);
  });
  it('never a poor, stale or future fix', () => {
    expect(shouldPublish(null, fix({ accuracy: 80 }), T0, 2)).toBe(false);
    expect(shouldPublish(null, fix({ accuracy: null }), T0, 2)).toBe(false);
    expect(shouldPublish(null, fix({ t: T0 - 60_000 }), T0, 2)).toBe(false);
    expect(shouldPublish(null, fix({ t: T0 + 60_000 }), T0, 2)).toBe(false);
  });
});

describe('payload', () => {
  it('handle, 5 decimals, heading 0–359 — no id, no speed', () => {
    const p = positionPayload('trueno_ae85', fix({ lat: 18.478614, heading: -90 }));
    expect(p).toEqual({ h: 'trueno_ae85', lat: 18.47861, lng: -69.93121, hdg: 270, ts: T0 });
    expect(Object.keys(p)).not.toContain('spd');
  });
  it('reads only well-formed positions', () => {
    expect(readPayload({ h: 'ana_1', lat: 1, lng: 2, hdg: null, ts: 3 })).toMatchObject({ h: 'ana_1' });
    expect(readPayload({ h: 'Ana!', lat: 1, lng: 2, ts: 3 })).toBeNull();
    expect(readPayload({ h: 'ana_1', lat: 100, lng: 2, ts: 3 })).toBeNull();
    expect(readPayload(null)).toBeNull();
  });
});

describe('peers', () => {
  it('newest per handle, never my own, never moved back by an old message', () => {
    let peers = upsertPeer({}, { h: 'ana_1', lat: 1, lng: 1, hdg: null, ts: 10 }, T0, 'me_1');
    peers = upsertPeer(peers, { h: 'ana_1', lat: 2, lng: 2, hdg: null, ts: 5 }, T0, 'me_1');
    peers = upsertPeer(peers, { h: 'me_1', lat: 9, lng: 9, hdg: null, ts: 20 }, T0, 'me_1');
    expect(Object.keys(peers)).toEqual(['ana_1']);
    expect(peers.ana_1.lat).toBe(1);
  });
  it('greys after 45 s, drops after 5 min or when no longer a member', () => {
    const peers = upsertPeer({}, { h: 'ana_1', lat: 1, lng: 1, hdg: null, ts: 10 }, T0, null);
    expect(isStale(peers.ana_1, T0 + 46_000)).toBe(true);
    expect(prunePeers(peers, T0 + 6 * 60_000)).toEqual({});
    expect(prunePeers(peers, T0, ['otro_2'])).toEqual({});
    expect(Object.keys(prunePeers(peers, T0, ['ana_1']))).toEqual(['ana_1']);
  });
});
