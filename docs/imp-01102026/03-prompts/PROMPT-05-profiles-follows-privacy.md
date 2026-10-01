# PROMPT 05 — Perfiles públicos, @handle, seguir/amigos, privacidad, compartir viajes

**Depends on:** Phase 2 · **Branch:** `imp-01102026/phase-5-social` · **ADRs:** 54, 55, 56 · **Size:** L
**Goal:** G4 (part 1).

> **Before running:** sql/034 applied in Phase 2. Create a **second throwaway account** when the
> prompt asks (you type the password) so follow/friends can be verified between two phones/browsers.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 5 of IMP 01102026: people can find each other. Notes 11, 12, 14, 16 (public photo).

Read first:
- docs/imp-01102026/01-research/02-social-follows-live-location-juntes.md §1, §2, §6, §7 (functions
  pattern, follow/requests/block, trimming, abuse, sync rule)
- ADR-54, 55, 56; 02-screens.md "Phase 5"; 01-data-model-v10.md §2
- lib/social/* stubs, lib/domain/tripShare.ts (Phase 2), api/c/[slug].ts (pattern for /u/<handle>),
  app/cuenta.tsx + the profile screen (Phase 6 of cycle 4), components/Avatar, app/viaje/[id].tsx
  (share sheet), lib/share/*, vercel.json

Branch: imp-01102026/phase-5-social

1. PERFIL (own): @handle field with live availability (search_profiles/RPC is_handle_free),
   reserved list, bio, Instagram handle, switches (cuenta pública, foto pública, mostrar carros,
   stats, fichas), privacy zones (list; add from map pin or "mi ubicación ahora", radius 100–1000,
   default 300; stored local-first, synced), "Qué ven los demás" preview rendering the public
   profile as a follower would see it.
2. PERFIL PÚBLICO: app/u/[handle].tsx (native + web) built only from get_public_profile +
   public_profile_cars/stats RPCs (never a profiles select); Follow / Solicitar / Siguiendo /
   Amigos button with counts; blocks per switch; "…" → Reportar · Bloquear. Web function
   api/u/[handle].ts with OG tags (avatar if photo_public else the drawn avatar PNG — render the
   SVG avatars to PNG at build time), noindex unless is_public; vercel.json route; smoke-profile
   (3 checks). Deep link carguy://u/<handle>.
3. COMUNIDAD (Más → Comunidad): search (accent-insensitive via the RPC), Solicitudes (accept/
   decline), Amigos, Seguidores/Siguiendo, Bloqueados. Local social_cache refreshed on launch and
   after each action; offline shows the cache with a "sin conexión" caption.
4. COMPARTIR VIAJE: trip detail → Compartir → "Publicar en mi perfil (seguidores) · Solo amigos ·
   Público"; preview of the trimmed route (cut ends highlighted, zones hidden) + "Se recortan
   300–500 m al inicio y al final y tus zonas privadas"; creates trip_share (local + synced);
   un-share deletes it; the public profile lists shares the viewer may see (visibility rules in
   the RPC). The cloud never receives the untrimmed polyline for a share.
5. PHOTO PUBLIC (note 16): photo_public switch; when off the drawn avatar is shown to others.
6. ABUSE: report RPC with the feedback rate-limit pattern; block hides both ways; admin panel
   → Reportes list (status new/seen/done). Terms already cover it; add one line about handles.
7. Flags FEATURE_SOCIAL → true. Strings in both languages. Tests: tripShare (ends, seeded offset
   determinism, zone split), handle validation, cache reducer, visibility resolver.

VERIFY (two accounts: Xaviel + throwaway): set handles, follow both ways → Amigos; private account
→ request/accept; block → both profiles hidden; share a trip "solo amigos" → the friend sees the
trimmed route, a non-friend does not; /u/<handle> on the web shows the enabled blocks and never a
plate or a route; photo_public off → drawn avatar for others. Report block; Notes closed: 11, 12,
14, 16.
```
