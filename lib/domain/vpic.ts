/**
 * NHTSA vPIC VIN decoding (IMP 28092026, 01-data-model-v2.md §2.3; research §D).
 *
 * On demand and never blocking: US-market VINs decode well, EU ones often
 * come back with the make and nothing else, and a JDM car has no 17-character
 * VIN at all (its frame number "AE85-5xxxxxx" goes in `chassis_number`). So the
 * mapper only reports what vPIC actually answered, and the screen fills only
 * empty fields with it.
 */

export type VinCheck = { ok: true; vin: string } | { ok: false; reason: 'empty' | 'length' | 'chars' | 'frame' };

/**
 * A 17-character VIN (no I, O, Q). A frame number like "AE85-5012345" is not
 * a VIN and is told apart so the form can suggest the chassis-number field.
 */
export function checkVin(raw: string | null | undefined): VinCheck {
  const s = (raw ?? '').toUpperCase().replace(/\s+/g, '');
  if (!s) return { ok: false, reason: 'empty' };
  if (/^[A-Z]{2,4}\d{2,3}-?\d{5,8}$/.test(s) && s.length !== 17) return { ok: false, reason: 'frame' };
  if (s.length !== 17) return { ok: false, reason: 'length' };
  if (/[^A-HJ-NPR-Z0-9]/.test(s)) return { ok: false, reason: 'chars' };
  return { ok: true, vin: s };
}

export type VinDecoded = {
  make: string | null;
  model: string | null;
  year: number | null;
  cylinders: number | null;
  displacementCc: number | null;
  fuel: string | null;
  transmission: 'manual' | 'automatica' | 'cvt' | null;
  /** The schema's Drivetrain: a 4x4 is stored as awd. */
  drivetrain: 'fwd' | 'rwd' | 'awd' | null;
  engineModel: string | null;
};

export type VinResult = { ok: true; decoded: VinDecoded } | { ok: false; reason: 'network' | 'timeout' | 'not_decoded'; message?: string };

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && s.toLowerCase() !== 'not applicable' ? s : null;
};
const int = (v: unknown): number | null => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** vPIC's ErrorCode is text like "0 - VIN decoded clean"; several are comma-separated. The leading integer decides. */
export function vpicErrorCode(raw: unknown): number | null {
  const m = String(raw ?? '').trim().match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function transmissionOf(style: string | null): VinDecoded['transmission'] {
  if (!style) return null;
  const s = style.toLowerCase();
  if (s.includes('cvt') || s.includes('continuously')) return 'cvt';
  if (s.includes('manual')) return 'manual';
  if (s.includes('auto')) return 'automatica';
  return null;
}

function driveOf(drive: string | null): VinDecoded['drivetrain'] {
  if (!drive) return null;
  const s = drive.toLowerCase();
  if (s.includes('4x4') || s.includes('4wd') || s.includes('four') || s.includes('awd') || s.includes('all-wheel') || s.includes('all wheel')) return 'awd';
  if (s.includes('fwd') || s.includes('front')) return 'fwd';
  if (s.includes('rwd') || s.includes('rear')) return 'rwd';
  return null;
}

/**
 * The first object of `DecodeVinValues`' `Results`, mapped. "Decoded" needs
 * ErrorCode 0 or 1 *and*
 * a model: a make alone is the EU-VIN case and not worth filling a form with.
 */
export function mapVpic(json: unknown): VinResult {
  const r = (json as { Results?: Record<string, unknown>[] } | null)?.Results?.[0];
  if (!r) return { ok: false, reason: 'not_decoded' };
  const code = vpicErrorCode(r.ErrorCode);
  const model = text(r.Model);
  if (!model || (code != null && code !== 0 && code !== 1)) {
    return { ok: false, reason: 'not_decoded', message: text(r.ErrorText) ?? undefined };
  }
  const litres = Number.parseFloat(String(r.DisplacementL ?? ''));
  return {
    ok: true,
    decoded: {
      make: text(r.Make),
      model,
      year: int(r.ModelYear),
      cylinders: int(r.EngineCylinders),
      displacementCc: Number.isFinite(litres) && litres > 0 ? Math.round(litres * 1000) : null,
      fuel: text(r.FuelTypePrimary),
      transmission: transmissionOf(text(r.TransmissionStyle)),
      drivetrain: driveOf(text(r.DriveType)),
      engineModel: text(r.EngineModel),
    },
  };
}

/** Fetches and maps, with an 8 s timeout. Never throws. */
export async function decodeVin(vin: string, fetchImpl: typeof fetch = fetch, timeoutMs = 8000): Promise<VinResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: 'network', message: `HTTP ${res.status}` };
    return mapVpic(await res.json());
  } catch (e) {
    return { ok: false, reason: (e as { name?: string })?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
