# UX audit — PROMPT-12 (SPEC-K §K0)

Medido con `evals/ux/audit.mjs` (Playwright, garaje sembrado, red simulada). **Tocable** = elemento visible y no anidado que responde a un toque (botón, enlace, campo, interruptor). "Primarios" = botones con relleno de color. Las cifras "antes" son del commit anterior a PROMPT-12 (`ux-audit-before.json`); las "después" de `ux-audit-after.json`. Lo que **no** mide: cuánto entiende una persona. Eso lo prueba `COLD-START-TEST.md`.

## Antes → después (teléfono 390×844)
| Pantalla | Tocables sobre el pliegue | Tocables en total | Botones primarios | Encabezados |
|---|---|---|---|---|
| Inicio → Hoy | 24 → 20 (−4) | 42 → 30 (−12) | 2 → 2 | 1 → 1 |
| Garaje | 15 → 15 | 15 → 15 | 1 → 1 | 0 → 0 |
| Historial | 13 → 13 | 26 → 26 | 1 → 1 | 13 → 13 |
| Más | 13 → 16 (+3) | 45 → 30 (−15) | 2 → 0 | 15 → 1 |
| Todas las funciones (antes Herramientas) | 10 → 10 | 49 → 49 | 0 → 0 | 2 → 2 |
| Mi carro (ficha del vehículo) | 9 → 9 | 38 → 36 (−2) | 2 → 2 | 2 → 3 |
| Viajes | 8 → 8 | 8 → 8 | 0 → 0 | 2 → 2 |
| Conducir | 10 → 10 | 11 → 11 | 1 → 1 | 1 → 1 |
| Cifras | 10 → 10 | 17 → 17 | 2 → 2 | 2 → 2 |
| Formulario: gasolina | 9 → 9 | 34 → 12 (−22) | 1 → 1 | 1 → 1 |
| Formulario: servicio | 16 → 16 | 46 → 43 (−3) | 1 → 1 | 2 → 2 |
| Formulario: gasto | 18 → 17 (−1) | 20 → 17 (−3) | 2 → 2 | 1 → 1 |
| Formulario: recordatorio | 11 → 11 | 13 → 14 (+1) | 1 → 1 | 1 → 1 |

## Antes → después (escritorio 1280×800)
| Pantalla | Tocables sobre el pliegue | Tocables en total | Botones primarios | Encabezados |
|---|---|---|---|---|
| Inicio → Hoy | 37 → 36 (−1) | 48 → 36 (−12) | 2 → 2 | 1 → 1 |
| Garaje | 21 → 21 | 21 → 21 | 1 → 1 | 0 → 0 |
| Historial | 19 → 19 | 32 → 32 | 1 → 1 | 13 → 13 |
| Más | 19 → 22 (+3) | 51 → 36 (−15) | 2 → 0 | 15 → 1 |
| Todas las funciones (antes Herramientas) | 21 → 21 | 60 → 60 | 0 → 0 | 2 → 2 |
| Mi carro (ficha del vehículo) | 20 → 20 | 54 → 52 (−2) | 2 → 2 | 2 → 3 |
| Viajes | 17 → 17 | 19 → 19 | 0 → 0 | 2 → 2 |
| Conducir | 22 → 22 | 22 → 22 | 1 → 1 | 1 → 1 |
| Cifras | 21 → 21 | 28 → 28 | 2 → 2 | 2 → 2 |
| Formulario: gasolina | 20 → 20 | 45 → 23 (−22) | 1 → 1 | 1 → 1 |
| Formulario: servicio | 39 → 39 | 57 → 54 (−3) | 1 → 1 | 2 → 2 |
| Formulario: gasto | 29 → 28 (−1) | 31 → 28 (−3) | 2 → 2 | 1 → 1 |
| Formulario: recordatorio | 22 → 22 | 24 → 25 (+1) | 1 → 1 | 1 → 1 |

Lectura honesta:
- **Se redujo** donde había una pared de elementos: Inicio (42 → 30 tocables, 24 → 20 sobre el pliegue), Más (45 → 30, 15 encabezados → 1 con grupos plegables), el formulario de gasolina (34 → 12), el de gasto (20 → 17) y, poco, la ficha del carro (38 → 36: se agregaron 8 filas de «Mi carro» y el resumen anterior quedó plegado en «Detalles del carro»).
- **Casi no cambió** el formulario de servicio (46 → 43): la auditoría mide el modo «servicio» por defecto, cuyo primer nivel (fecha, kilómetros, qué se hizo, costos) es lo que se pidió; lo plegado es taller, garantía, piezas y fotos. El modo «reparación» también se reorganizó pero esta auditoría no lo mide. En escritorio hay más espacio y los cambios son menores.
- Los **botones primarios** (relleno de color, por heurística) en Hoy: 2 → 2. No baja el número, pero ahora uno de ellos es *el* siguiente paso. Más pasó de 2 a 0 (el botón «Agregar vehículo» y el de respaldo dejaron de ser rellenos).

