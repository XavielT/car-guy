/**
 * Version maths for the APK updater (IMP 01102026 Phase 4, ADR-52). Pure: the release tag "v2.5.0" from
 * /api/apk against the installed `nativeApplicationVersion` "2.4.3". Pre-release and build suffixes are
 * ignored (releases are never pre-releases, tools/release-apk.sh).
 */
export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec((v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

/** -1, 0, 1; null when either side is not a version. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 | null {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** The published APK is newer than what is installed (unknown → no prompt). */
export function isNewer(published: string | null | undefined, installed: string | null | undefined): boolean {
  return compareVersions(published, installed) === 1;
}
