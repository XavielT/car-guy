# Screens — IMP 01102026

Design language unchanged. New artboards (`01-research/04-mockups/`): **MedidorCuadros**,
**PerfilPublico**, **JunteEnVivo**. Every new screen ships with its skeleton twin.

## Phase 1 — fix pack 2.4.3

- **Inicio header**: the 改 seal → `<Avatar size=36>` (tap → Cuenta/Perfil); while syncing the
  "Todo subido" pill stays. Build tab keeps a small 改.
- **Cuenta**: "Última sincronización · 30 sep 2026 · 3:58 p. m." (Intl, es-DO/en-US).
- **Garage cards**: status badge becomes a solid chip (`bg #121212 @ 85 %`, status colour text,
  1 px line) over a bottom-left scrim; engine badge keeps red fill; check all three views at 360 px,
  long names ellipsised, "—" km when unknown (keep), one accent per card.
- **Mods entry**: vehicle hub header gets a **+ Mod** ghost button next to the odometer; garage
  card long-press sheet: "Agregar mod · Nueva echada · Chequeo"; Build tab unchanged. Mod form:
  category chips incl. **Accesorios** and **Estética** with preset list; cost in **RD$** first,
  "en USD" toggle second; "en un daily también cuenta" — no status restriction.
- **Paint job**: service form → "Carrocería y pintura" group with *Pintura completa* and
  *Desabollado y pintura parcial*; before/after photos; the event `pintura` is offered as a
  one-tap "También guardar como evento" after saving.
- **Location**: user dot = avatar in an amber ring with the course arrow; greyed + "Buscando GPS…"
  until a fresh fix; Conducir shows "Última posición: hace 3 h" instead of a wrong dot.
- **iPhone PWA banner** (Conducir, Viajes → Ajustes, welcome permissions slide): "En iPhone (web)
  Car Guy solo graba viajes manuales con la pantalla abierta. La detección automática existe en
  la app de Android." + "¿Por qué?" sheet.
- **Welcome**: slide "Tu odómetro" (how it increases; tap the LCD to correct) + first-Inicio tip.

## Phase 3 — gauge by segments

- **Vehicle form** → "¿Cómo marca la gasolina tu carro?": three illustrated chips (aguja · cuadros
  · porcentaje); for cuadros a stepper N (3–20) with a live preview; "¿Con cuántos cuadros prende
  la reserva?" (0/1/2). Pre-filled from refdata for known models when available (DS3 → 9? only if
  Xaviel confirms; else empty).
- **Fill-up form** → `GaugePicker` variants: `SegmentsPicker` (N rounded squares, amber filled,
  lowest red, tap/drag), the arc for eighths, a 5 % slider for percent; "Solo la luz de reserva"
  stays. After choosing: "≈ 22 L en el tanque (18–24)" when learned, "≈ linear" caption otherwise.
- **Vehicle hub** → fuel row: "Tanque: 4/9 ≈ 22 L · ≈ 390 km (300–450) · hace 2 días" (from the
  last reading minus km driven since, decaying); **cluster** fuel telltale amber ≤ 2 squares, red
  on reserve.
- **Ficha → Medidor**: the learned table reading → liters with bands, "aprendido con 3 tanques
  llenos", "Reiniciar calibración".

## Phase 4 — updates, apoyar, uso

- **Update banner** (top of Inicio): "Actualización lista · Reiniciar" (OTA) or "Nueva versión
  2.5.0 · 142 MB · Descargar e instalar" (APK) with progress; Novedades y versiones shows the OTA
  channel and "Buscar actualización" runs both checks.
- **Más → Apoyar Car Guy**: why, what the backend costs this month (from `app_config` written by
  the admin meter), the link(s), "Gracias" list opt-in (premium hanko), no nagging ever (one row,
  never a popup).
- **Admin → Uso y costos**: bars DB / Storage / MAU / Realtime vs free limits, slope → "Pro
  necesario ≈ <mes>", last 30 days.

## Phase 5 — profiles & follows

- **Perfil (own)**: avatar, display name, **@handle** (availability check), bio, Instagram,
  switches: cuenta pública · foto pública · mostrar carros · mostrar stats · mostrar fichas ·
  **zonas privadas** (list, add from map or current location, radius) · "Qué ven los demás"
  preview.
- **Perfil público** (`app/u/[handle].tsx` + web `/u/<handle>`): header (avatar, name, @handle,
  bio, IG link), Follow/Following/Friends button with counts, blocks per switch: Carros (cards with
  cover; tap → /c/<slug> if that car has a public page), Stats (gomas, km en viajes, badges, mods),
  Viajes compartidos (list of `trip_share` the viewer may see), "…" → Reportar · Bloquear.
- **Buscar** (Más → Comunidad): search by handle/name; Solicitudes (private accounts); Amigos list;
  Bloqueados.
- **Compartir viaje** (trip detail → Compartir → "Publicar en mi perfil" / "Solo amigos"): preview
  of the trimmed route with the cut ends highlighted and zones hidden; "Se recortan 300–500 m al
  inicio y al final y tus zonas privadas".
- Drive mode / trip detail: others' avatars appear only inside a junte (Phase 6).

## Phase 6 — juntes

- **Juntes** (Más → Comunidad → Juntes, and the Conducir sheet "Junte en curso"): list (próximos ·
  en vivo · pasados); **Nuevo junte**: título, fecha/hora, punto de encuentro (map pin + label),
  visibilidad (invitados · seguidores · público), code + link + QR; **Junte**: members with
  avatars and status, "Voy", "En vivo" switch (explains battery + that others see your dot while
  on), live map with every live member's avatar dot (no speeds), re-centre on me / fit all, time
  left; **Después**: all shared routes coloured per member, km each, photos grid (add from album),
  "Guardar como evento en mi carro" (auto on finish), Compartir resumen image.
- **Chat** (flagged off): message list + input inside the junte; report/delete/block.
- iPhone PWA: can join, see the live map while open, publishes only while open (banner).
