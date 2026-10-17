# Mapa de funciones (N6, N6a, X4) — Fase 0, 2026-10-16

Cada ruta de `app/` (101 pantallas con ruta + las pestañas internas), sus puntos de entrada reales (cruce de literales de ruta en `app/`, `components/`, `lib/`; script en carpeta temporal, no en el repo) y los **toques mínimos desde Inicio**. Todo con las banderas actuales: `FEATURE_BUILD/DIY/TRACK/TRIPS/ALBUM/SHARE/EVENTS/SOCIAL/JUNTES = true`, `FEATURE_JUNTE_CHAT = false`, `FEATURE_LEGAL = false`.

**Regla de "escondida"** (PROMPT-00): ≥ 3 toques desde Inicio **o** un solo camino. Añado un tercer criterio que sale del caso de Xaviel (OBD): **enterrada** = a 2 toques pero dentro de una lista larga (Más tiene ≈ 33 filas) sin atajo en Inicio ni en el vehículo.

## Cómo se llega a todo desde Inicio

- **Barra inferior** (`components/tabbar/CarGuyTabBar.tsx`): Inicio · Garaje · **Conducir** (botón central, `/conducir`) · Historial · Más → 1 toque cada uno.
- **Inicio** (`app/(tabs)/index.tsx`):
  - `QuickActions` (:541-554): **Gasolina** (`/carga/nueva`), **Chequeo** (`/chequeo`), **Build** (`/vehiculo/[id]?tab=build`), **Pista** (`/pista`), **Cifras** (`/cifras`). (Con `FEATURE_BUILD`/`FEATURE_TRACK` los atajos "Servicio" y "Gasto" ceden su lugar: ya no hay atajo a registrar un servicio ni un gasto.)
  - **Testigos** (`TelltaleRow`, :252-265): ver abajo.
  - Tarjetas de **Pendientes** (`mergeAttention`, :234-248 → `/recordatorio/[id]`, `/tarea/[id]`), **odómetro** (:423 → `/odometro`), "Iniciar viaje" (`beginTrip`, :451), tarjeta de cuenta (`/cuenta`), instalar (`/instalar`), último llenado (`/carga/[id]`).
- **Más** (`app/(tabs)/mas.tsx`): ≈ 33 filas en secciones: Cifras, Garaje, Vehículo, Registrar vehículo, Chequeos, Guía de chequeo, Registrar servicio, Historial, Recordatorios, Catálogo, Tareas, Combustible, Precios, Gasto, **Contactos, OBD**, Pista, Viajes, Compartidos, Código de invitación, Documentos, Cuenta, Comunidad, Juntes, Apariencia, Idioma, Notificaciones, Bienvenida, Instalar, Legal, Versiones, Comentarios, Admin, Apoyar.
- **Garaje → tarjeta del vehículo** (2 toques) → `app/vehiculo/[id].tsx`: pestañas `TABS` (:75-84) = resumen, álbum, eventos, build, ficha, pista, viajes, docs, en un `ScrollView` horizontal (:314) + botones de la pestaña Resumen (editar, compartir, libro, miembros, :399-408).
- **Historial → "+"** (FAB, :205-245): combustible, servicio, **reparación**, mejora, gasto, chequeo, odómetro, hito, evento, importar fotos, **código OBD**.

## Tabla por ruta

Toques = mínimo desde Inicio. ★ = escondida (≥ 3 toques o un solo camino). ◆ = enterrada (2 toques en lista larga, sin atajo).

