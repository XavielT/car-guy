# Prueba en frío — «¿sé por dónde empezar?» (SPEC-K §K8)

Esta es la prueba que importa. Los números de `ux-audit.md` dicen que hay menos cosas en pantalla y menos toques; **solo esta prueba dice si una persona entiende la app**. Tu frase fue el criterio de aceptación: *«yo mismo no sé por dónde empezar ni dónde encontrar o hacer algo»*. Si tú (que la construiste) abres la app en frío y sabes qué tocar, pasó.

## Qué necesitas
- Un teléfono con la app **recién instalada** (APK o la web en una ventana privada), sin datos. Para no empezar de cero cada vez: borra los datos de la app o usa otro perfil del navegador.
- **3 personas que no conocen la app** (amigos, familia; que manejen un carro). Si una conduce y otra no, mejor.
- Un cronómetro y la hoja de abajo (impresa o en notas).

## Cómo se hace
1. Entrégales el teléfono con la app abierta. Diles solo esto: *«Es una app para llevar el carro. Quiero ver qué haces con ella. No te voy a ayudar: piensa en voz alta. Si no sabes qué tocar, dilo.»*
2. **No hables, no señales, no expliques.** Si se atascan más de 3 minutos, anota «no pudo» y pasa a la siguiente tarea (puedes decir «seguimos con la otra»).
3. Una tarea a la vez, leída tal cual. Cronometra desde que la lees hasta que la persona dice «ya».
4. Anota **toques equivocados** (tocó algo que no era), **dudas** (se quedó mirando más de 5 s) y **frases textuales**.

## Las 5 tareas
| # | Lo que le dices | Qué cuenta como hecho |
|---|---|---|
| T1 | «Agrega tu carro (inventa uno).» | El carro aparece en Hoy |
| T2 | «Anota que acabas de echar gasolina: 8 galones, 2,500 pesos.» | Aparece la carga en el historial o en «Última carga» |
| T3 | «Empieza un viaje.» | El tablero de velocidad en vivo, o el permiso de ubicación pedido con una explicación |
| T4 | «¿Cuánto has gastado este mes?» | Ve el gasto del mes (Hoy → «Este mes» o Cifras) |
| T5 | «Pon un recordatorio para el marbete.» | El recordatorio queda creado |

**Meta**: las 5 sin ayuda y **< 3 minutos cada una**, en al menos 2 de las 3 personas. Una tarea que falla en 2 o más personas es un defecto (se arregla en la misma ronda si es barato, si no queda anotado).

## Hoja de registro (una por persona)
Persona: ______________  Edad: ____  ¿Conduce? ____  ¿Usa apps de carro/gasolina? ____  Teléfono: ______  Fecha: ________

| Tarea | Tiempo (mm:ss) | ¿Sin ayuda? (sí / no) | Toques equivocados | Dudas (dónde) | Frase textual |
|---|---|---|---|---|---|
| T1 Agregar carro | | | | | |
| T2 Anotar gasolina | | | | | |
| T3 Empezar viaje | | | | | |
| T4 Gasto del mes | | | | | |
| T5 Recordatorio marbete | | | | | |

Preguntas al final (sin explicar nada):
1. ¿Qué te pareció que era lo primero que había que hacer al abrir la app? ____________
2. ¿Hubo algo que buscaste y no encontraste? ¿Qué? ____________
3. ¿Qué palabra de la pantalla no entendiste? ____________
4. En una frase, ¿para qué sirve la app? ____________

## Qué mirar mientras lo hacen
- ¿Tocan **«Siguiente paso»** o las **4 acciones grandes** primero? (esperado)
- ¿Buscan en **Más** y usan el buscador «¿Qué quieres hacer?» o se pierden en los grupos?
- ¿Entienden **«Todo lo demás»**? ¿Entienden **«Más detalles»** en los formularios, o creen que faltan campos?
- ¿Alguien dice «echada», «odómetro» u otra palabra que la app ya no usa pero que sí dice la gente? (alimenta `lib/features/synonyms.ts`)

## Después
Pasa los resultados a `ux-findings.md` (plantilla en la misma carpeta). Cada tarea que falla en ≥ 2 personas = un defecto con una línea de qué arreglar. Repite con otras 3 personas después de los arreglos si hubo varios.
