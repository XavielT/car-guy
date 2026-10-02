/**
 * The live part of a junte, pure (IMP 01102026 Phase 6, ADR-57, research 02 §3.3–3.4): when a member may
 * publish, what a position message carries, and how the map keeps the others' dots. The channel code
 * (lib/junte/channel.ts) and the Android background task share it.
 *
 * Privacy (ADR-56/57): a position names the member by @handle (never a user id) and carries no speed — the
 * live dot is the only raw position Car Guy ever shows another person, only to members, only in the window.
 */
import { liveIntervalMs } from './interval';

/** The window the cloud allows (sql/035 junte_live_window): from 30 min before the start to the end (or +6 h). */
export function liveWindow(j: { starts_at: string; ends_at: string | null }): { from: number; to: number } {
  const start = new Date(j.starts_at).getTime();
  const end = j.ends_at ? new Date(j.ends_at).getTime() : start + 6 * 3_600_000;
  return { from: start - 30 * 60_000, to: Math.min(end, start + 6 * 3_600_000) };
}

export function inLiveWindow(j: { starts_at: string; ends_at: string | null; status?: string }, now: number): boolean {
  if (j.status === 'ended') return false;
  const w = liveWindow(j);
  return now >= w.from && now <= w.to;
}

export type Fix = { lat: number; lng: number; heading: number | null; accuracy: number | null; t: number };
export type LastSent = { t: number; lat: number; lng: number } | null;

/** Worse than this, a fix is not shown to others (research §3.3). */
export const MAX_ACC_M = 50;
/** A parked car still says "here" this often. */
export const HEARTBEAT_MS = 15_000;
/** Below this movement only the heartbeat publishes. */
export const MIN_MOVE_M = 20;

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** The downsampling gate: (Δt ≥ T and moved ≥ 20 m) or Δt ≥ 15 s; never a poor or future fix. */
export function shouldPublish(last: LastSent, fix: Fix, now: number, members: number): boolean {
  if (fix.accuracy == null || fix.accuracy > MAX_ACC_M) return false;
  if (fix.t > now + 5_000 || now - fix.t > 30_000) return false;
  if (!last) return true;
  const dt = now - last.t;
  if (dt >= HEARTBEAT_MS) return true;
  return dt >= liveIntervalMs(members) && metres(last, fix) >= MIN_MOVE_M;
}

/** Broadcast event `pos`: ~80 bytes, 5 decimals (≈ 1 m), no id, no speed. */
export type PosPayload = { h: string; lat: number; lng: number; hdg: number | null; ts: number };

export function positionPayload(handle: string, fix: Fix): PosPayload {
  return {
    h: handle,
    lat: Math.round(fix.lat * 1e5) / 1e5,
    lng: Math.round(fix.lng * 1e5) / 1e5,
    hdg: fix.heading == null || Number.isNaN(fix.heading) ? null : Math.round(((fix.heading % 360) + 360) % 360),
    ts: fix.t,
  };
}

/** A received payload, or null when it is not one of ours (anything else on the channel is ignored). */
export function readPayload(p: unknown): PosPayload | null {
  const v = p as Partial<PosPayload> | null;
  if (!v || typeof v.h !== 'string' || !/^[a-z0-9_]{3,20}$/.test(v.h)) return null;
  if (typeof v.lat !== 'number' || typeof v.lng !== 'number' || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
  if (typeof v.ts !== 'number') return null;
  return { h: v.h, lat: v.lat, lng: v.lng, hdg: typeof v.hdg === 'number' ? v.hdg : null, ts: v.ts };
}

export type Peer = PosPayload & { receivedAt: number };
export type Peers = Record<string, Peer>;

/** A dot older than this is drawn greyed; older than GONE_MS it is dropped. */
export const STALE_MS = 45_000;
export const GONE_MS = 5 * 60_000;

/** Newest position per handle; an out-of-order older message never moves a dot back. */
export function upsertPeer(peers: Peers, p: PosPayload, now: number, me: string | null): Peers {
  if (p.h === me) return peers;
  const cur = peers[p.h];
  if (cur && cur.ts >= p.ts) return peers;
  return { ...peers, [p.h]: { ...p, receivedAt: now } };
}

/** Drop the gone ones and anyone no longer a member (kicked, left, blocked). */
export function prunePeers(peers: Peers, now: number, members?: readonly string[]): Peers {
  const keep = members ? new Set(members) : null;
  const out: Peers = {};
  for (const [h, p] of Object.entries(peers)) {
    if (now - p.receivedAt > GONE_MS) continue;
    if (keep && !keep.has(h)) continue;
    out[h] = p;
  }
  return out;
}

export function isStale(p: Peer, now: number): boolean {
  return now - p.receivedAt > STALE_MS;
}

/** "Quedan 2 h 10 min" — minutes left in the window, or null outside it. */
export function minutesLeft(j: { starts_at: string; ends_at: string | null; status?: string }, now: number): number | null {
  if (!inLiveWindow(j, now)) return null;
  return Math.max(0, Math.round((liveWindow(j).to - now) / 60_000));
}
