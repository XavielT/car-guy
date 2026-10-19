# Verificación — IMP 16102026 (Car Guy 2.6.0 "Kōbō")

Cada nota de `00-context/NOTAS-ORIGINALES.md` contra evidencia (prueba, captura o archivo). 2026-10-17, fase 6.
Leyenda: ✔ verificado con prueba o captura · ◐ verificado en el código/navegador, falta el teléfono real (ver `05-manual-checklist.md`) · ✖ no cumplido.

**Resultado: 9 de 9 notas y 7 de 7 cosas de las capturas cumplidas en código y pruebas (✔/◐). Nada en ✖.** Lo que depende de un teléfono real, de la nube o de credenciales está marcado ◐ y listado al final en "No verificado".

## Notas (N)

| # | Nota | Estado | Evidencia |
|---|------|--------|-----------|
| N1 | Arreglar el problema del mapa | ◐ | Cada defecto está en `findings.md` ("Estado tras la fase 1/2": M-1…M-13). Con permiso el mapa se centra en el usuario (`trips/myPosition.test.ts`); sin permiso hay cámara de respaldo (`trips/fallback-camera.test.ts`: `last_fix` → mediana de salidas → Santo Domingo) y un aviso siempre accionable (`trips/gpsNotice.test.ts`, `components/map/GpsNoticeButton.tsx`). Capturas: `screens/f2-4_*.png`, `f2-5_*.png`. **Falta:** el GPS real en iPhone/Redmi. |
| N2 | La app pide los permisos que necesita | ✔ | Registro central `lib/permissions/` (ADR-59); primer antes del diálogo (`permissions/components.test.tsx`: "el primer va antes del diálogo", "Ahora no no pide"); nada se pide en frío (`permissions/architecture.test.ts`: 0 llamadas directas fuera del registro); pantalla `app/permisos.tsx` (`screens/f2-6_permisos_*.png`, `regresion/permisos_*.png`). |
| N3 | Si falta un permiso, hay una forma de darlo | ✔ | `permissions/way-out.test.ts` (nuevo, fase 6): **para cada permiso y cada estado en que falta, la fila tiene botón** (permitir / cómo / ajustes) y su texto está en es y en. Botón en el lugar donde falla (`GpsNoticeButton`, `PermissionBanner`), pasos de iPhone con "Ya la activé" (`screens/f2-3_*.png`), el estado se corrige al volver (`components.test.tsx`: re-lectura por `AppState` y `visibilitychange`). |
| N4 | Las opciones van dentro de un picker que se cierra al elegir | ✔ | `SelectField` / `FilterBar` / `ToggleRow` (ADR-60). `pickers/select-field.test.tsx` (abre, elige, cierra, el fondo cierra sin cambiar). **Guardas:** `pickers/no-inline-selectors.test.ts` falla con un `Chip`/`Segmented` fuera de la lista de navegación **y**, desde la fase 6, con un grupo de `Pressable` rol tab/radio hecho a mano (así cayó "Tipo" del formulario de servicio, que lo era). Capturas: `screens/f3-*.png`. |
| N5 | "Aceite sintético" siempre sale sin marcar | ✔ | Causa raíz en `findings.md` (N5). `db/vehicle-roundtrip.test.ts` (ida y vuelta de **todos** los campos del vehículo), `db/migrate-v11.test.ts`, `db/oil.test.ts`. **Navegador (fase 6, Chromium con el wasm real):** editar → marcar → guardar → recargar la página → **sigue marcado** (`false → true → true`). Sync: `db/repairs-sync.test.ts` ("oil_synthetic: una fila de la nube sin la columna no lo borra"). |
| N6 | Funciones escondidas | ✔ | Registro `lib/features/registry.ts` (ADR-62) con guardia rutas ↔ registro (`features/registry.test.ts`: 0 pantallas sin dueño); hub Herramientas con buscador, atajos del vehículo, testigos tocables. Profundidad: `feature-map.md` → "Después de la fase 4" (todas las funciones a ≤ 2 toques) y `registry.test.ts › depth from Inicio`. |
| N6a | OBD prácticamente escondido | ✔ | "Diagnóstico OBD" en la fila destacada del hub (`screens/f4-2_hub.png`), en los atajos del vehículo (`features/surfaces.test.tsx`), en el testigo CHECK (`surfaces.test.tsx › telltales`), aviso de primera vez (`components/features/HomeNudge.tsx`), enlace desde Eventos y Tareas vacíos (`ObdLink`). La búsqueda "luz del tablero" / "check engine" lo encuentra (`registry.test.ts`). |
| N7 | No hay forma de registrar una reparación | ◐ | Ya existía `ServiceRecord` `kind='reparacion'`; ahora modo reparación con quién la hizo, sistema, fotos con rol, garantía rápida, Pendiente que resuelve (ADR-61). `db/repairs.test.ts` (10), `db/migrate-v12.test.ts`, `db/repairs-sync.test.ts`, `domain/repairs.test.ts`, `service/repair-pieces.test.tsx`, `export/repairs.test.ts`. Capturas: `screens/f5-*.png`. **RLS probada (2026-10-18):** `tools/local-rls/run.sh` en PostgreSQL 16 (WSL) pasa completo, con `sql/040` y `sql/041` aplicados dos veces (re-ejecutables) y `scenario_041.sql` (15 comprobaciones: dueño, editor, lector, removido, extraño y anónimo). **Falta:** `sql/041` aplicado en `x-core`; fotos reales. |
| N8 | Ruta de los archivos de mejoras | ✔ | Paquete copiado a `docs/imp-16102026/` (fase 0) y convención de ruta en `README.md`. |
| N9 | "Sabes qué hacer con ellas" | ✔ | Mismo proceso que los ciclos anteriores: paquete (`docs/imp-16102026/`), `PROGRESS.md` por fase, `findings.md`, ADR-59…64, esta verificación y `05-manual-checklist.md`. |