### Núcleo (mantenimiento, combustible, gastos)
| Ruta | Función | Entradas | Toques | |
|------|---------|----------|--------|--|
| `/(tabs)/index` Inicio | tablero | barra inferior | 0 | |
| `/carga/nueva`, `/carga/[id]`, `/carga/[id]/editar` | registrar/ver/editar un llenado | QuickAction Gasolina, Más, Historial, tarjeta "último llenado" | 1 | |
| `/chequeo`, `/chequeo/[templateId]/run`, `/inspeccion/[id]` | chequeo semanal (ejecutar/ver) | QuickAction Chequeo, testigo, Más, notificación | 1 | |
| `/chequeo/guia` | guía del chequeo | Más, `/chequeo` | 2 | |
| `/chequeo/plantillas/[id]` | editar plantillas | solo `/chequeo` | 2 | ★ un camino |
| `/recordatorios`, `/recordatorio/[id]`, `/recordatorio/nuevo` | recordatorios | testigos, Pendientes, Más | 1 | |
| `/servicio/nuevo?kind=mantenimiento` | registrar servicio | Más, Historial "+" | 2 | |
| **`/servicio/nuevo?kind=reparacion`** | **registrar reparación (N7)** | **solo Historial → "+" → "Registrar reparación"** (`historial.tsx:217`) | **3** | **★ un camino, 3 toques**; otro camino indirecto: OBD → código → "Crear reparación" (`diyQueries.createRepairForDtc`) |
| `/servicio/nuevo?kind=mejora` | mejora (hoy redirige a `/mod/nuevo`) | Historial "+" | 3 | ★ |
| `/servicio/[id]` | detalle de servicio/reparación | Historial, Más, `tarea/[id]`, álbum, OBD | 2 | |
| `/tareas`, `/tarea/nueva`, `/tarea/[id]` | tareas / pendientes del carro | Más → Tareas; Pendientes de Inicio llevan a `/tarea/[id]` | 1 (tarea) / 2 (lista) | |
| `/catalogo`, `/catalogo/[id]` | catálogo de servicios | Más | 2 | |
| `/gasto/nuevo`, `/gasto/[id]` | gastos | Más, Historial "+" | 2 | |
| `/odometro` | actualizar el odómetro | Inicio (cifra), Historial "+", hub del vehículo | 1 | |
| `/precios`, `/precios/nuevo` | precios de combustible (MICM) | Más → Precios | 2 | |
| `/cifras`, `/reporte`, `/exportar` | estadísticas · reporte · exportar CSV | QuickAction Cifras / Más → `/cifras` → `/reporte`, `/exportar` | 1 / 2 / 2 | |

### Vehículo y garaje
| Ruta | Función | Entradas | Toques | |
|------|---------|----------|--------|--|
| `/(tabs)/garaje` | garaje | barra inferior | 1 | |
| `/vehiculo/[id]` (+ pestañas) | hub del vehículo | Garaje (tarjeta), QuickAction Build, Más → Vehículo | 1–2 | |
| `/vehiculo/nuevo`, `/vehiculo/[id]/editar` | alta / edición | Garaje, Inicio, Más / hub | 2 / 3 | ★ editar (3) |
| `/vehiculo/[id]/album`, `/album/estado`, `/album/importar` | álbum de fotos | pestaña Álbum, Historial "+" → Importar | 3 / 3 | ★ |
| `/foto/[id]`, `/hito/*` (`/hito/[id]`, `/hito/nuevo` **sin entradas**: redirigen a `/evento`) | visor de foto · hitos | álbum, eventos | 3 | ★ |
| `/evento/nuevo`, `/evento/[id]` | eventos (accidentes, hitos, pendientes) | pestaña Eventos, Historial "+" | 3 | ★ |
| `/vehiculo/[id]/build` (+ `/mod/*`, `/wishlist/*`, `/inventario/*`, `/ruedas/[setId]`, `/goma/[id]`) | build log (mods, specs, wishlist, inventario) | QuickAction Build, pestaña Build | 1 (mods) / 2 (wishlist, inventario) / 3 (aros, gomas) | ★ aros/gomas |
| `/vehiculo/[id]/ficha`, `/vehiculo/[id]/fluidos` | ficha técnica · memoria · fluidos | pestaña Ficha (+ "Fluidos" desde la ficha) | 3 / 4 | ★ ★ |
| `/vehiculo/[id]/libro` | libro del carro (PDF) | botón del hub, `compartir` | 3 | ★ |
| `/vehiculo/[id]/compartir`, `/compartidos` | compartir el vehículo | hub, Más → Compartidos | 2–3 | |
| `/garaje/miembros`, `/invitacion/[code]` | miembros / aceptar invitación | hub (miembros), Más (código) | 3 / 2 | ★ miembros |
| `/documentos`, `/documento/nuevo`, `/documento/[id]` | documentos | Más, pestaña Docs | 2 | |
| `/contactos`, `/contactos/nuevo`, `/contactos/[id]` | talleres y contactos | Más → Contactos; `ContactPicker` en servicios | 2 | |

