# Research 3 — Expo SDK 57: photo import with dates, storage budget, public page, shared garage, PDF, timeline UI

*2026-09-28. Read directly from docs.expo.dev v57, the `expo/expo@sdk-57` sources, supabase.com
docs/pricing and library repos (web search disabled). Versions from `bundledNativeModules.json`
(sdk-57): react-native 0.86.3 · expo-router ~57.0.23 · expo-image-picker ~57.0.20 ·
expo-media-library ~57.0.5 · expo-image-manipulator ~57.0.20 · expo-image ~57.0.5 · expo-print
~57.0.2 · expo-sqlite ~57.0.3 · expo-file-system ~57.0.7 · expo-sharing ~57.0.22 · expo-crypto
~57.0.3 · @shopify/flash-list 2.0.2 · gesture-handler ~2.32.0 · reanimated 4.5.1 · RN-web ~0.21.0.*

## 1. Importing old photos with their original dates

### expo-image-picker (~57.0.20)
- `exif: true` returns the raw EXIF map on **Android/iOS only** (`DateTimeOriginal`, `DateTime`,
  `Orientation`, GPS when present) — no promised field list; treat every key as optional.
- **Web** (`ExponentImagePicker.web.ts`): hidden `<input type="file">`, `multiple` when
  `allowsMultipleSelection`; returns `uri` (blob URL), `width/height`, `mimeType`, `fileName`,
  `fileSize`, `file` (File). EXIF **not read** (source has a TODO) → parse it yourself.
- `allowsMultipleSelection` (Android, iOS 14+, web; exclusive with `allowsEditing`);
  `selectionLimit` (Android/iOS; 0 = system max); `orderedSelection` iOS 15+ only; `assetId`
  Android/iOS only and often `null` on Android 13+ system picker — don't build on it.
- Verdict: fine for "add a few photos now"; no month browsing, no dates on web.

### expo-media-library (~57.0.5) — Android, iOS, tvOS; **not web**
- SDK 57 class API: `new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).gte(AssetField.
  CREATION_TIME, ms).lte(…).orderBy({key: AssetField.CREATION_TIME, ascending:false}).limit(n).
  offset(n).album(a).exe()` → `Asset[]`; `exeForMetadata()` → lightweight `AssetMetadata[]`.
  `AssetField`: CREATION_TIME, DURATION, HEIGHT, IS_FAVORITE, MEDIA_TYPE, MODIFICATION_TIME, WIDTH.
- `Asset`: `getCreationTime()`/`getModificationTime()` (ms or null), `getExif()` ({} if
  unavailable), `getLocation()`, `getOrientation()`, `getUri()`, `getWidth/Height()`,
  `getFilename()`, `getMediaType()`. `getExif()`/`getLocation()` need `ACCESS_MEDIA_LOCATION` on
  Android for location. Legacy `getAssetsAsync({createdAfter, createdBefore, sortBy, mediaType,
  album, first, after})` under `expo-media-library/legacy`.
- Permissions (plugin `withMediaLibrary.ts` + manifest): always declares
  `READ_MEDIA_VISUAL_USER_SELECTED`, `READ/WRITE_EXTERNAL_STORAGE` maxSdk 32. Options:
  `photosPermission`, `savePhotosPermission`, `preventAutomaticLimitedAccessAlert`,
  `isAccessMediaLocationEnabled`, **`granularPermissions: ['photo']`** (default all three → adds
  READ_MEDIA_IMAGES/VIDEO/AUDIO; Play policy restricts broad access). `requestPermissionsAsync
  (writeOnly?, granular?)` → `accessPrivileges: 'all'|'limited'|'none'`; `limited` = Android 14
  partial access; `presentPermissionsPickerAsync()` extends the selection → show a "Elegir más
  fotos" banner.

### Recommended flow
**Android:** request `['photo']`; if `limited` show banner; year → month drill-down (counts via
`exeForMetadata()`), photo grid with checkboxes; on confirm read `getExif().DateTimeOriginal`
(prefer) → `getCreationTime()` (WhatsApp downloads carry the download time); don't enable
`ACCESS_MEDIA_LOCATION`; copy `getUri()` through the manipulator (1600/q0.75) into `Paths.document`;
insert `media` with `taken_at`, `source: 'library'`.

