# Costos de la IA — estimación (NO medida)

**Aviso honesto:** ninguna llamada a un modelo real se ha medido todavía (falta la cuenta de prueba para `tools/smoke-ai.mjs` y `evals/ai/run.mjs`). Esta tabla es una **proyección** con los precios de `supabase/functions/_shared/cost.ts` (verificados el 2026-11-03) y tamaños de llamada **supuestos**. Cuando corran los evals, el costo real sale de `ai_usage.cost_usd` y esta tabla se reemplaza por los números medidos.

Precios (USD por millón de tokens): Haiku 5.5 `0.10 / 0.50` (≤ 100k tokens de entrada) · Sonnet 5.5 `2 / 10` · STT: ~0.003 USD por minuto de audio (gpt-4o-mini-transcribe; Groq ~0.0007).

## Por llamada (supuestos entre paréntesis)
| Función | Modelo | Entrada (supuesto) | Salida (supuesto) | USD por llamada |
|---|---|---|---|---|
| Leer foto de bomba / recibo / documento | Haiku 5.5 (visión) | ~1,500 por imagen + ~600 de instrucciones | ~400 | **≈ 0.0004** |
| Captura rápida / express (texto → campos) | Haiku 5.5 | ~800 | ~200 | ≈ 0.0002 |
| Nota de voz → campos | STT + Haiku 5.5 | 30 s de audio + ~800 | ~200 | ≈ 0.0015 + 0.0002 = **≈ 0.0017** |
| Triage de un código OBD / síntoma | Sonnet 5.5 | ~3,000 | ~800 | **≈ 0.014** |
| Insights / predicción (texto sobre el historial) | Sonnet 5.5 | ~4,000 | ~600 | ≈ 0.014 |
| Reporte de venta | Sonnet 5.5 | ~3,500 | ~700 | ≈ 0.014 |

## Un mes de uso (escenarios, mismos supuestos)
| Perfil | Uso mensual | USD / mes |
|---|---|---|
| Ligero | 4 fotos + 2 voces + 1 triage | ≈ 0.02 |
| Normal | 12 fotos + 6 voces + 3 triages + 2 insights | ≈ 0.09 |
| Intenso | 40 fotos + 20 voces + 10 triages + 8 insights | ≈ 0.31 |

Los topes por usuario y globales del gateway (`serveAi`: interruptor, consentimiento, topes diarios/mensuales; `sql/042`, `044`) limitan el peor caso aunque la proyección falle. Un modelo desconocido se cobra al precio más caro (`MOST_EXPENSIVE`), así que un error de configuración solo sobrecuenta.

## Qué falta para volverla una medición
1. Cuenta de prueba (`SMOKE_EMAIL`/`SMOKE_PASSWORD`) y clave de STT.
2. `node tools/smoke-ai.mjs` y `node evals/ai/run.mjs` contra las funciones desplegadas.
3. `SELECT function, count(*), avg(cost_usd), sum(cost_usd) FROM ai_usage GROUP BY 1` en x-core y comparar con esta tabla.
