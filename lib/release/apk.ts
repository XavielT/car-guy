/**
 * The APK on GitHub Releases (IMP 29092026 Phase 7, ADR-34).
 *
 * Every release carries an asset named exactly `car-guy.apk`, so the stable
 * link below always downloads the newest one; `api/apk.ts` adds its version
 * and size for the /instalar button. No React, no Expo: the Vercel function
 * and the page both import it.
 */
export const REPO = 'XavielT/car-guy';
export const APK_ASSET = 'car-guy.apk';
/** "your latest release asset that was manually uploaded" — works even when /api/apk does not. */
export const STABLE_APK_URL = `https://github.com/${REPO}/releases/latest/download/${APK_ASSET}`;
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
export const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export type ApkInfo = {
  /** Without the leading "v": "2.2.0". */
  version: string;
  publishedAt: string | null;
  url: string;
  /** Bytes. */
  size: number | null;
  notes: string;
};

type GithubRelease = {
  tag_name?: unknown;
  published_at?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown; size?: unknown }[];
};

/** The /releases/latest payload → what the page needs; null when there is no `car-guy.apk`. */
export function apkFromRelease(json: unknown): ApkInfo | null {
  const r = json as GithubRelease | null;
  if (!r || typeof r !== 'object' || typeof r.tag_name !== 'string') return null;
  const asset = (r.assets ?? []).find((a) => a?.name === APK_ASSET);
  if (!asset || typeof asset.browser_download_url !== 'string') return null;
  return {
    version: r.tag_name.replace(/^v/i, ''),
    publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
    url: asset.browser_download_url,
    size: typeof asset.size === 'number' && asset.size > 0 ? asset.size : null,
    notes: typeof r.body === 'string' ? r.body : '',
  };
}

/** "52 MB" — the button's size, rounded like Android's download sheet. */
export function sizeLabel(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/**
 * Android in a browser (never the native app — the caller checks Platform.OS):
 * UA Client Hints where Chromium has them, else the user-agent string.
 */
export function isAndroidBrowser(nav: { userAgent?: string; userAgentData?: { platform?: string } } | undefined): boolean {
  if (!nav) return false;
  if (nav.userAgentData?.platform) return nav.userAgentData.platform === 'Android';
  return /Android/i.test(nav.userAgent ?? '');
}