## Los 15 quehaceres (toques desde el arranque, Hoy)
«Antes» sale de leer el código anterior (no se midió en navegador), «ahora» lo mide `evals/ux/tasks.mjs` (23/23 en 390 y en 1280).

| # | Quehacer | Antes | Ahora | Camino ahora | Meta |
|---|---|---|---|---|---|
| 1 | Cargar gasolina | 1 | 1 | Hoy → «Cargar gasolina» | ≤ 2 |
| 2 | Iniciar un viaje | 1 | 1 | Hoy → «Iniciar viaje» | ≤ 2 |
| 3 | Ver mis viajes | 2 | 2 | CONDUCIR → «Ver viajes →» | ≤ 2 |
| 4 | Registrar un servicio | 2 (la ficha cambiaba el 3.er mosaico por «Build») | 1 | Hoy → «Registrar servicio» | ≤ 2 |
| 5 | Registrar una reparación | 1 (mosaico «Reparación») | 2 | Hoy → «Todo lo demás» → «Registrar reparación» | ≤ 2 |
| 6 | Ver cuánto gasté este mes | 1 (Cifras; la tira del mes no se tocaba) | 1 | Hoy → «Este mes» | ≤ 2 |
| 7 | Poner un recordatorio (marbete) | 2 | 2 | Hoy → tablero → «Nuevo recordatorio» | ≤ 2 |
| 8 | Guardar un documento | 2 | 2 | Hoy → luz «Marbete y seguro» → «Nuevo documento» | ≤ 2 |
| 9 | Ver el último kilometraje | 0 | 0 | Está en Hoy | ≤ 3 |
| 10 | Ver estadísticas | 1 | 1 | Hoy → «Este mes» | ≤ 3 |
| 11 | Agregar una modificación | 3 | 2 | Hoy → «Todo lo demás» → «Agregar modificación» | ≤ 3 |
| 12 | Subir fotos | 3 | 2 | Hoy → «Todo lo demás» → «Agregar fotos» | ≤ 3 |
| 13 | Ver el resumen del mes | 1 | 1 | Hoy → «Este mes» | ≤ 3 |
| 14 | Compartir mi garaje | 2–3 (fila perdida en una lista larga) | 3 | Hoy → «Todo lo demás» → «Mi carro» → «Compartir» | ≤ 3 |
| 15 | Escanear un código OBD | 1 | 1 | Hoy → luz «Check engine» | ≤ 3 |

Casi todos ya estaban en 1–2 toques: **el problema que describió Xaviel no era de toques, era de encontrar y de entender** (45 filas en Más, 6 mosaicos, textos como «echada» o «OBD»). Por eso lo que cuenta es la prueba en frío. Búsqueda: «gasolina» → función en 2 toques (lupa, resultado), escribiendo; el buscador ahora entiende frases (`__tests__/features/search-tasks.test.ts`: 13 quehaceres con 2–5 formas de decirlos).

Palabras que no coincidían (etiqueta vs. lo que diría la persona): «Registrar echada» → **Cargar gasolina**; «Diagnóstico OBD» → **Códigos del motor (OBD)**; «Actualizar odómetro» → **Actualizar kilometraje**; «Registrar mod» → **Agregar modificación**; «Inicio» → **Hoy**; «Herramientas» → **Todas las funciones**. «Echada» y «odómetro» siguen como palabras de búsqueda.

## Inventario de Inicio: dónde quedó cada bloque
| Bloque de Inicio (antes) | Ahora |
|---|---|
| Eyebrow + título «Inicio» + kana 車 | Título «Hoy» |
| Pastilla «Instalar» | Actividad (fila, solo si hay oferta) |
| SyncPill | Cabecera (igual) |
| Botón Herramientas (apps) | **Quitado: duplicado** de «Todo lo demás» / pestaña Más |
| Lupa de búsqueda | Cabecera → abre Más con la búsqueda enfocada |
| Avatar (cuenta) | Cabecera (igual) |
| Fila «Dictar» | Botón de micrófono en la cabecera |
| QueueNotice (fotos en cola) | Igual (solo aparece si hay algo) |
| Chips de carros + «Agregar» | Chips solo con más de un carro; «Agregar vehículo» vive en Garaje y Más → Garaje y catálogo |
| Aviso de viaje (tripNotice) | Igual (transitorio) |
| Tablero (velocidad en vivo / cluster + luces) | Igual, debajo de las acciones en teléfono; a la izquierda en escritorio |
| TipCard «odómetro» | Actividad |
| UpdateBanner | Igual (solo si hay actualización) |
| AutoBlockedCard | Igual (solo si bloqueado) |
| Fila «Iniciar viaje» | Botón grande «Iniciar viaje» |
| Pendientes (2 recordatorios/tareas) | Siguiente paso (el más urgente) + Actividad (lista de 2 + «Ver todos») |
| Aviso de marbete | Actividad |
| Tarjeta «Crea tu cuenta» | Actividad |
| CarHealth (insights de IA) | Actividad |
| HomeNudge («Descubre») | Actividad |
| Cuadrícula de 6 mosaicos (Gasolina, Chequeo, Build/Servicio, Pista/Gasto, Reparación, Cifras) | 3 acciones grandes + «Todo lo demás» (Más); Cifras = la tira «Este mes» |
| Tira del mes (3 números) | «Este mes» (3 números), ahora tocable → Cifras |
| Insight de rendimiento | Actividad |
| Último tanque | Actividad |
| — (nuevo) | Siguiente paso, Primeros pasos (en Actividad), «¿Quieres ver solo lo que usas?» |

