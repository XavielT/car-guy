# SPEC-C — Funciones a la vista (N6, N6a, X4)

## Problema
Hay funciones que el usuario no encuentra. OBD es el ejemplo: vive en la ficha/DIY detrás de varios toques. En la pestaña del vehículo la tira de pestañas (RESUMEN, ÁLBUM, EVENTOS, BUILD, FICHA…) se corta en el borde y hay secciones fuera de pantalla sin ninguna pista (captura 11:12).

## Lo que ya existe (repo, 2026-10-16)
- OBD: `app/obd/index.tsx` y `app/obd/[code].tsx`; entradas actuales: fila en **Más** (`mas.tsx:202`), "Agregar OBD" en la hoja del FAB de Historial (`historial.tsx:229`), botones en la **Ficha** (`FichaTab.tsx`, `ficha.tsx`). Todo bajo `FEATURE_DIY` (`lib/flags.ts`, hoy `true`). No hay entrada desde Inicio ni desde el hub del vehículo.
- Inicio (`app/(tabs)/index.tsx`): `QuickActions` (cuadrícula de 4 verbos) y `TelltaleRow`, cuyos testigos **ya son tocables** (`lamp.onPress`: recordatorios, chequeo, tareas, combustible). No existe un testigo de check engine/OBD.
- Hub del vehículo (`app/vehiculo/[id].tsx`): `TABS` con resumen, álbum, eventos, build, ficha, pista, viajes, docs en un `ScrollView` horizontal; cada una con su flag.
- Barra inferior (`components/tabbar/CarGuyTabBar.tsx`): botón central CONDUCIR + 4 pestañas (Inicio, Garaje, Historial, Más).
- Muchas rutas bajo `app/` (≈40 carpetas): álbum, carga, catálogo, chequeo, contactos, documentos, evento, foto, garaje, gasto, goma, hito, inspeccion, inventario, junte(s), mod, obd, pista, precios, recordatorio(s), ruedas, servicio, tarea(s), u, vehiculo, viaje(s), wishlist, etc. La mayoría solo se llega por un camino.

## Respuestas de Xaviel
Las cuatro: hub **Herramientas**, **atajos en el vehículo**, **testigos del cluster tocables**, **buscador de funciones**.

## 1. Registro único de funciones (ADR-62)
```ts
interface FeatureDef {
  id: FeatureId;               // 'obd', 'repair', 'fuel', 'trip', 'build', 'album', 'events', ...
  titleKey; descKey;           // es/en: título + una línea de "para qué sirve"
  icon; route; params?;
  section: 'vehiculo' | 'registrar' | 'diagnostico' | 'viajes' | 'cuenta';
  needsVehicle: boolean;
  keywords: { es: string[]; en: string[] };   // sinónimos para el buscador
  badge?: () => string | number | undefined;   // "3 códigos", "Nuevo", "2 pendientes"
  shortcut?: boolean;          // aparece en atajos del vehículo
  telltale?: TelltaleId;       // testigo que lo abre
}
```
Todo lo demás (hub, buscador, atajos, testigos, tips) se alimenta de aquí. **Prueba de guardia**: enumera todas las rutas de la app y falla si alguna no está en el registro (o no está marcada `internal: true` con razón). Así una función nueva no vuelve a quedar escondida.

## 2. Inventario y profundidad de toques (PROMPT-00)
`feature-map.md`: cada función, sus puntos de entrada y los toques desde Inicio. Se marcan "escondidas" las de ≥ 3 toques o con un solo camino. Meta de PROMPT-04: **ninguna a más de 2 toques desde Inicio**, medido otra vez al final (columna "después").

## 3. Hub "Herramientas"
- Entrada: parte superior de **Más** y botón en el encabezado de Inicio (sin añadir una pestaña a la barra: sigue siendo botón central CONDUCIR + 4 pestañas).
- Contenido: buscador arriba; fila destacada con las 3–4 funciones de más valor (Diagnóstico OBD, Registrar reparación, Registrar echada, Iniciar viaje); debajo, tarjetas por sección con ícono, título, una línea y badge de estado. Sin vehículo seleccionado, las funciones que lo necesitan piden elegirlo en un `SelectField`.
- Badge de permisos si falta alguno (enlaza a la pantalla Permisos de SPEC-A).

## 4. Atajos en el vehículo
- Fila de acciones rápidas en el hub del vehículo (arriba de las pestañas): + Reparación, OBD, + Echada, + Evento, + Mod, + Foto (las marcadas `shortcut`). Desplazable con indicador de borde, o dos filas si caben.
- Tira de pestañas (X4): degradado en los bordes que indica que hay más, la pestaña activa se centra al entrar, y un botón "Todas las secciones" que abre un `SelectField` con todas (ninguna sección fuera de alcance).

## 5. Testigos del cluster tocables
Los testigos de `TelltaleRow` ya abren recordatorios, chequeo, tareas y combustible: se revisan y completan. Se agrega un testigo **CHECK** (apagado por defecto; ámbar si el vehículo tiene un código OBD guardado sin resolver) que abre Diagnóstico OBD, y se añade etiqueta hablada y texto breve al mantener presionado. Mapa por defecto (ajusta a los testigos que existan de verdad):
| Testigo | Abre |
|---------|------|
| Check engine | Diagnóstico OBD |
| Aceite | Mantenimiento (cambio de aceite) |
| Temperatura / coolant | Registrar evento (sobrecalentamiento) |
| Combustible / reserva | Registrar echada |
| Batería | Registrar reparación (sistema eléctrico) |
| Presión de gomas | Gomas |
| Freno | Chequeo semanal |
| GPS / REC / PASAJERO | Modo conducir / Viajes |

## 6. Buscador de funciones
Campo en el hub (y ícono de lupa en el encabezado de Inicio). Busca por título, descripción y `keywords` en el idioma activo (sin acentos, tolerante a errores): "luz del tablero", "check engine", "falla", "código", "OBD", "taller", "arreglo", "cambio de aceite", "factura". Resultado → navega directo. Sin resultados: sugiere "Enviar comentario" ("¿No lo encuentras? Cuéntanos").

## 7. OBD en concreto (N6a)
Se llama "Diagnóstico OBD" con subtítulo "Busca el código de la luz del tablero (P0300…)"; vive en la fila destacada del hub, en atajos del vehículo y en el testigo de check engine. Aviso de primera vez (burbuja o tarjeta descartable): "¿Se prendió una luz? Aquí buscas qué significa". Los estados vacíos de otras pantallas (Eventos, Pendientes) enlazan a OBD cuando aplica.

## 8. "Descubre"
Una tarjeta descartable en Inicio que muestra, de a una, una función que el usuario nunca ha usado (según el registro y el uso local); descartar persiste. Tras actualizar, un tour de 2 pasos señala el hub Herramientas (reutiliza Novedades).

## Pruebas
Guardia de registro vs rutas; buscador (acentos, sinónimos es/en); atajos presentes y navegan; tira de pestañas con desbordamiento (captura 390 px) y selector "Todas las secciones"; cada testigo abre su destino; profundidad ≤ 2 medida por script de navegación; capturas.
