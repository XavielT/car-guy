# PROMPT-04 — Funciones a la vista: Herramientas, atajos, testigos y buscador

Continúas el ciclo IMP 16102026. Lee `00-context/BRIEF.md` (reglas permanentes), `00-context/NOTAS-ORIGINALES.md`, `02-specs/SPEC-C-descubrir-funciones.md` y `feature-map.md`. **Nada espera una decisión**: default recomendado, registrarlo en `PROGRESS.md`, seguir. Todas las selecciones nuevas usan `SelectField` (fase 3).

## Punto de partida (ya en el repo)
OBD vive en `app/obd/` con entradas en Más, el FAB de Historial y la Ficha (todo tras `FEATURE_DIY`). `TelltaleRow` ya tiene testigos tocables (recordatorios, chequeo, tareas, combustible) pero ningún testigo de OBD; `QuickActions` es la cuadrícula de Inicio; las pestañas del vehículo son `TABS` en `app/vehiculo/[id].tsx`. Hay ≈40 carpetas de rutas bajo `app/`.

## Alcance (N6, N6a, X4)
Respuestas de Xaviel: las cuatro — hub Herramientas, atajos en el vehículo, testigos tocables, buscador.

1. **Registro único de funciones (ADR-62)**: `FeatureDef` como SPEC-C; registra **todas** las funciones del `feature-map.md` (incluye OBD, Reparaciones aunque la fase 5 aún no exista: déjala registrada con ruta pendiente y `hidden:true` hasta que llegue, y la fase 5 la activa). **Prueba de guardia**: enumera las rutas y falla si alguna no está en el registro (o no está marcada `internal` con motivo).
2. **Hub "Herramientas"**: entrada arriba de **Más** y botón en el encabezado de Inicio (sin tocar la barra: botón central CONDUCIR + 4 pestañas). Buscador arriba; fila destacada (Diagnóstico OBD, Registrar reparación, Registrar echada, Iniciar viaje); tarjetas por sección con ícono, título, una línea de "para qué sirve" y badge de estado. Si la función necesita vehículo y no hay uno elegido, pide elegirlo con `SelectField`. Badge si falta algún permiso (enlaza a Permisos de la fase 2).
3. **Atajos en el vehículo**: fila de acciones rápidas sobre las pestañas (+ Reparación, OBD, + Echada, + Evento, + Mod, + Foto; las marcadas `shortcut`), desplazable con indicador de borde.
4. **Tira de pestañas (X4)**: degradado en bordes cuando hay más, la pestaña activa se centra al entrar, y botón "Todas las secciones" que abre un `SelectField` con todas; ninguna sección queda fuera de alcance. Verifica a 320/360/390 px.
5. **Testigos tocables**: revisa los testigos de `TelltaleRow` (ya tocables) contra la tabla de SPEC-C, completa los que falten, con etiqueta hablada y texto breve al mantener presionado. **Nuevo testigo CHECK**: apagado por defecto, ámbar si el vehículo tiene un código OBD guardado sin resolver; abre Diagnóstico OBD.
6. **Buscador de funciones**: en el hub y como lupa en Inicio; busca por título, descripción y `keywords` es/en sin acentos y tolerante a errores ("luz del tablero", "check engine", "falla", "código", "OBD", "taller", "arreglo", "cambio de aceite", "factura"); navega directo; sin resultados ofrece "Enviar comentario".
7. **OBD (N6a)**: título "Diagnóstico OBD", subtítulo "Busca el código de la luz del tablero (P0300…)"; en la fila destacada, en atajos y en el testigo; aviso de primera vez descartable ("¿Se prendió una luz? Aquí buscas qué significa"); los estados vacíos de Eventos y Pendientes enlazan a OBD cuando aplica.
8. **"Descubre"**: tarjeta descartable en Inicio con una función que el usuario nunca ha usado (descartar persiste); tras actualizar, tour de 2 pasos que señala Herramientas (reutiliza Novedades).
9. **Medición**: script de navegación que cuenta toques desde Inicio a cada función; actualiza la columna "después" de `feature-map.md`. **Meta: ninguna a más de 2 toques.** Lo que no cumpla se arregla aquí, no se reporta como pendiente.
10. **Pruebas**: guardia registro-vs-rutas; buscador (acentos, sinónimos es/en); atajos presentes y navegan; pestañas con desbordamiento (captura 390 px) y "Todas las secciones"; cada testigo abre su destino; i18n es/en; skeleton gemelo del hub; capturas.
11. **Docs y release**: ADR-62, Novedades es/en, `PROGRESS.md`, release con el script del repo.

## Criterios de aceptación
Todas las funciones ≤ 2 toques desde Inicio (medido); OBD visible en tres lugares; hub, atajos, testigos y buscador funcionan; la prueba de guardia impide funciones sin registrar; ninguna pestaña del vehículo queda cortada sin pista.

## Reporte final
Tabla antes/después de toques por función, qué funciones estaban escondidas, y la versión publicada.
