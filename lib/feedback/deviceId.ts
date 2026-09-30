import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The install's feedback id (02-cloud-v3.md §020): a random uuid kept in
 * AsyncStorage — not Application.getAndroidId(), which would let two installs
 * of the same signing key be linked. It rate-limits (5/h) and names the
 * screenshot folder; nothing else. Clearing app data makes a new one.
 */
const KEY = 'feedback_device_id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** RFC 4122 v4. Hermes has no crypto.randomUUID; getRandomValues when there, else Math.random. */
export function uuidv4(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  const native = c?.randomUUID?.();
  if (native && isUuid(native)) return native;
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (isUuid(stored)) return (cached = stored);
  } catch {
    // Storage blocked (web private mode): an id for this session only.
  }
  const fresh = uuidv4();
  cached = fresh;
  try {
    await AsyncStorage.setItem(KEY, fresh);
  } catch {
    // Same.
  }
  return fresh;
}