```ts
import { Query, AssetField, MediaType, Asset, requestPermissionsAsync } from 'expo-media-library';
export async function ensurePhotoPermission() {
  const res = await requestPermissionsAsync(false, ['photo']);
  return { granted: res.granted, limited: res.accessPrivileges === 'limited' };
}
function monthRange(y: number, m0: number) { return { from: new Date(y, m0, 1).getTime(), to: new Date(y, m0 + 1, 1).getTime() - 1 }; }
export async function listMonthPhotos(y: number, m0: number, page = 0, size = 60) {
  const { from, to } = monthRange(y, m0);
  return new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).gte(AssetField.CREATION_TIME, from)
    .lte(AssetField.CREATION_TIME, to).orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(size).offset(page * size).exe();
}
export async function countMonthPhotos(y: number, m0: number) {
  const { from, to } = monthRange(y, m0);
  return (await new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).gte(AssetField.CREATION_TIME, from)
    .lte(AssetField.CREATION_TIME, to).exeForMetadata()).length;
}
export async function resolveTakenAt(asset: Asset): Promise<number | null> {
  const exif = await asset.getExif();
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime; // "YYYY:MM:DD HH:MM:SS", no TZ
  if (typeof raw === 'string' && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    const [d, t] = raw.split(' '); return new Date(`${d.replace(/:/g, '-')}T${t}`).getTime();
  }
  return asset.getCreationTime();
}
```

**Web:** `launchImageLibraryAsync({allowsMultipleSelection:true, mediaTypes:['images']})` (or own
input) + **exifr** (full 73 KB / lite 45 KB / mini 29 KB; ESM; File/Blob/ArrayBuffer; zero deps).
`exif-js` is abandoned. Gate with a `.web.ts` file.

```ts
import exifr from 'exifr/dist/lite.esm.js';
export async function readTakenAt(file: File): Promise<number | null> {
  try { const t = await exifr.parse(file, ['DateTimeOriginal','CreateDate','ModifyDate']);
        const d = t?.DateTimeOriginal ?? t?.CreateDate ?? t?.ModifyDate;
        if (d instanceof Date && !isNaN(d.getTime())) return d.getTime(); } catch {}
  return file.lastModified || null;
}
```

**Fallback both platforms:** date picker in the confirmation sheet with `date_precision`
day|month|year (WhatsApp-recovered photos of a sold car will mostly go this route).

**EXIF and the manipulator:** `ImageManipulatorModule.kt` compresses via `Bitmap.compress` with no
`ExifInterface` — **EXIF stripped** on save; web canvas path strips too. Read the date before
compressing; stripping GPS is the right default for anything that may become public; orientation
is applied at decode.

## 2. Storage budget & policy (supabase.com/pricing, fetched)

Free: 1 GB storage, 5 GB egress, 500 MB DB, 500k Edge invocations, projects paused after 1 week
idle, 2 active projects. Pro: 100 GB / 250 GB. File size limit Free 50 MB. **Image transformations
are Pro-only** → thumbnails must be client-side.

Egress math: 5 GB/month at 300 KB ≈ 17 000 full views/month across both apps; a 100-image timeline
open would burn it in 170 opens → thumbnails mandatory. Capacity: 1 GB ÷ 300 KB ≈ 3 400 photos if
alone; budget Car Guy ~400 MB → ~1 300 full photos or ~1 100 full+thumb pairs (thumb ≈ 40 KB,
13 % overhead, saves ~85 % grid egress). **Upload both.**

Quota RPC and policy:
```sql
create or replace function carguy.storage_usage_bytes() returns bigint
language sql security definer set search_path = '' as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o
  where o.bucket_id = 'carguy-media' and (storage.foldername(o.name))[1] = (select auth.uid())::text; $$;
revoke all on function carguy.storage_usage_bytes() from public;
grant execute on function carguy.storage_usage_bytes() to authenticated;
-- insert policy: with check (carguy.storage_usage_bytes() + coalesce((metadata->>'size')::bigint,0) <= carguy.quota_for(auth.uid()))
```
Keep `carguy-media` private (signed URLs remain valid until expiry regardless of key changes);
public bucket only for the share feature.

## 3. Public shareable car page

WhatsApp/Telegram/Twitter crawlers read `<meta property="og:*">` from the **static response**, no
JS. A static Expo export cannot set per-car OG tags → something server-side is needed.