## Cosas vistas en las capturas (X)

| # | Visto | Estado | Evidencia |
|---|-------|--------|-----------|
| X1 | "Fecha de compra" se sale del borde | ✔ | `screens/f1_purchase_row_320.png` / `_390.png`; sin desborde horizontal a 320/360/390 en las 9 pantallas de la regresión (script, `regresion/`). |
| X2 | "hace 0 s" partido en dos líneas | ✔ | `format.agoText` + `noBreak` (`__tests__/domain/relativeTime.test.ts`); "ahora" en lugar de "0 s". |
| X3 | Swatch "Negro" invisible | ✔ | `domain/contrast.ts` (borde ≥ 3:1); `screens/f3-4_color_sheet.png` (Negro con aro). |
| X4 | Pestaña FICHA cortada, más pestañas fuera | ✔ | `EdgeScroll` (degradado en el borde con más, pestaña activa al centro) + "Todas las secciones": `surfaces.test.tsx › tab strip edges`; `screens/f4-6_hub_320/360/390.png`. |
| X5 | "Precio de compra" gris como placeholder | ✔ | Era el ejemplo, no un valor guardado: ahora se ve como ejemplo ("Ej.: 875,000", `t.vehicleForm.purchasePriceExample`); y se encontró y corrigió el desvío de un día de la fecha de compra (`domain/dateInput.test.ts`, `db/vehicle-roundtrip.test.ts`). |
| X6 | Hueco en la tarjeta de Modo conducir | ✔ | El estado del permiso es un chip en la fila de chips (`screens/f2-4_fix.png`, `regresion/conducir_360.png`). |
| X7 | Pendientes del Build se cierran con una reparación | ✔ | Evento y tarea; "Resolver con una reparación" + "Deshacer" 10 s: `db/repairs.test.ts › closing a Pendiente`. |

## Regresión (fase 6)