## Duplicados quitados
- Botón Herramientas en la cabecera de Inicio (queda Más → «Todas las funciones»).
- En Más: filas que repetían funciones del registro (Chequeo, Servicio, Historial de mantenimiento, Recordatorios, Tareas, Gasolina, Gasto, Precios, Contactos, OBD, Pista, Viajes, Compartir, Documentos, Cuenta, Comunidad, Juntes, Notificaciones, Permisos, Bienvenida, Instalar, Legal, Versiones, Comentario, Apoyar): ahora salen una sola vez, de la misma fuente que «Todas las funciones» (el registro).
- La fila «Dictar» suelta (ahora icono de micrófono).
- Seguir alcanzables, no quitados: catálogo, guía del chequeo, código de invitación, copia/restauración/borrado, apariencia e idioma, repetir consejos, administración (todos en Más → grupos plegables).

## Decisiones del registro (ADR-73): `group` y `level`
Siete temas «Qué quiero ver» + `basics` (siempre visible): **fuel_expenses** (fuel, expense, prices, stats) · **maintenance** (service, repair, repairs, tasks, contacts, check, obd, fluids) · **documents** (docs, reminders, book) · **trips** (trip, trips, tripsettings) · **project** (mod, build, photo, album, event, events) · **track** · **community** (community, juntes, share, members) · **basics** (garage, editvehicle, odometer, ficha, account, notifications, permissions, welcome, install, versions, legal, support, feedback).
`level`: *core* = lo que todos necesitan (gasolina, gasto, servicio, reparación, documentos, recordatorios, viajes, garaje, cifras…); *advanced* = OBD, fluidos, ajustes de viaje, pista, eventos, comunidad, juntes, libro, bienvenida, versiones. Quien nunca contestó ve **todo** (no cambia nada para usuarios existentes); «Qué quiero ver» solo cambia qué es prominente, nada se borra y todo sigue en «Todas las funciones» y en la búsqueda. La sugerencia usa lo abierto/registrado en los últimos 60 días.

## Glosario es-DO (pantallas tocadas)
| Antes | Ahora | Por qué |
|---|---|---|
| Registrar echada | Cargar gasolina | Es lo que la gente dice |
| Diagnóstico OBD | Códigos del motor (OBD) | Sin sigla suelta |
| Actualizar odómetro | Actualizar kilometraje | Palabra cotidiana |
| Registrar mod | Agregar modificación | Sin jerga |
| Inicio | Hoy | Responde «¿qué hago hoy?» |
| Herramientas | Todas las funciones | Dice lo que es |
| Pendientes | Siguiente paso / Actividad | Una sola cosa a la vez |
| Más detalles (nuevo) | — | Nivel 2 de cada formulario |

## Accesibilidad (axe, WCAG 2 A/AA, sin contraste)
Hoy, Mi carro y Más sin violaciones serias o críticas. Encontró y se arreglaron tres problemas **que ya existían**: la barra de pestañas web usaba `role="tab"` sin `tablist` (crítico; ahora es una navegación de enlaces con `aria-current` en web y sigue siendo pestañas en nativo), una `list` sin elementos de lista en la fila de atajos de Mi carro, y **la página web no tenía `<title>`** (ahora «Hoy · Car Guy», etc.). El contraste de color **no** se midió con axe (la rutina de contraste del tema ya lo cubre en `lib/theme/contrast.ts`).

## Qué NO se hizo (con su motivo)
- El asistente de viajes automáticos de PROMPT-09 y `recapReady()` de PROMPT-11 no existen todavía: el siguiente paso «resumen listo» y «salud de detección» están conectados pero reciben `null`.
- Autoguardado de borradores de los formularios: **no se construyó**; los formularios ya conservan lo escrito mientras la pantalla está abierta y los borradores de IA existen, pero salir de un formulario aún pierde lo escrito. Queda como pendiente.
- Los mensajes de validación de los formularios no se reescribieron uno por uno; se conservaron los existentes.
- Pantallas que no se tocaron: Garaje (tarjetas), Historial, Viajes, Conducir, Cifras.