- (a) Static route only — page works, no previews. Not acceptable.
- (b) Supabase Edge Function (`verify_jwt = false`) rendering HTML with the anon key; 500k
  invocations free; ugly `…supabase.co/functions/v1/share?slug=` URL without a custom domain (Pro).
- **(c) Vercel serverless function in the same repo, output still `static`** — `api/c/[slug].ts`
  + `vercel.json` rewrite `{"source": "/c/:slug", "destination": "/api/c/:slug"}`; fetches the
  view with the anon key, emits `og:title/og:image/og:url` and a small server-rendered dossier (or
  the SPA shell with injected tags). Nice URL, no Supabase Pro. **Recommended.**
- (d) Expo Router API routes (`+api.ts`, `web.output: "server"`, Vercel adapter documented with
  `expo-server/adapter/vercel`, `@vercel/node@5.1.8`, `includeFiles: "dist/server/**"`) — supported
  but "third-party adapters subject to breaking changes… no continuous tests", whole site changes
  output mode. Skip for one page.

Schema sketch:
```sql
alter table carguy.vehicle add column share_enabled boolean not null default false, add column public_slug text unique, add column share_cover_media_id text;
create or replace function carguy.gen_slug() returns text language sql as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (random()*30)::int + 1, 1), '') from generate_series(1, 8); $$;
create view carguy.public_vehicle with (security_invoker = true) as
  select public_slug as slug, make, model, year, nickname, color, share_cover_media_id, updated_at
  from carguy.vehicle where share_enabled and public_slug is not null;
grant select on carguy.public_vehicle to anon, authenticated;
create policy "public share read" on carguy.vehicle for select to anon using (share_enabled and public_slug is not null);
```
`security_invoker` makes the view run under the caller's RLS; the view projects out user_id,
plate, VIN… Photos: copy chosen (GPS-free) originals to public bucket `carguy-public/<slug>/…`;
revoke deletes objects and nulls the slug; **no `select` policy on `storage.objects` for anon** so
the bucket can't be listed (public buckets still serve direct object URLs).

## 4. Shared garage (two accounts, one vehicle)

```sql
create table carguy.vehicle_member (vehicle_id text references carguy.vehicle(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz default now(), primary key (vehicle_id, user_id));
create table carguy.vehicle_invite (code text primary key, vehicle_id text not null, role text not null default 'editor',
  email text, expires_at timestamptz not null default now() + interval '7 days', created_by uuid not null);
create or replace function carguy.is_member(v text, min_role text default 'viewer') returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.vehicle_member m where m.vehicle_id = v and m.user_id = (select auth.uid())
    and case min_role when 'viewer' then true when 'editor' then m.role in ('owner','editor') else m.role = 'owner' end); $$;
create policy "member read"  on carguy.vehicle  for select using (carguy.is_member(id));
create policy "editor write" on carguy.vehicle  for update using (carguy.is_member(id,'editor'));
create policy "member read"  on carguy.fuel_log for select using (carguy.is_member(vehicle_id));
create policy "editor ins"   on carguy.fuel_log for insert with check (carguy.is_member(vehicle_id,'editor'));
-- redeem_invite(code) security definer RPC validates code/expiry/email, inserts member, deletes code
```
`security definer` avoids recursive RLS; wrap `auth.uid()` in `(select …)` for plan caching.

Sync engine pitfalls: (1) pull predicate → RLS filters, client sends only the cursor; **membership
grant** makes older rows visible → reset that vehicle's cursors (vehicle-scoped full pull);
(2) `user_id` becomes `created_by`; ownership lives in `vehicle_member`; every child row needs
`vehicle_id` denormalised; (3) tombstones from another member propagate as long as they keep
`vehicle_id`; on removal the device keeps rows unless a "membership revoked" marker triggers a
purge; (4) LWW conflicts silent → add `updated_by`, show "editado por X", no merges; (5) media
paths `carguy-media/<user_id>/…` hide an editor's uploads from the owner's policy → new layout
`carguy-media/v/<vehicle_id>/<id>.jpg` with `is_member((storage.foldername(name))[2])` policies;
old paths stay; quota charged to the vehicle owner; (6) removed member's photos stay with the
vehicle (document it).

## 5. PDF car book

