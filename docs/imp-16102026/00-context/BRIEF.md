# BRIEF — ciclo IMP 16102026 (v2.6 "Kōbō" 工房)

Escrito 2026-10-16 (revisado el mismo día contra el repo real). Sexto ciclo de Car Guy. Repo `github.com/XavielT/car-guy` (Expo SDK 57; web exportada a Vercel; SQLite local; sync a Supabase `x-core`, schema `carguy`). Xaviel usa la app **en el iPhone como PWA** y **en el Redmi como APK**.

## Estado real del repo (verificado el 2026-10-16 clonando `github.com/XavielT/car-guy`, rama `main`, commit `2691f64`)
- Versión **2.5.1** (OTA sobre el APK 2.5.0, versionCode 21). Schema local **v10** (`lib/db/migrations.ts`, `migrationV10.ts`). Último SQL de nube **`sql/039_junte_chat_push.sql`** (aplicado a `x-core`; `999_cleanup_test_users.sql` y `rollback.sql` son aparte). Último ADR **58**. La rama `junte-chat-push` ya está fusionada; el chat sigue apagado (`FEATURE_JUNTE_CHAT = false`).
- Por lo tanto este ciclo usa: **schema v11** (y v12 si hace falta), **`sql/040…`**, **ADR-59…**, versión **2.6.0**. Si al empezar hay commits nuevos, verifica y renumera.
- La huella nativa ya cambió con la config de Firebase (`ff2d7e1…` en `releases/fingerprint.json` está pendiente de un APK): **el próximo release nativo debe ser APK**, no OTA. Los cambios de permisos de este ciclo también son nativos. Los cambios solo de JS pueden salir por OTA (`tools/ota-gate.cjs` decide).
- Convención del repo: el paquete vive en `docs/imp-<ddmmyyyy>/` (aquí `docs/imp-16102026/`), el log en `docs/imp-16102026/04-tracking/PROGRESS.md` y el resumen del ciclo en `docs/NEXT.md`. Reglas de agente: `AGENTS.md` ("Expo HAS CHANGED": leer los docs versionados de Expo v57 antes de escribir código).
- Herramientas existentes: `npm test` (jest), `npm run lint`, `npm run build` (web), `npm run changelog`, `npm run check:api`, `npm run types:gen`, `node tools/apply-sql.mjs` (aplicar SQL a `x-core`), `tools/release-apk.sh`, `tools/build-test-apk.sh`, `tools/ota-gate.cjs`, `tools/i18n-*.mjs`, `tools/local-rls`, `tools/smoke-*.mjs`.
- **Cosas pendientes de ciclos anteriores que siguen abiertas** (de `docs/NEXT.md`, no son de este ciclo pero afectan): subir la llave FCM a expo.dev (la hace Xaviel), probar un junte en vivo con dos dispositivos, y su manejada real con el Redmi (permiso de ubicación fg+bg, autoarranque MIUI, sin optimización de batería) — esto último se cruza con la fase 2 de permisos.

## Lo que ya existe y este ciclo reutiliza (no se reconstruye)
- **Permisos**: llamadas dispersas en `lib/trips/live.ts`, `auto.ts`, `myPosition.ts`, `diagnostics.ts`, `components/trips/TripPieces.tsx` (banner con `openSettings` y re-lectura al volver a la app), `app/viajes/permisos.tsx` (pantalla de segundo plano/MIUI/batería), `components/social/PrivacyZonesEditor.tsx`, `app/juntes/nuevo.tsx`, `lib/media/library.ts`, `lib/notifications/index.ts`, `app/notificaciones.tsx`. No hay un registro central. `app/conducir.tsx:144` muestra `t.drive.gpsDenied` como texto pasivo.
- **Mapa**: `components/map/` (LiveMap, TripMap, JunteMap, HeatMap con variantes `.web`, `Recenter.tsx`, `UserDot.tsx`, `useMapStyle.ts`, `webMap.ts`).
- **Selectores**: `components/pickers/` (`PickerField` = solo el campo disparador; `SearchSheet`; `SwatchGrid`; `YearWheel`) y `components/ui/Sheet.tsx`. Los controles "afuera" son `Chip` y `Segmented` de `components/ui/index.tsx` (≈58 usos de `<Chip` en ~40 archivos y ≈30 de `<Segmented` en ~24; muchos son filtros o navegación).
- **Reparaciones**: ya existe `ServiceRecord` con `kind: 'mantenimiento' | 'reparacion' | 'mejora'`, costos de piezas y mano de obra, `shop` + `contactId` (taller como contacto con llamar/WhatsApp), garantía por fecha/km, lista de piezas, una foto, `sourceTaskId`; formulario en `app/servicio/nuevo.tsx` y `[id].tsx`; solo se llega desde Historial → "+" → "Registrar reparación" (`/servicio/nuevo?kind=reparacion`). Los eventos (`Milestone`) ya tienen `pending`, `resolvedAt` y `linkedServiceId`.
- **Funciones**: OBD en `/obd` y `/obd/[code]` (entradas: Más, FAB de Historial, Ficha; todo detrás de `FEATURE_DIY`, que está en `true`). Testigos en `components/ui/TelltaleRow.tsx` ya son tocables (`lamp.onPress`: recordatorios, chequeo, tareas, combustible). `components/ui/QuickActions.tsx` es la cuadrícula de verbos de Inicio. Pestañas del vehículo: `TABS` en `app/vehiculo/[id].tsx` (resumen, álbum, eventos, build, ficha, pista, viajes, docs) dentro de un `ScrollView` horizontal.