### Diagnóstico, viajes y pista
| Ruta | Función | Entradas | Toques | |
|------|---------|----------|--------|--|
| **`/obd`, `/obd/[code]`** | **diagnóstico OBD: códigos, su historial, guía y crear reparación** | **Más → "Diagnóstico OBD"** (`mas.tsx:202`, bajo Contactos; solo con `FEATURE_DIY`); Historial "+" → "Registrar código OBD" (`/obd?add=1`, `historial.tsx:231`); Ficha del vehículo (`FichaTab` → `/obd`); sin atajo en Inicio, sin testigo de "check engine" | **2** (Más) / 3 / 4 | **◆ enterrada** (fila 17 de ≈ 33, mismo peso que "Contactos") y ★ por el resto de caminos |
| `/conducir` | Modo conducir | botón central de la barra | 1 | |
| `/viajes`, `/viaje/[id]`, `/viaje/compartir/[id]` | viajes (lista, detalle, publicar) | Más → Viajes; Conducir → "Ver viajes"; pestaña Viajes | 2 / 3 / 4 | ★ publicar |
| `/viajes/ajustes`, `/viajes/permisos` | modo Automático/Manual, permisos de segundo plano, MIUI | Viajes → Ajustes; Conducir → modo Automático (si falta algo) | 3 / 3 | ★ |
| `/pista`, `/pista/evento/*`, `/pista/sesion/*` | pista (tracks, drag, drift) | QuickAction Pista, Más | 1 / 2 / 3 | ★ sesión |

### Social y cuenta
| Ruta | Función | Entradas | Toques | |
|------|---------|----------|--------|--|
| `/comunidad`, `/perfil`, `/u/[handle]` | amigos, seguidores, perfil propio y público | Más → Comunidad; cabecera de Más → perfil | 2 / 2 / 3 | ★ perfil público |
| `/juntes`, `/juntes/nuevo`, `/juntes/[id]`, `/junte/[code]` | juntes con mapa en vivo | Más → Juntes; enlace `/j/…` | 2 / 3 / 3 / enlace | ★ |
| `/cuenta`, `/nueva-contrasena`, `/borrar-cuenta` | cuenta, restablecer, borrar | tarjeta de Inicio, Más / correo / Cuenta → Borrar | 1–2 / enlace / 3 | |
| `/notificaciones` | hora y permiso de recordatorios | Más | 2 | |
| `/bienvenida`, `/onboarding` | tutorial / primer uso | Más ("Ver bienvenida") / automático | 2 / — | |
| `/instalar`, `/versiones`, `/legal`, `/legal/[doc]`, `/apoyar`, `/comentario` | instalar PWA/APK, novedades, legal, apoyar, comentarios | Inicio (instalar), Más | 1–3 | `/legal/[doc]` ★ |
| `/admin/*` (6 pantallas) | administración (solo admin) | Más → Admin | 2–3 | n/a |
| `/dev/tokens` | galería de diseño (solo dev) | — | — | n/a |

## Resumen (para PROMPT-04)
- **Rutas con pantalla**: 101 (incluye las 7 de admin y se excluye la galería dev); sin admin ≈ 94.
- **Escondidas (★ ≥ 3 toques o un solo camino): 19 funciones** — reparación nueva, mejora, plantillas de chequeo, editar vehículo, álbum (+ estado + importar), visor de foto, eventos, aros/gomas, ficha, fluidos, libro, miembros, publicar viaje, ajustes de viajes, permisos de viajes, sesión de pista, perfil público, juntes (nuevo/detalle), legal doc.
- **Enterradas (◆)**: **OBD** (la de la nota N6a) y, con la misma condición, **Contactos** (ambos en el bloque `FEATURE_DIY` de Más).
- Mayor deuda: **registrar una reparación** (3 toques, un solo camino real), **OBD** (sin testigo ni atajo), **Ficha/Fluidos** (4), **Libro/Compartir** (3), **Permisos de viajes** (3–4, y no existe pantalla general de permisos).
- Ninguna función de las ≥ 3 toques tiene atajo en Inicio ni en el hub del vehículo, salvo Build y Pista.

## Testigos de la tira de Inicio (`TelltaleRow`, N6a)
Hoy hay **7 testigos**, todos **tocables** (`lamp.onPress`, `components/ui/TelltaleRow.tsx:112-113`):
| Testigo | Fuente (`LAMP_SOURCES`, `lib/domain/garage.ts:176-183`; combustible en `index.tsx:261`) | Al tocar |
|---------|-----------------|----------|
| Aceite | recordatorios `aceite_motor` | `/recordatorios` |
| Refrigerante | `refrigerante`, `mangueras` | `/recordatorios` |
| Gomas | `rotacion_gomas`, `cambio_gomas`, `alineacion`, `balanceo` | `/recordatorios` |
| Batería | `bateria` | `/recordatorios` |
| Marbete y seguro | legales | `/recordatorios` |
| Chequeo semanal | último chequeo (próximo > 7 d, urgente > 14 d o con fallas) | `/chequeo` |
| Combustible | `tank` (estimación del tanque) | `/carga/nueva` |
**Faltan**: testigo de **check engine / OBD** (no existe; N6a pide que OBD tenga un testigo), de **reparación pendiente** (eventos con `pending`), y de **permisos** (ubicación/notificaciones faltantes). Los cinco primeros llevan todos a la misma lista (`/recordatorios`) en vez de al recordatorio de su ítem.