expo-print `printToFileAsync({html, width, height, base64, margins(iOS), textZoom(Android)})`; on
web it opens the print dialog (no file). iOS needs base64 images; Android WebView resolves
`file:///data/user/0/<pkg>/files/...` in practice (not officially stated). Practical limits: base64
JPEGs at 300 KB → 400 KB each; 40 photos ≈ 16 MB of HTML → freezes/OOM on low-end phones; use
400 px thumbs (~50 KB base64), cap ~60 images / 3–4 MB, chapters per year. Web needs another
engine anyway → **pdf-lib** (pure JS, `Buffer` polyfill, `embedJpg`, identical on web and Android,
manual layout). Recommendation: pdf-lib as the single engine; keep expo-print for quick text-only
prints if wanted.

## 6. Timeline UI

**List:** FlashList v2 (SDK 57 bundles 2.0.2) is new-arch only, no `estimatedItemSize`, masonry,
`stickyHeaderIndices`, `maintainVisibleContentPosition` default, `getItemType`; web support not
stated (renders, scroll restoration flaky). At hundreds of items, **FlatList with a flattened
`[{type:'header'}, {type:'row', photos:[…3]}]` array + `getItemLayout`** is simpler and gives
"jump to 2021"; FlashList native / FlatList web via `.web.tsx` if needed.

**Image:** expo-image (~57.0.5, Android/iOS/tvOS/Web): `source={{uri}}`, `placeholder={{blurhash}}`
(store one per media; `Image.generateBlurhashAsync()` at import, ~30 chars), `placeholderContentFit
="cover"`, `contentFit="cover"`, `cachePolicy="memory-disk"`, `transition={150}`, `recyclingKey=
{media.id}` (prevents the previous source showing in recycled cells), `priority="low"` offscreen.
Local file first, signed URL fallback; keep signed URLs in memory with expiry.

**Zoom viewer:** `react-native-image-viewing` unmaintained, no web; `react-native-zoom-toolkit`
(needs gesture-handler ≥ 2.19 + reanimated — both present) has no web docs. Recommendation: own
`Modal` viewer — expo-image full with thumb placeholder, `Gesture.Simultaneous(Pinch, Pan)` +
reanimated shared values (~120 lines, works on web), horizontal `FlatList` pager; optionally
zoom-toolkit `Gallery` on native via `.web.tsx` split.

## Summary of decisions (adopted in ADR-18/22/23)
1 Import: media-library Query month browser on Android (`['photo']`, handle `limited`);
`<input multiple>` + exifr lite on web; date picker with precision fallback; read dates before
compressing. 2 Storage: private bucket, full + thumb, per-user quota + RPC meter, ~400 MB Car Guy
budget. 3 Share: `share_enabled` + unguessable slug, `security_invoker` view, `carguy-public/<slug>`
copies, Vercel `api/c/[slug].ts` for OG; keep static output. 4 Shared garage: `vehicle_member` +
`is_member()`; cursor-only pull; re-pull on grant; `v/<vehicle_id>/` media paths. 5 PDF: pdf-lib
both platforms. 6 UI: FlatList + `getItemLayout`, expo-image + blurhash + `recyclingKey`, own zoom modal.

## Sources
https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json ·
https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/ · …/packages/expo-image-picker/src/ExponentImagePicker.web.ts ·
https://docs.expo.dev/versions/v57.0.0/sdk/media-library/ · …/expo-media-library/plugin/src/withMediaLibrary.ts ·
…/expo-media-library/android/src/main/AndroidManifest.xml · https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/ ·
…/expo-image-manipulator/android/…/ImageManipulatorModule.kt · https://docs.expo.dev/versions/v57.0.0/sdk/print/ ·
https://docs.expo.dev/versions/v57.0.0/sdk/image/ · https://docs.expo.dev/router/reference/api-routes/ ·
https://supabase.com/pricing · https://supabase.com/docs/guides/storage/uploads/file-limits ·
https://supabase.com/docs/guides/storage/serving/image-transformations · https://supabase.com/docs/guides/storage/security/access-control ·
https://supabase.com/docs/guides/storage/buckets/fundamentals · https://supabase.com/docs/guides/storage/serving/downloads ·
https://supabase.com/docs/reference/javascript/storage-from-createsignedurl · https://supabase.com/docs/guides/functions ·
https://github.com/MikeKovarik/exifr · https://github.com/Shopify/flash-list · https://glazzes.github.io/react-native-zoom-toolkit/ ·
https://github.com/jobtoday/react-native-image-viewing