## Respuestas de Xaviel (16-10)
- Mapa: no sabe qué más falla → **diagnosticar** en PROMPT-00 (iPhone PWA y Redmi).
- Selectores: **todo en picker** (incluso 2–3 opciones). Los booleanos (Aceite sintético, Pasajero) no son selección entre opciones: siguen siendo interruptor/casilla.
- Funciones escondidas: hub **Herramientas** + **atajos en el vehículo** + **testigos del cluster tocables** + **buscador de funciones**.
- Reparaciones: capturar **quién la hizo + taller**, **costos (piezas / mano de obra)**, **fotos y factura**, **garantía y vínculo con un Pendiente**.

## Notas → fases
1 Fix pack 2.5.2 (aceite sintético con columna nueva v11/`sql/040` + capturas X1/X2/X3/X5 + defectos de mapa independientes del permiso) → 2 Permisos + mapa (N1, N2, N3, X6) → 3 SelectField + migración de los selectores (N4, X3) → 4 Herramientas / descubribilidad (N6, N6a, X4) → 5 Reparaciones (N7, X7) → 6 Regresión y release **v2.6.0**. Fase 0 es solo diagnóstico.

## Decisiones propuestas (ADR-59…64; renumera si el último real no es 58)
- **ADR-59** Permisos: registro central; siempre una explicación previa ("primer") antes del diálogo del sistema; nunca se pide en frío; estado se vuelve a leer al volver a la app.
- **ADR-60** Un solo `SelectField` (el `PickerField` actual como disparador + `Sheet`/`SearchSheet`/`SwatchGrid` dentro) para toda selección de un valor entre opciones nombradas en formularios y ajustes; el modal se cierra al elegir; los booleanos son interruptores; los filtros de listas también pasan a picker (decisión de Xaviel, 16-10); la navegación, pestañas e interruptores quedan como están; un lint impide `Chip`/`Segmented` como selector de valor.
- **ADR-61** Una reparación **sigue siendo un `ServiceRecord` con `kind='reparacion'`** (ya tiene costos, taller como contacto, garantía, piezas y fuentes); se le agrega lo que falta (quién la hizo, fotos con rol, cierre de un Pendiente) y un flujo propio "Registrar reparación" con muchas entradas. No se crea un modelo paralelo.
- **ADR-62** Descubribilidad: un **registro único de funciones** alimenta hub, buscador, atajos, testigos y tips; una prueba falla si existe una ruta que no esté en el registro.
- **ADR-63** Bugs de "no se guarda": test genérico de ida y vuelta (formulario → SQLite → recarga → sync push/pull → formulario) para todos los campos del vehículo.
- **ADR-64** Mapa sin permiso: cámara en posición de respaldo (última conocida → centro de viajes recientes → Santo Domingo) y botón "Activar ubicación"; nunca un aviso pasivo.

## Restricciones vigentes
`x-core` compartido con Music Hub → solo cambios aditivos; Realtime con prefijo `carguy:`; nunca commitear `.env*` ni service-role; seeds sin placa/VIN/teléfono reales; Claude Code no crea cuentas ni escribe contraseñas; OTA (EAS Update) para JS y APK para nativo, con la decisión en el script de release (ADR-56); i18n es/en tipado (`en.ts` como `typeof es`); skeleton gemelo por pantalla; los prompts incluyen cada punto de la nota y nada espera una decisión pendiente.

## Vocabulario local
echada, aros/rines, taller, mecánico, hojalatería (desabollar y pintar), mano de obra, piezas, coolant, "eso ta' clean". Dinero en RD$.

## Fuera de alcance (a propósito)
App nativa iOS; mantener la pantalla encendida en viajes manuales del iPhone (Wake Lock) — se anota como idea en `PROGRESS.md`; cambios al sistema de sync más allá de lo necesario; rediseño visual.

## Reglas permanentes (se repiten en cada prompt)
1. Lee este BRIEF y la SPEC de tu fase antes de tocar código.
2. Todo punto de `NOTAS-ORIGINALES.md` asignado a tu fase se implementa y se prueba; no se omite ninguno.
3. **Nada espera una decisión**: si algo no está definido, aplica el default recomendado, regístralo en `04-tracking/PROGRESS.md` ("Decisiones tomadas") y sigue.
4. Cambios en `x-core` solo aditivos. Nunca `.env*`, nunca claves, nunca datos reales en seeds.
5. Bug → primero test que falla, luego fix. No marques algo como hecho sin test o captura que lo pruebe.
6. i18n es/en, skeleton gemelo, accesibilidad (labels, objetivos táctiles ≥ 44 pt).
7. Commits pequeños; al terminar actualiza `PROGRESS.md` y entrega reporte final claro.