## X4 — pestañas del vehículo cortadas
`app/vehiculo/[id].tsx:314` pinta 8 pestañas en un `ScrollView` horizontal (`TABS` :75-84); a 390 px "FICHA" queda a medias y **Pista, Viajes y Docs quedan fuera de pantalla** sin pista visual de que se puede deslizar (sin degradado ni flecha). Confirmado por lectura y por la captura 11:12 de Xaviel; no se reprodujo en el navegador porque requiere un vehículo con datos (se verifica en la fase 4 con `lib/dev/garage.ts`). Fix: selector de sección (`SelectField`/hoja "Ir a…") + degradado en el borde, o 2 filas.

## Banderas que esconden funciones
`FEATURE_LEGAL = false` (`lib/flagsV8.ts:18`) pero Más sigue mostrando "Legal" y `/legal` existe: revisar en la fase 4 si es intencional. `FEATURE_JUNTE_CHAT = false`: el chat no está (esperado).

## Después de la fase 4 (2026-10-17) — toques desde Inicio

**Cómo se midió.** La estructura manda: Inicio → botón **Herramientas** (1) → la función (2); el hub se dibuja desde el registro, así que toda función registrada y activa está a 2 toques (la prueba `registry.test.ts › depth from Inicio` lo comprueba sobre el código de Inicio, Más y el hub). El flujo hub → búsqueda → función y el de "sin carro" se recorrieron en Chromium (390 px, UA de iPhone) y con un carro creado en la propia app el hub del vehículo a 320/360/390 px; ver `screens/f4-*.png`. No hay un script que cuente toques por cada función con datos reales: lo que dependa de un dato (un código OBD guardado, un permiso) se prueba por componente.

| Función | Antes | Después | Cómo |
|---------|-------|---------|------|
| Diagnóstico OBD | 2 (enterrada) | **1** con el testigo CHECK · **2** hub/lupa · atajo en el vehículo | testigo + fila destacada + atajo |
| Registrar reparación | 3 (un camino) | **2** | hub (destacada) · atajo del vehículo · testigo Batería |
| Registrar echada | 1 | 1 | atajo de Inicio · testigo Combustible |
| Iniciar viaje / Conducir | 1 | 1 | botón central |
| Registrar servicio, gasto | 2 | 2 | hub |
| Registrar evento | 3 | **2** | hub · atajo · testigo Refrigerante |
| Registrar mod | 2 | 2 | hub · atajo |
| Agregar fotos | 3 | **2** | hub · atajo |
| Álbum, Eventos | 3 | **2** | hub |
| Build | 1 | 1 | atajo de Inicio |
| Ficha técnica | 3 | **2** | hub |
| Guía de fluidos | 4 | **2** | hub (función propia) |
| Editar el carro | 3 | **2** | hub (función propia) |
| Miembros del garaje | 3 | **2** | hub (función propia) |
| Libro del carro | 3 | **2** | hub |
| Compartir el carro | 2–3 | **2** | hub |
| Ajustes de viajes | 3 | **2** | hub (función propia) |
| Viajes, Juntes, Comunidad, Precios, Tareas, Contactos, Documentos, Notificaciones, Versiones, Legal, Apoyar, Comentarios, Cuenta, Permisos, Bienvenida, Instalar | 1–2 | 1–2 | hub (2) y sus entradas de siempre |
| Chequeo semanal, Recordatorios, Cifras, Pista, Odómetro | 1 | 1 | Inicio / testigos |

**Escondidas que dejaron de serlo:** reparación nueva, evento, fotos, álbum/eventos, ficha, fluidos, editar vehículo, miembros, libro, ajustes de viajes (las 10 ≥ 3 toques o de un solo camino que son funciones; todas a 2). **Siguen siendo pantallas internas** (no funciones: se llega a ellas desde la función): detalle de un registro, plantillas del chequeo (dentro de Chequeo), un set de aros o una goma (dentro de Build), publicar un viaje (dentro del viaje), perfil público (enlace). Quedan a 3 toques o más **por ser detalle de algo**, no por estar escondidas.
