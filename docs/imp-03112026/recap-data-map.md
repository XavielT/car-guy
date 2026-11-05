# Recaps — qué dato alimenta cada tarjeta (PROMPT-11, SPEC-J)

`buildRecap(input, period, scope, today)` (`lib/domain/recap.ts`) es una función pura: no toca la base, no genera texto, no guarda nada. `lib/db/recapQueries.ts` lee una sola vez lo que necesita; `lib/recap/copy.ts` pone las palabras (es/en, plantillas con plurales); `lib/domain/recapShare.ts` decide qué puede salir en una imagen.

| Tarjeta | De dónde sale | Misma cifra que | Se omite cuando |
|---|---|---|---|
| Portada | km del período, nombre(s) del carro | Tarjeta de distancia | nunca (es el marco); sin km muestra «Un mes tranquilo» |
| Distancia y tiempo | km = distancia por odómetro (`distanceInRange`, igual que **Cifras**); si no hay lecturas, suma de viajes. Viajes, horas, viaje más largo, día de más movimiento: tabla `trip` (solo los terminados) | Cifras (km), detalle del viaje | no hay km ni viajes |
| Velocidad | `max_kmh` y `avg_moving_kmh` guardados en cada viaje (los del **SpeedEngine**, PROMPT-10), promedio ponderado por tiempo en movimiento | Detalle del viaje | ningún viaje con velocidad |
| Combustible | `fuel_log` del período (unidades de la persona); rendimiento = `computeEconomy` (solo de tanque lleno a tanque lleno, la cadena se rompe con «se me olvidó una carga»), combinado como km totales ÷ volumen total | Hoy / Cifras | no hay cargas; sin dos tanques llenos dice que hacen falta, no inventa un número |
| Lo que costó | `spendRows` (cargas + servicios + gastos, las de **Cifras**), `totalSpend`, `spendByCategory`, costo por km = total ÷ km | Cifras | gasto = 0 |
| Cuidado | `service_record` del período (servicios y reparaciones); recordatorios vencidos y documentos que vencen en 60 días **solo en el período en curso** (son «ahora», no historia) | Recordatorios | todo en 0 |
| Mi proyecto | `mod` con fecha de instalación en el período y su costo (piezas + mano de obra + envío + aduana) | Build | no hay mods |
| Frente al período anterior | los mismos números del período anterior; cada delta solo si **ese** dato existe en ambos; `delta()` de Cifras (neutral, sin juicio) | Cifras (deltas) | el período anterior no tiene datos |
| Mes a mes (año) | km por mes con la regla de Cifras: cada hueco entre lecturas va al mes de la **lectura posterior** (`distancePerMonth`); gasto por mes de `spendRows`. Cada barra abre el resumen de ese mes | Gráfica de barras de Cifras | no hay nada en el año |
| Odómetro (año, un carro) | primera y última lectura del año | Odómetro | varios carros, o < 2 lecturas |
| Tu garaje (año, varios carros) | km y gasto por carro; el que más se manejó | Cifras por carro | solo un carro con datos |
| Cierre | un número para recordar: km, o viajes, o velocidad máxima; nunca un cero | — | no hay nada que decir |

## Reglas que se cumplen y están probadas (`__tests__/domain/recap.test.ts`)
Vacío (solo portada, nunca «0 km») · delgado · normal · varios carros · año · límites de mes en **fecha local** (23:59 del último día dentro, 00:00 del siguiente fuera; días de cambio de hora; enero compara con diciembre del año anterior) · los totales de las tarjetas **son** los de Cifras (`totalSpend`/`distanceInRange` sobre la misma ventana) · rendimiento solo de tanque lleno a tanque lleno · rendimiento con un tanque parcial en medio · un año grande (3,000 cargas, 8,000 gastos, 6,000 lecturas, 2,000 viajes) se arma en ~50 ms en la PC (meta < 300 ms en el Redmi; no se midió en el teléfono).

## Qué decidimos (D-61…)
- **Se arma en JS sobre lecturas ya existentes, no con SQL agregado**: Cifras ya lee todo el gasto y las lecturas en una pasada (`spendRows`, `odometer.list`); un año de datos son miles de filas, no millones, y la prueba de rendimiento da ~50 ms. Si algún día pasa de 300 ms en un teléfono, se agrega la consulta en `statsQueries.ts`.
- **El km de la portada es el del odómetro** (igual que Cifras); los viajes son GPS y pueden diferir, por eso la tarjeta de velocidad dice «GPS».
- **Privacidad por omisión**: la imagen se dibuja solo con `toShareModel`. Nunca incluye placa, chasis, odómetro absoluto, recordatorios o documentos vencidos, lugares exactos, fechas del viaje más largo/del día más movido, ni la foto del carro. Gastos, nombre del carro y tu nombre: apagados por defecto.
- **Imagen**: la misma tarjeta del visor, fuera de pantalla a 1080×1920 (historia) o 1080×1350 (publicación), con `react-native-view-shot` (ya instalado y usado por Pista) y `expo-sharing`; en web baja un PNG. No se agregó ninguna dependencia. Nada se sube.
- **Notificaciones**: se agregan al plan existente (`planRecapNotifications`): las próximas tres veces que sea día 1 a las 9:00 local; el 1 de enero se anuncia el **año** (incluye diciembre). Interruptor en Notificaciones → «Resúmenes» (encendido salvo que se apague; solo suena si las notificaciones están activadas). En web no hay notificaciones locales.
- **Tarjeta en Hoy**: `recapReady(hoy)` (días 1–14) + que el resumen no esté delgado → «Siguiente paso: Tu resumen de octubre está listo» (con «Más tarde» de 24 h del `nextStep`).

## Lo que NO se hizo (con su motivo)
- **Tarjetas de rachas/primeras veces, tarjeta de lugares (J6), «Tu año en una imagen» (collage), PDF anual**: no se hicieron. Lugares y rachas necesitan decisiones de privacidad y datos (agrupar puntos de viaje, detectar casa/trabajo) que merecen su propia ronda; el PDF no cabe en media jornada junto con lo demás.
- Comparación contra «este mes del año pasado» y contra el precio de referencia del MICM: no.
- Fondo con la foto del carro y números que suben (count-up): no; el visor usa fondo oscuro sólido y el número aparece de una vez.
- El diseño del visor en escritorio (tarjeta 9:16 centrada + lista lateral + teclado) se hizo y se probó con teclado en el navegador a 390 px; no se capturó a 1280 px en esta ronda.
- La verificación en el teléfono real (hoja de compartir hacia WhatsApp/Instagram) depende del APK; ver el informe.