| Comprobación | Resultado |
|--------------|-----------|
| `tsc --noEmit` | solo los 4 TS2882 de siempre (`maplibre-gl/dist/maplibre-gl.css`, de la línea base) |
| `eslint` (lo tocado en el ciclo) | 0 errores; avisos de estilo en pruebas (`require()` en mocks de jest) |
| `jest` completo | ver el cierre en `PROGRESS.md` → "Fase 6": las únicas fallas son las 11 de entorno de la línea base (CRLF en archivos generados, rutas de Windows, `node:sqlite` en `delete-vehicle`/`album`, y el glob de `git ls-files` de `skeletons`) |
| Paridad es/en | `i18n/parity.test.ts` (mismas claves, sin español en inglés) |
| Auditoría de skeletons | `ui/skeletons.test.ts` (falla solo por el glob de shell de Windows en esta máquina; el hub, la lista de Reparaciones y las demás pantallas nuevas renderizan su gemelo, revisado a mano) |
| Guardia del registro de funciones | `features/registry.test.ts` |
| Guardia de pickers | `pickers/no-inline-selectors.test.ts` (13) |
| Ida y vuelta del vehículo | `db/vehicle-roundtrip.test.ts` |
| Build web | `expo export -p web` + `finalize-web` ✔ |
| Capturas 320/360/390 | `screens/regresion/*.png`: Inicio, Vehículo (Resumen, Build, Eventos), Editar vehículo, Modo conducir, Herramientas, Permisos, Reparaciones — **sin desborde horizontal en ninguna** |

## Revisión cruzada

| | Pregunta | Respuesta |
|---|----------|-----------|
| a | ¿Algún `SelectField` rompió valores guardados? | No: las opciones comparan con `Object.is(value ?? null)`, `null` y números son valores válidos (`pickers/select-field.test.tsx`), y `vehicle-roundtrip` guarda y relee cada campo del formulario. |
| b | ¿El sync pisa valores nuevos? | No: `applyRemoteRows` solo escribe las columnas que trae la fila; una fila de la nube sin `oil_synthetic`/`done_by`/`system` no los borra (`db/repairs-sync.test.ts › what the cloud does not know…`). Una app vieja descarta las columnas que no conoce. |
| c | ¿La reparación respeta RLS y offline? | **Offline** ✔: todo se escribe local primero y sube después (`repairs-sync`: ida, vuelta, hijo antes que padre queda en espera). **RLS** ✔ (2026-10-18, PostgreSQL 16 en WSL): `sql/041` usa las políticas de miembros de `part` (`vehicle_of('service_record', …)`); `scenario_041.sql` pasa: el dueño y un editor ven y agregan, un lector ve pero no agrega, un removido y un extraño no ven nada, y anon no lee la tabla. |
| d | ¿Cada permiso tiene salida cuando falta? | Sí: `permissions/way-out.test.ts`. |
| e | ¿Hay selección en línea fuera del picker? | No: la guarda cubre `Chip`/`Segmented` y los grupos de `Pressable` tab/radio; la revisión encontró y convirtió "Tipo" del formulario de servicio, "Reclasificar" del detalle, "¿Aceite sintético?" y "Se me olvidó una carga anterior" (booleano → interruptor). Lo que queda tiene su motivo escrito en las dos listas de la prueba. |

## No verificado (necesita teléfono, nube o credenciales)
- **`sql/040` y `sql/041` sin aplicar** en `x-core` (sin credenciales). Sí se probaron en un PostgreSQL 16 local (RLS, re-ejecución). Hay que aplicarlos antes de publicar.
- iPhone real: ubicación (re-pregunta de la PWA, texto exacto de Ajustes), "Aceite sintético" tras matar la app, hoja de selectores con teclado.
- Redmi/MIUI: permiso de segundo plano en dos pasos, autoarranque y batería, "algunas fotos", cámara denegada, aviso de garantía.
- Fotos reales en reparaciones (el selector del navegador no se automatizó) y comparador antes/después con dos fotos.
- Sincronizar con la nube real; el release (ver `PROGRESS.md` → "Fase 6").
