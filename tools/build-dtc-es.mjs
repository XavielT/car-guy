#!/usr/bin/env node
/**
 * Builds the bundled Spanish OBD-II trouble-code table.
 *
 *   node tools/build-dtc-es.mjs
 *
 * Reads  tools/data/obd-trouble-codes.csv  (mytrile/obd-trouble-codes, MIT —
 *        see lib/domain/LICENSE-mytrile.txt)
 *        tools/data/dtc-overrides.json  (hand-written SAE J2012 P0 definitions)
 * Writes lib/domain/dtc.es.json — [{ code, system, descEn, descEs, isGeneric }]
 *
 * No dependencies, no network, no paid translation API: the Spanish text comes
 * from the glossary below, so the output is deterministic and a human can review
 * every rule that produced it. Re-running on the same CSV gives the same bytes.
 *
 * Rules
 * -----
 * system — from the first letter of the code:
 *   P → "motor" (powertrain), B → "carroceria" (body), C → "chasis",
 *   U → "red" (network / communication).
 *
 * isGeneric — SAE J2012 splits every letter into generic and manufacturer
 * ranges by the second character:
 *   P0xxx, P2xxx                    → generic (1)
 *   P1xxx, P3xxx                    → manufacturer (0)
 *     (strictly only P30–P33 are manufacturer and P34–P39 are generic, but
 *      the table has no P3 rows and treating all of P3 as manufacturer is the
 *      safer default for "we do not know what this means for your car")
 *   B0/C0/U0 (and B3/C3/U3)          → generic (1)
 *   B1, B2, C1, C2, U1, U2          → manufacturer (0)
 * lib/domain/dtc.ts implements the same rule so it also answers for codes that
 * are not in the table.
 *
 * descEs — the English description is split into a *subject* and a trailing
 * *condition* ("Mass or Volume Air Flow" + "Circuit Low Input"). Each half is
 * translated with a single-pass, longest-first, case-insensitive, whole-word
 * glossary replacement (single pass, so Spanish output is never re-translated),
 * and the result reads "<sujeto>: <condición>" — Spanish puts the noun first,
 * so this avoids the "Sensor de oxígeno Circuito Falla" word salad a plain
 * word-for-word substitution would give. Unknown words (mostly acronyms such as
 * EGR, VVT, SCP) are left as-is.
 *
 * Source problem and the override layer
 * -------------------------------------
 * The mytrile CSV is misaligned for most generic P0 codes: from about P0126
 * on, descriptions sit one or more codes away from their SAE J2012 meaning
 * (its P0301 says "Random/Multiple…", which is P0300; its P0420 is a secondary
 * air relay; its P0171 is "Fuel Trim Malfunction"). Only P0100–P0125 line up.
 * So:
 *   1. tools/data/dtc-overrides.json holds generic P0 codes whose standard
 *      meaning is well established. Both descEn (SAE wording) and descEs (plain
 *      Spanish) were written by hand from the SAE J2012 definitions — they are
 *      not copied from the CSV and are never glossary-translated. An override
 *      replaces the CSV row, or adds it when the CSV lacks the code.
 *   2. Every CSV row that has an override is compared with it on normalised
 *      keywords, letters, numbers and condition class (low/high/open/…). Runs of
 *      disagreement are reported as "shifted ranges" (widened to the nearest
 *      agreeing code, or the edge of P0).
 *   3. A generic P0 row inside a shifted range with no override keeps its CSV
 *      descEn (so it can be reviewed) but ships with descEs = "Código genérico
 *      — descripción sin verificar (consulta un manual)" instead of wrong text.
 *   Manufacturer rows cannot be checked against anything and are left as-is.
 *   Run with VERBOSE=1 to print every comparison.
 *
 * The script prints the duplicate count, how many rows still contain an English
 * stopword, and the most frequent leftover English-looking words, so the
 * glossary can be grown where it matters.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'tools/data/obd-trouble-codes.csv');
const OUT = join(ROOT, 'lib/domain/dtc.es.json');
const OVERRIDES_SRC = join(ROOT, 'tools/data/dtc-overrides.json');

// ---------------------------------------------------------------------------
// Conditions: the trailing phrase that says *what is wrong*. Matched against the
// end of the description (before any trailing parenthetical), longest first.
// ---------------------------------------------------------------------------
const CONDITIONS = [
  ['Circuit Range/Performance Problem', 'rango/desempeño del circuito'],
  ['Circuit Range/Performance', 'rango/desempeño del circuito'],
  ['Range/Performance Problem', 'problema de rango/desempeño'],
  ['Range/Performance', 'rango/desempeño'],
  ['Circuit Malfunction', 'falla del circuito'],
  ['Circuit Failure', 'falla del circuito'],
  ['Circuit Fault', 'falla del circuito'],
  ['Circuit Low Input', 'señal baja del circuito'],
  ['Circuit High Input', 'señal alta del circuito'],
  ['Circuit Low Voltage', 'voltaje bajo del circuito'],
  ['Circuit High Voltage', 'voltaje alto del circuito'],
  ['Circuit Low', 'circuito bajo'],
  ['Circuit High', 'circuito alto'],
  ['Circuit Intermittent', 'circuito intermitente'],
  ['Circuit Open', 'circuito abierto'],
  ['Circuit Shorted', 'circuito en corto'],
  ['Circuit Short To Ground', 'circuito en corto a tierra'],
  ['Circuit Short To GND', 'circuito en corto a tierra'],
  ['Circuit Short To Battery', 'circuito en corto a batería'],
  ['Circuit Short To Vbatt', 'circuito en corto a batería'],
  ['Circuit Short To Vbat', 'circuito en corto a batería'],
  ['Circuit Short To Power', 'circuito en corto a alimentación'],
  ['Circuit Short', 'circuito en corto'],
  ['Circuit No Activity Detected', 'sin actividad en el circuito'],
  ['Circuit Slow Response', 'respuesta lenta del circuito'],
  ['Circuit Failed', 'falla del circuito'],
  ['Circuit Performance', 'desempeño del circuito'],
  ['Circuit Out Of Range', 'circuito fuera de rango'],
  ['Circuit Stuck', 'circuito pegado'],
  ['Circuit', 'circuito'],
  ['Malfunction', 'falla'],
  ['Failure', 'falla'],
  ['Fault', 'falla'],
  ['Intermittent', 'intermitente'],
  ['Short To Ground', 'corto a tierra'],
  ['Short To GND', 'corto a tierra'],
  ['Short To Battery', 'corto a batería'],
  ['Short To Vbatt', 'corto a batería'],
  ['Short To Vbat', 'corto a batería'],
  ['Shorted', 'en corto'],
  ['Open', 'abierto'],
  ['Stuck Open', 'pegado abierto'],
  ['Stuck Closed', 'pegado cerrado'],
  ['Stuck On', 'pegado encendido'],
  ['Stuck Off', 'pegado apagado'],
  ['Stuck', 'pegado'],
  ['Low Input', 'señal baja'],
  ['High Input', 'señal alta'],
  ['Low Voltage', 'voltaje bajo'],
  ['High Voltage', 'voltaje alto'],
  ['Slow Response', 'respuesta lenta'],
  ['No Activity Detected', 'sin actividad detectada'],
  // Whole-description phrases listed here so the subject/condition split does
  // not break them apart (empty subject → translated as one phrase).
  ['Random/Multiple Cylinder Misfire Detected', ''],
  ['Short To GND Or VBATT', 'corto a tierra o batería'],
  ['Short To Ground Or Battery', 'corto a tierra o batería'],
  ['Short to Battery or Open', 'corto a batería o abierto'],
  ['Short to Ground or Open', 'corto a tierra o abierto'],
  ['Misfire Detected', 'fallo de encendido detectado'],
  ['Leak Detected', 'fuga detectada'],
  ['Not Responding', 'no responde'],
  ['Out Of Range', 'fuera de rango'],
  ['Out Of Calibration', 'fuera de calibración'],
  ['Incorrect Purge Flow', 'flujo de purga incorrecto'],
  ['Efficiency Below Threshold', 'eficiencia bajo el umbral'],
  ['Performance Problem', 'problema de desempeño'],
  ['Performance', 'desempeño'],
  ['Communication Error', 'error de comunicación'],
  ['Condition Detected', 'condición detectada'],
  ['Error', 'error'],
  ['Detected', 'detectado'],
];

// ---------------------------------------------------------------------------
// Glossary: everything else. Longest-first is enforced in code, so order here is
// only for a human reading it. Values are lower-case unless they are acronyms;
// the first letter of the final string is capitalised.
// ---------------------------------------------------------------------------
const GLOSSARY = [
  // --- whole recurring phrases ---------------------------------------------
  ['Random/Multiple Cylinder Misfire Detected', 'fallo de encendido aleatorio/múltiple de cilindros detectado'],
  ['Mass or Volume Air Flow', 'flujo de aire (MAF)'],
  ['Mass Air Flow', 'flujo de aire (MAF)'],
  ['Manifold Absolute Pressure/Barometric Pressure', 'presión absoluta del múltiple/barométrica (MAP/BARO)'],
  ['Manifold Absolute Pressure', 'presión absoluta del múltiple (MAP)'],
  ['Barometric Pressure', 'presión barométrica'],
  ['Intake Air Temperature', 'temperatura del aire de admisión'],
  ['Engine Coolant Temperature', 'temperatura del refrigerante'],
  ['Coolant Temperature', 'temperatura del refrigerante'],
  ['Engine Oil Temperature', 'temperatura del aceite del motor'],
  ['Engine Oil Pressure', 'presión del aceite del motor'],
  ['Transmission Fluid Temperature', 'temperatura del fluido de transmisión'],
  ['Fuel Temperature', 'temperatura del combustible'],
  ['Fuel Rail Pressure', 'presión del riel de combustible'],
  ['Fuel Pressure', 'presión de combustible'],
  ['Fuel Trim', 'ajuste de combustible'],
  ['Fuel Level Sensor', 'sensor de nivel de combustible'],
  ['Fuel Level', 'nivel de combustible'],
  ['Fuel Rail', 'riel de combustible'],
  ['Fuel Pump', 'bomba de combustible'],
  ['Fuel Injector', 'inyector de combustible'],
  ['Fuel Injection', 'inyección de combustible'],
  ['Fuel Metering', 'dosificación de combustible'],
  ['Fuel Composition', 'composición del combustible'],
  ['Fuel Shutoff', 'corte de combustible'],
  ['Fuel Delivery', 'suministro de combustible'],
  ['Fuel Control', 'control de combustible'],
  ['Fuel Tank', 'tanque de combustible'],
  ['Fuel Filter', 'filtro de combustible'],
  ['Fuel Door', 'tapa de combustible'],
  ['Fuel Cap', 'tapón de combustible'],
  ['Fuel System', 'sistema de combustible'],
  ['Fuel', 'combustible'],
  ['Closed Loop', 'lazo cerrado'],
  ['Open Loop', 'lazo abierto'],
  ['Stable Operation', 'operación estable'],
  ['System Too Lean', 'sistema demasiado pobre'],
  ['System Too Rich', 'sistema demasiado rico'],
  ['Too Lean', 'demasiado pobre'],
  ['Too Rich', 'demasiado rico'],
  ['Lean', 'pobre'],
  ['Rich', 'rico'],
  ['Cylinder Misfire Detected', 'fallo de encendido del cilindro detectado'],
  ['Misfire Detected', 'fallo de encendido detectado'],
  ['Misfire', 'fallo de encendido'],
  ['Contribution/Balance', 'contribución/balance'],
  ['Contribution/Range', 'contribución/rango'],
  ['Random/Multiple', 'aleatorio/múltiple'],
  ['Cylinder', 'cilindro'],
  ['Oxygen Sensor', 'sensor de oxígeno'],
  ['O2 Sensor', 'sensor de oxígeno'],
  ['O2 Sensor Heater', 'calentador del sensor de oxígeno'],
  ['HO2S Heater', 'calentador del sensor de oxígeno (HO2S)'],
  ['Heater Control', 'control del calentador'],
  ['Heater', 'calentador'],
  ['Heated', 'calefaccionado'],
  ['Throttle Position Sensor/Switch', 'sensor/interruptor de posición de la mariposa'],
  ['Throttle Position Sensor', 'sensor de posición de la mariposa'],
  ['Throttle Position', 'posición de la mariposa'],
  ['Throttle/Petal Position Sensor/Switch', 'sensor/interruptor de posición de mariposa/pedal'],
  ['Throttle/Petal Position Sensor', 'sensor de posición de mariposa/pedal'],
  ['Throttle/Pedal Position Sensor/Switch', 'sensor/interruptor de posición de mariposa/pedal'],
  ['Throttle/Pedal Position Sensor', 'sensor de posición de mariposa/pedal'],
  ['Throttle Actuator', 'actuador de la mariposa'],
  ['Throttle', 'mariposa/acelerador'],
  ['Accelerator Pedal Position', 'posición del pedal del acelerador'],
  ['Pedal Position', 'posición del pedal'],
  ['Accelerator', 'acelerador'],
  ['Pedal', 'pedal'],
  ['Catalyst System Efficiency', 'eficiencia del sistema catalizador'],
  ['Catalyst System', 'sistema del catalizador'],
  ['Catalyst Temperature Sensor', 'sensor de temperatura del catalizador'],
  ['Catalyst', 'catalizador'],
  ['Efficiency Below Threshold', 'eficiencia bajo el umbral'],
  ['Below Threshold', 'bajo el umbral'],
  ['Above Threshold', 'sobre el umbral'],
  ['Threshold', 'umbral'],
  ['Efficiency', 'eficiencia'],
  ['Evaporative Emission Control System', 'sistema de control de emisiones evaporativas (EVAP)'],
  ['Evaporative Emission', 'emisiones evaporativas (EVAP)'],
  ['Evaporative', 'evaporativo'],
  ['Emission', 'emisión'],
  ['Emissions', 'emisiones'],
  ['small leak', 'fuga pequeña'],
  ['large leak', 'fuga grande'],
  ['gross leak', 'fuga grande'],
  ['Leak Detected', 'fuga detectada'],
  ['Leak', 'fuga'],
  ['Purge Flow Sensor', 'sensor de flujo de purga'],
  ['Purge Control Valve', 'válvula de control de purga'],
  ['Purge Flow', 'flujo de purga'],
  ['Purge', 'purga'],
  ['Vent Control', 'control de ventilación'],
  ['Vent', 'ventilación'],
  ['Knock Sensor', 'sensor de detonación'],
  ['Knock', 'detonación'],
  ['Crankshaft Position Sensor', 'sensor de posición del cigüeñal'],
  ['Crankshaft Position', 'posición del cigüeñal'],
  ['Crankshaft', 'cigüeñal'],
  ['Camshaft Position Sensor', 'sensor de posición del árbol de levas'],
  ['Camshaft Position', 'posición del árbol de levas'],
  ['Camshaft', 'árbol de levas'],
  ['Cam', 'leva'],
  ['Cam/Rotor/Injector', 'leva/rotor/inyector'],
  ['Injector Control Pressure', 'presión de control de inyectores'],
  ['Injector', 'inyector'],
  ['Injection Pump', 'bomba de inyección'],
  ['Injection Timing', 'tiempo de inyección'],
  ['Injection', 'inyección'],
  ['Ignition Coil', 'bobina de encendido'],
  ['Ignition Switch', 'interruptor de encendido'],
  ['Ignition Key', 'llave de encendido'],
  ['Ignition', 'encendido'],
  ['Coil', 'bobina'],
  ['Primary/Secondary', 'primario/secundario'],
  ['Primary', 'primario'],
  ['Secondary Air Injection System', 'sistema de inyección de aire secundario'],
  ['Secondary Air Injection', 'inyección de aire secundario'],
  ['Secondary', 'secundario'],
  ['Transmission Control System', 'sistema de control de la transmisión'],
  ['Transmission Range Sensor', 'sensor de rango de la transmisión'],
  ['Transmission Fluid', 'fluido de transmisión'],
  ['Transmission', 'transmisión'],
  ['Transfer Case', 'caja de transferencia'],
  ['Torque Converter Clutch', 'embrague del convertidor de par'],
  ['Torque Converter', 'convertidor de par'],
  ['Torque', 'par'],
  ['Shift Solenoid', 'solenoide de cambios'],
  ['Shift Lock', 'bloqueo de cambios'],
  ['Shift Error', 'error de cambio'],
  ['Shift', 'cambio'],
  ['Solenoid', 'solenoide'],
  ['Gear Ratio', 'relación de marcha'],
  ['Gear', 'marcha'],
  ['Clutch', 'embrague'],
  ['Input Shaft', 'eje de entrada'],
  ['Output Shaft', 'eje de salida'],
  ['Shaft', 'eje'],
  ['Vehicle Speed Sensor', 'sensor de velocidad del vehículo'],
  ['Vehicle Speed', 'velocidad del vehículo'],
  ['Wheel Speed Sensor', 'sensor de velocidad de rueda'],
  ['Wheel Speed', 'velocidad de rueda'],
  ['Engine Speed', 'velocidad del motor'],
  ['Speed Sensor', 'sensor de velocidad'],
  ['Speed', 'velocidad'],
  ['Idle Air Control', 'control de aire de ralentí (IAC)'],
  ['Idle Control System', 'sistema de control de ralentí'],
  ['Idle Speed', 'velocidad de ralentí'],
  ['Idle', 'ralentí'],
  ['RPM Lower Than Expected', 'RPM más bajas de lo esperado'],
  ['RPM Higher Than Expected', 'RPM más altas de lo esperado'],
  ['Lower Than Expected', 'más bajo de lo esperado'],
  ['Higher Than Expected', 'más alto de lo esperado'],
  ['Than Expected', 'de lo esperado'],
  ['Above / Below Desired', 'por encima / por debajo de lo deseado'],
  ['Above/Below Desired', 'por encima/por debajo de lo deseado'],
  ['Desired', 'deseado'],
  ['Expected', 'esperado'],
  ['Exhaust Gas Recirculation', 'recirculación de gases de escape (EGR)'],
  ['Exhaust Pressure', 'presión de escape'],
  ['Exhaust', 'escape'],
  ['Recirculation', 'recirculación'],
  ['Turbocharger/Supercharger', 'turbo/supercargador'],
  ['Turbocharger', 'turbocargador'],
  ['Supercharger', 'supercargador'],
  ['Turbo', 'turbo'],
  ['Boost Pressure', 'presión de sobrealimentación'],
  ['Boost', 'presión de sobrealimentación'],
  ['Wastegate', 'válvula de descarga (wastegate)'],
  ['Glow Plug', 'bujía de precalentamiento'],
  ['Spark Plug', 'bujía'],
  ['Engine Coolant', 'refrigerante del motor'],
  ['Coolant Thermostat', 'termostato del refrigerante'],
  ['Coolant', 'refrigerante'],
  ['Cooling Fan', 'abanico de enfriamiento'],
  ['Cooling System', 'sistema de enfriamiento'],
  ['Cooling', 'enfriamiento'],
  ['Thermostat', 'termostato'],
  ['Radiator', 'radiador'],
  ['Engine Oil', 'aceite del motor'],
  ['Oil Pressure', 'presión de aceite'],
  ['Oil Level', 'nivel de aceite'],
  ['Oil', 'aceite'],
  ['Engine', 'motor'],
  ['Battery Voltage', 'voltaje de batería'],
  ['Battery', 'batería'],
  ['Generator', 'alternador'],
  ['Alternator', 'alternador'],
  ['Starter', 'motor de arranque'],
  ['Charging System', 'sistema de carga'],
  ['System Voltage', 'voltaje del sistema'],
  ['Reference Voltage', 'voltaje de referencia'],
  ['Voltage', 'voltaje'],
  ['Current', 'corriente'],
  ['Resistance', 'resistencia'],
  ['Power Supply', 'alimentación'],
  ['Power/Ground', 'alimentación/tierra'],
  ['Power', 'alimentación'],
  ['Ground', 'tierra'],
  ['GND', 'tierra'],
  ['Vbatt', 'batería'],
  ['Vbat', 'batería'],
  ['Brake Switch', 'interruptor de freno'],
  ['Brake Pedal', 'pedal de freno'],
  ['Brake Fluid', 'líquido de frenos'],
  ['Parking Brake', 'freno de estacionamiento'],
  ['Brake', 'freno'],
  ['Brakes', 'frenos'],
  ['Anti-Lock', 'antibloqueo'],
  ['Traction Control', 'control de tracción'],
  ['Traction', 'tracción'],
  ['Stability Control', 'control de estabilidad'],
  ['Cruise Control', 'control de crucero'],
  ['Cruise', 'crucero'],
  ['Air Conditioning', 'aire acondicionado'],
  ['A/C Compressor', 'compresor del aire acondicionado'],
  ['A/C Clutch', 'embrague del aire acondicionado'],
  ['A/C', 'aire acondicionado'],
  ['Compressor', 'compresor'],
  ['Refrigerant', 'refrigerante'],
  ['Climate Control', 'control de climatización'],
  ['Climate', 'climatización'],
  ['Blower Motor', 'motor del soplador'],
  ['Blower', 'soplador'],
  ['Fan Control', 'control del abanico'],
  ['Fan', 'abanico'],
  ['Lamp', 'luz'],
  ['LAMP', 'luz'],
  ['Headlamp', 'faro'],
  ['Headlight', 'faro'],
  ['Autolamp', 'luces automáticas'],
  ['Tail Lamp', 'luz trasera'],
  ['Turn Signal', 'direccional'],
  ['Turn Lamp', 'luz direccional'],
  ['Warning Lamp', 'luz de advertencia'],
  ['Warning Indicator', 'indicador de advertencia'],
  ['Warning', 'advertencia'],
  ['Indicator', 'indicador'],
  ['Malfunction Indicator Lamp', 'luz indicadora de falla (MIL)'],
  ['Lost Communication With', 'perdida la comunicación con'],
  ['Lost Communication', 'comunicación perdida'],
  ['Communication', 'comunicación'],
  ['Control Module', 'módulo de control'],
  ['Engine Control Module', 'módulo de control del motor (ECM)'],
  ['Powertrain Control Module', 'módulo de control del tren motriz (PCM)'],
  ['Module', 'módulo'],
  ['Bus', 'bus'],
  ['Network', 'red'],
  ['Invalid or Missing Data for', 'datos inválidos o faltantes para'],
  ['Invalid or Missing Data', 'datos inválidos o faltantes'],
  ['Invalid Data', 'datos inválidos'],
  ['Missing Data', 'datos faltantes'],
  ['Invalid', 'inválido'],
  ['Missing', 'faltante'],
  ['Data', 'datos'],
  ['Primary Id', 'ID primario'],
  ['Id', 'ID'],
  ['Programming', 'programación'],
  ['Failed To Initialize', 'no se pudo inicializar'],
  ['Short To Ground', 'corto a tierra'],
  ['Short To GND', 'corto a tierra'],
  ['Short To Battery', 'corto a batería'],
  ['Short To Vbatt', 'corto a batería'],
  ['Short To Vbat', 'corto a batería'],
  ['Short To Power', 'corto a alimentación'],
  ['Short', 'corto'],
  ['Shorted', 'en corto'],
  ['Open Circuit', 'circuito abierto'],
  ['Circuit Malfunction', 'falla del circuito'],
  ['Circuit Range/Performance', 'rango/desempeño del circuito'],
  ['Circuit Low Input', 'señal baja del circuito'],
  ['Circuit High Input', 'señal alta del circuito'],
  ['Circuit Intermittent', 'circuito intermitente'],
  ['Circuit Failure', 'falla del circuito'],
  ['Circuit Open', 'circuito abierto'],
  ['Circuit', 'circuito'],
  ['Circuits', 'circuitos'],
  ['CIRCUIT', 'circuito'],
  ['Ckt', 'circuito'],
  ['Malfunction', 'falla'],
  ['Failure', 'falla'],
  ['Failed', 'falló'],
  ['Fault', 'falla'],
  ['Error', 'error'],
  ['Problem', 'problema'],
  ['Performance', 'desempeño'],
  ['Range', 'rango'],
  ['Open', 'abierto'],
  ['Closed', 'cerrado'],
  ['Stuck', 'pegado'],
  ['Intermittent/Erratic/High', 'intermitente/errático/alto'],
  ['Intermittent', 'intermitente'],
  ['Erratic', 'errático'],
  ['Low', 'bajo'],
  ['High', 'alto'],
  ['Input', 'señal'],
  ['Output', 'salida'],
  ['OUTPUT', 'salida'],
  ['Signal', 'señal'],
  ['Feedback', 'retroalimentación'],
  ['Reference', 'referencia'],
  ['Sense', 'detección'],
  ['Sensor/Switch', 'sensor/interruptor'],
  ['Sensor', 'sensor'],
  ['Sensors', 'sensores'],
  ['Switch', 'interruptor'],
  ['Switches', 'interruptores'],
  ['Switching Valve', 'válvula de conmutación'],
  ['Switching', 'conmutación'],
  ['Pump', 'bomba'],
  ['Valve', 'válvula'],
  ['Pressure Sensor', 'sensor de presión'],
  ['Pressure', 'presión'],
  ['Temperature Sensor', 'sensor de temperatura'],
  ['Temperature', 'temperatura'],
  ['Temp', 'temperatura'],
  ['Relay', 'relé'],
  ['Driver', 'controlador'],
  ['Actuator', 'actuador'],
  ['Motor', 'motor'],
  ['Potentiometer', 'potenciómetro'],
  ['Servo', 'servo'],
  ['Flow', 'flujo'],
  ['Insufficient', 'insuficiente'],
  ['Excessive', 'excesivo'],
  ['Detected', 'detectado'],
  ['Not Detected', 'no detectado'],
  ['No Activity', 'sin actividad'],
  ['Activity', 'actividad'],
  ['Slow Response', 'respuesta lenta'],
  ['Response', 'respuesta'],
  ['Not Responding', 'no responde'],
  ['Responding', 'responde'],
  ['Incorrect', 'incorrecto'],
  ['Correlation', 'correlación'],
  ['Calibration', 'calibración'],
  ['Timing', 'sincronización'],
  ['Over Temperature', 'sobretemperatura'],
  ['Overheat', 'sobrecalentamiento'],
  ['Over Speed', 'sobrevelocidad'],
  ['Out Of Range', 'fuera de rango'],
  ['Out Of Calibration', 'fuera de calibración'],
  ['Mixture', 'mezcla'],
  ['Air Intake', 'admisión de aire'],
  ['Airintake', 'admisión de aire'],
  ['Intake Manifold', 'múltiple de admisión'],
  ['Exhaust Manifold', 'múltiple de escape'],
  ['Manifold', 'múltiple'],
  ['Intake', 'admisión'],
  ['Inlet', 'entrada'],
  ['Outlet', 'salida'],
  ['Air Flow', 'flujo de aire'],
  ['Air', 'aire'],
  ['Bank 1', 'banco 1'],
  ['Bank 2', 'banco 2'],
  ['Bank', 'banco'],
  ['Sensor 1', 'sensor 1'],
  ['Sensor 2', 'sensor 2'],
  ['Sensor 3', 'sensor 3'],
  ['Level', 'nivel'],
  ['Position', 'posición'],
  ['Control', 'control'],
  ['System', 'sistema'],
  ['Vehicle', 'vehículo'],
  // --- body (B) --------------------------------------------------------------
  ['Air Bag', 'bolsa de aire'],
  ['Airbag', 'bolsa de aire'],
  ['Bag', 'bolsa'],
  ['Inflator', 'inflador'],
  ['Crash Sensor', 'sensor de impacto'],
  ['Crash', 'impacto'],
  ['Seat Belt', 'cinturón de seguridad'],
  ['Seatbelt', 'cinturón de seguridad'],
  ['Pretensioner', 'pretensor'],
  ['Belt', 'correa'],
  ['Seat', 'asiento'],
  ['Recline', 'reclinación'],
  ['Lumbar', 'lumbar'],
  ['Passenger', 'pasajero'],
  ['Driver Side', 'lado del conductor'],
  ['Passenger Side', 'lado del pasajero'],
  ['Occupant', 'ocupante'],
  ['Occupied', 'ocupado'],
  ['Door Ajar', 'puerta entreabierta'],
  ['Ajar', 'entreabierto'],
  ['Door Lock', 'seguro de puerta'],
  ['Door', 'puerta'],
  ['Lock', 'seguro'],
  ['Unlock', 'quitar seguro'],
  ['Power Window', 'ventana eléctrica'],
  ['Window', 'ventana'],
  ['Mirror', 'espejo'],
  ['Wiper', 'limpiaparabrisas'],
  ['Washer', 'lavaparabrisas'],
  ['Windshield', 'parabrisas'],
  ['Horn', 'bocina'],
  ['Keyless Entry', 'entrada sin llave'],
  ['Remote', 'remoto'],
  ['Entry', 'entrada'],
  ['Key', 'llave'],
  ['Theft', 'robo'],
  ['Anti-Theft', 'antirrobo'],
  ['Alarm', 'alarma'],
  ['Disarm', 'desarmar'],
  ['Arm', 'armar'],
  ['Decklid', 'tapa del baúl'],
  ['Trunk', 'baúl'],
  ['Hood', 'capó'],
  ['Liftgate', 'compuerta trasera'],
  ['Sunroof', 'techo corredizo'],
  ['Moonroof', 'techo corredizo'],
  ['Roof', 'techo'],
  ['Audio', 'audio'],
  ['Radio', 'radio'],
  ['Speaker', 'bocina'],
  ['Instrument Cluster', 'cuadro de instrumentos'],
  ['Cluster', 'cuadro de instrumentos'],
  ['Panel', 'panel'],
  ['Display', 'pantalla'],
  ['Dim', 'atenuado'],
  ['Dimming', 'atenuación'],
  ['Illumination', 'iluminación'],
  ['Illuminated', 'iluminado'],
  ['Interior', 'interior'],
  ['Exterior', 'exterior'],
  ['Heated Seat', 'asiento calefaccionado'],
  ['Memory', 'memoria'],
  ['Steering Wheel', 'volante'],
  ['Steering Column', 'columna de dirección'],
  ['Steering', 'dirección'],
  ['Column', 'columna'],
  ['Handle', 'manija'],
  ['Sliding', 'corredizo'],
  ['Plate', 'placa'],
  ['Contact', 'contacto'],
  ['Horizontal', 'horizontal'],
  ['Vertical', 'vertical'],
  ['Up/Down', 'arriba/abajo'],
  ['Forward/Rearward', 'adelante/atrás'],
  ['Forward', 'adelante'],
  ['Rearward', 'hacia atrás'],
  ['Up', 'arriba'],
  ['Down', 'abajo'],
  ['Rear', 'trasero'],
  ['Front', 'delantero'],
  ['Left', 'izquierdo'],
  ['Right', 'derecho'],
  ['Side', 'lado'],
  ['Center', 'centro'],
  ['Corner', 'esquina'],
  ['Clockwise', 'en sentido horario'],
  ['Counterclockwise', 'en sentido antihorario'],
  // --- chassis (C) -----------------------------------------------------------
  ['Air Suspension', 'suspensión neumática'],
  ['Suspension', 'suspensión'],
  ['Air Spring', 'resorte neumático'],
  ['Spring/Shock', 'resorte/amortiguador'],
  ['Spring', 'resorte'],
  ['Shock Absorber', 'amortiguador'],
  ['Shock', 'amortiguador'],
  ['Damper', 'amortiguador'],
  ['Ride Control', 'control de marcha'],
  ['Ride Height', 'altura de marcha'],
  ['Ride', 'marcha'],
  ['Height Sensor', 'sensor de altura'],
  ['Height', 'altura'],
  ['Wheel', 'rueda'],
  ['Tire Pressure', 'presión de neumáticos'],
  ['Tire', 'neumático'],
  ['Accelerometer', 'acelerómetro'],
  ['Hydraulic', 'hidráulico'],
  ['Fluid', 'fluido'],
  ['Differential', 'diferencial'],
  ['Axle', 'eje'],
  ['Four Wheel Drive', 'tracción en las cuatro ruedas'],
  ['4-Wheel Drive', 'tracción 4x4'],
  ['Drive', 'tracción'],
  ['Park', 'estacionamiento'],
  ['Reverse', 'reversa'],
  ['Neutral', 'neutro'],
  ['Loop', 'lazo'],
  // --- network (U) & misc ---------------------------------------------------
  ['Self Test', 'autoprueba'],
  ['Self-Test', 'autoprueba'],
  ['Test', 'prueba'],
  ['Codes', 'códigos'],
  ['Code', 'código'],
  ['Request', 'solicitud'],
  ['Mode', 'modo'],
  ['Timeout', 'tiempo agotado'],
  ['Time', 'tiempo'],
  ['Delay', 'retardo'],
  ['Disable', 'deshabilitar'],
  ['Disabled', 'deshabilitado'],
  ['Enable', 'habilitar'],
  ['Internal', 'interno'],
  ['External', 'externo'],
  ['Electrical', 'eléctrico'],
  ['Electric', 'eléctrico'],
  ['Mechanical', 'mecánico'],
  ['Assembly', 'conjunto'],
  ['Unit', 'unidad'],
  ['Select', 'selección'],
  ['Selector', 'selector'],
  ['Supply', 'suministro'],
  ['Monitor', 'monitor'],
  ['Mode Select', 'selección de modo'],
  ['Aux', 'auxiliar'],
  ['Auxiliary', 'auxiliar'],
  ['Lack Of', 'falta de'],
  ['Lack', 'falta'],
  ['Limit', 'límite'],
  ['Exceeded', 'excedido'],
  ['Increase', 'aumento'],
  ['Decrease', 'disminución'],
  ['Change', 'cambio'],
  ['Condition', 'condición'],
  ['Start', 'arranque'],
  ['Single', 'simple'],
  ['Dual', 'doble'],
  ['Common', 'común'],
  ['Variable', 'variable'],
  ['Pulses', 'pulsos'],
  ['Pulse', 'pulso'],
  ['Link', 'enlace'],
  ['Flash', 'destello'],
  ['Safety', 'seguridad'],
  ['Experimental', 'experimental'],
  ['Indicates', 'indica'],
  ['Set', 'establecido'],
  ['Resolution', 'resolución'],
  ['Interactive', 'interactivo'],
  ['Gas', 'gas'],
  ['Non', 'no'],
  ['Not', 'no'],
  ['No', 'sin'],
  ['On', 'encendido'],
  ['Off', 'apagado'],
  ['Out', 'fuera'],
  ['During', 'durante'],
  ['Above', 'por encima de'],
  ['Below', 'por debajo de'],
  ['Stalled', 'atascado'],
  ['Stall', 'calado'],
  ['Protection', 'protección'],
  ['Pressure Relief', 'alivio de presión'],
  ['Mass', 'masa'],
  ['Volume', 'volumen'],
  ['Barometric', 'barométrico'],
  ['Absolute', 'absoluto'],
  ['Stable', 'estable'],
  ['Operation', 'operación'],
  ['Rotor', 'rotor'],
  ['Pump Control', 'control de la bomba'],
  ['Plug', 'bujía'],
  ['Transfer', 'transferencia'],
  ['Case', 'caja'],
  ['Heat', 'calor'],
  ['Cold', 'frío'],
  ['Hot', 'caliente'],
  ['Slip', 'patinaje'],
  ['Lockup', 'bloqueo'],
  ['Ratio', 'relación'],
  ['Governor', 'gobernador'],
  ['Line Pressure', 'presión de línea'],
  ['Line', 'línea'],
  ['Band', 'banda'],
  ['Overdrive', 'sobremarcha'],
  ['Neutral Position', 'posición neutral'],
  ['Programming Error', 'error de programación'],
  ['Checksum', 'suma de verificación'],
  ['Memory Error', 'error de memoria'],
  ['Processor', 'procesador'],
  ['Wake Up', 'activación'],
  ['Message', 'mensaje'],
  ['Counter', 'contador'],
  ['Value', 'valor'],
  ['Reading', 'lectura'],
  ['Detection', 'detección'],
  ['Lower', 'más bajo'],
  ['Higher', 'más alto'],
  ['Upper', 'superior'],
  ['Minimum', 'mínimo'],
  ['Maximum', 'máximo'],
  ['Normal', 'normal'],
  ['Adaptive', 'adaptativo'],
  ['Adaptation', 'adaptación'],
  ['Learn', 'aprendizaje'],
  ['Learned', 'aprendido'],
  ['Deactivation', 'desactivación'],
  ['Activation', 'activación'],
  ['Lamp Circuit', 'circuito de la luz'],
  // --- second round, driven by the "top leftovers" output ---------------------
  ['High Side', 'lado alto'],
  ['Low Side', 'lado bajo'],
  ['Run', 'marcha'],
  ['Running', 'en marcha'],
  ['Return Spring', 'resorte de retorno'],
  ['Return', 'retorno'],
  ['Backward', 'hacia atrás'],
  ['Power Feed', 'alimentación'],
  ['Feed', 'alimentación'],
  ['Metering', 'dosificación'],
  ['Heated Backlite', 'desempañador trasero'],
  ['Backlite', 'vidrio trasero'],
  ['High-Beam', 'luz alta'],
  ['Low-Beam', 'luz baja'],
  ['High Beam', 'luz alta'],
  ['Low Beam', 'luz baja'],
  ['Beam', 'haz'],
  ['Backup Lamp', 'luz de reversa'],
  ['Backup', 'respaldo'],
  ['Buckle', 'hebilla'],
  ['Defrost', 'desescarchador'],
  ['Chime', 'timbre'],
  ['Reset', 'reinicio'],
  ['Hi/Low', 'alta/baja'],
  ['Hi', 'alto'],
  ['Master', 'maestro'],
  ['Hazard', 'intermitentes de emergencia'],
  ['Tone', 'tono'],
  ['Outage', 'fundida'],
  ['Bulb', 'bombillo'],
  ['Applied', 'aplicado'],
  ['Unable To', 'no se puede'],
  ['Unable', 'no se puede'],
  ['Positive', 'positivo'],
  ['Negative', 'negativo'],
  ['Close', 'cerrar'],
  ['Coherency', 'coherencia'],
  ['Angle', 'ángulo'],
  ['Intake Manifold Runner Control', 'control de conductos del múltiple de admisión'],
  ['Runner', 'conducto'],
  ['Inductive Signature', 'firma inductiva'],
  ['Inductive', 'inductivo'],
  ['Signature', 'firma'],
  ['Acknowledgment', 'confirmación'],
  ['Solar Radiation', 'radiación solar'],
  ['Solar', 'solar'],
  ['Radiation', 'radiación'],
  ['Battery Saver', 'ahorrador de batería'],
  ['Saver', 'ahorrador'],
  ['Button', 'botón'],
  ['Release', 'liberación'],
  ['Released', 'liberado'],
  ['Check', 'revisión'],
  ['Antenna', 'antena'],
  ['Diagnostic', 'diagnóstico'],
  ['Diagnostics', 'diagnósticos'],
  ['Post', 'posterior'],
  ['Head', 'cabeza'],
  ['Configuration', 'configuración'],
  ['Tape Deck', 'reproductor de casete'],
  ['Tape', 'casete'],
  ['Deck', 'reproductor'],
  ['Main', 'principal'],
  ['Stop Lamp', 'luz de freno'],
  ['Stop', 'parada'],
  ['Command', 'comando'],
  ['Dynamic', 'dinámico'],
  ['Related', 'relacionado'],
  ['Read', 'lectura'],
  ['Immobilizer', 'inmovilizador'],
  ['Early', 'temprano'],
  ['Status', 'estado'],
  ['Foot', 'pie'],
  ['Bypass', 'derivación'],
  ['Accessory', 'accesorio'],
  ['One Touch', 'un toque'],
  ['Touch', 'toque'],
  ['One', 'uno'],
  ['Transponder', 'transpondedor'],
  ['Received', 'recibido'],
  ['Cellular Phone', 'teléfono celular'],
  ['Phone', 'teléfono'],
  ['Cellular', 'celular'],
  ['Squib', 'detonador'],
  ['Water', 'agua'],
  ['Override', 'anulación'],
  ['Headrest', 'reposacabezas'],
  ['Reach', 'alcance'],
  ['Tilt', 'inclinación'],
  ['Powertrain', 'tren motriz'],
  ['Faulted', 'con falla'],
  ['Only', 'solo'],
  ['Sensed', 'detectado'],
  ['Function', 'función'],
  ['Functions', 'funciones'],
  ['Tone Ring', 'anillo reluctor'],
  ['Ring', 'anillo'],
  ['Tooth', 'diente'],
  ['Rate', 'tasa'],
  ['Lateral', 'lateral'],
  ['Encoder', 'codificador'],
  ['Reduction', 'reducción'],
  ['Vacuum', 'vacío'],
  ['Max', 'máximo'],
  ['But', 'pero'],
  ['Hold', 'retención'],
  ['Not Available', 'no disponible'],
  ['Available', 'disponible'],
  ['Electronic', 'electrónico'],
  ['Digital', 'digital'],
  ['Sender', 'emisor'],
  ['Programmed', 'programado'],
  ['Acceleration', 'aceleración'],
  ['Loss Of', 'pérdida de'],
  ['Loss', 'pérdida'],
  ['Tach', 'tacómetro'],
  ['Wash', 'lavado'],
  ['Pass', 'paso'],
  ['Direction', 'dirección'],
  ['Keypad', 'teclado'],
  ['Panic', 'pánico'],
  ['Dome Lamp', 'luz de techo'],
  ['Dome', 'luz de techo'],
  ['Tail', 'trasero'],
  ['Tamper', 'manipulación'],
  ['Clear', 'borrar'],
  ['Evaporator', 'evaporador'],
  ['Cargo', 'carga'],
  ['Doors', 'puertas'],
  ['Navigation', 'navegación'],
  ['Disc', 'disco'],
  ['Drivers', 'del conductor'],
  ['Passengers', 'del pasajero'],
  ['Comparison', 'comparación'],
  ['Transducer', 'transductor'],
  ['Phase', 'fase'],
  ['Sounder', 'sirena'],
  ['Gate', 'compuerta'],
  ['Distributor', 'distribuidor'],
  ['Access', 'acceso'],
  ['Turbine', 'turbina'],
  ['Demand', 'demanda'],
  ['Load', 'carga'],
  ['Kickdown', 'kickdown (rebase)'],
  ['Stepping', 'paso a paso'],
  ['Interlock', 'interbloqueo'],
  ['Automatic', 'automático'],
  ['Disengaged', 'desacoplado'],
  ['Engaged', 'acoplado'],
  ['Motion', 'movimiento'],
  ['Audible', 'audible'],
  ['Warnings', 'advertencias'],
  ['Lamps', 'luces'],
  ['Environment', 'entorno'],
  ['Present', 'presente'],
  ['Together', 'juntos'],
  ['All', 'todos'],
  ['Double', 'doble'],
  ['Mismatch', 'discrepancia'],
  ['Receiver', 'receptor'],
  ['Mount', 'soporte'],
  ['Cable', 'cable'],
  ['Latch', 'pestillo'],
  ['Unlatch', 'destrabar'],
  ['Shutdown', 'apagado'],
  ['Flame', 'llama'],
  ['Fog Lamp', 'luz antiniebla'],
  ['Fog', 'niebla'],
  ['Child', 'niño'],
  ['Anti', 'anti'],
  ['Exceeds', 'excede'],
  ['Operational', 'operativo'],
  ['Yaw Rate', 'velocidad de guiñada'],
  ['Yaw', 'guiñada'],
  ['Booster', 'servofreno'],
  ['Pneumatic', 'neumático'],
  ['Compress', 'comprimir'],
  ['Track', 'pista'],
  ['Warm Up', 'calentamiento'],
  ['Warm', 'caliente'],
  ['Charge', 'carga'],
  ['Coast', 'desaceleración'],
  ['Systems', 'sistemas'],
  ['Overcurrent', 'sobrecorriente'],
  ['Second', 'segundo'],
  ['First', 'primero'],
  ['Pull', 'tirón'],
  ['Damage', 'daño'],
  ['Spare', 'repuesto'],
  ['Relief', 'alivio'],
  ['Mini', 'mini'],
  ['Trans', 'transmisión'],
  ['Management', 'gestión'],
  ['Telltales', 'testigos'],
  ['Compact', 'compacto'],
  ['Mirrors', 'espejos'],
  ['Locks', 'seguros'],
  ['Number', 'número'],
  ['Board', 'tarjeta'],
  ['Emergency', 'emergencia'],
  ['Road', 'carretera'],
  ['Blend Door', 'compuerta de mezcla'],
  ['Blend', 'mezcla'],
  ['Defective', 'defectuoso'],
  ['Activated', 'activado'],
  ['Active', 'activo'],
  ['Pack', 'paquete'],
  ['Handset', 'auricular'],
  ['Seatback', 'respaldo del asiento'],
  ['Changed', 'cambiado'],
  ['Satellite', 'satélite'],
  ['Central', 'central'],
  ['Receive', 'recibir'],
  ['Does Not Match', 'no coincide'],
  ['Match', 'coincidir'],
  ['Does', ''],
  ['What', 'lo que'],
  ['Was', 'fue'],
  ['Confirm', 'confirmar'],
  ['Inertia Switch', 'interruptor de inercia'],
  ['Inertia', 'inercia'],
  ['Fitting', 'conexión'],
  ['Communications', 'comunicaciones'],
  ['Parklamp', 'luz de estacionamiento'],
  ['Park Lamp', 'luz de estacionamiento'],
  ['Detent', 'retén'],
  ['Mute', 'silencio'],
  ['Thermal', 'térmico'],
  ['Player', 'reproductor'],
  ['Synchronization', 'sincronización'],
  ['Overrun', 'sobrerrégimen'],
  ['Locked', 'bloqueado'],
  ['Overtemp', 'sobretemperatura'],
  ['Overtemperature', 'sobretemperatura'],
  ['License Plate', 'placa'],
  ['License', 'licencia'],
  ['Fully', 'completamente'],
  ['Movement', 'movimiento'],
  ['Aim', 'orientación'],
  ['Reversed', 'invertido'],
  ['Redundant', 'redundante'],
  ['Reservoir', 'depósito'],
  ['Transition', 'transición'],
  ['Between', 'entre'],
  ['Converter', 'convertidor'],
  ['Fuel Gauge', 'indicador de combustible'],
  ['Gauge', 'indicador'],
  ['Inhibit', 'inhibición'],
  ['Overspeed', 'sobrevelocidad'],
  ['Too Many', 'demasiados'],
  ['Too Few', 'muy pocos'],
  ['Many', 'muchos'],
  ['Few', 'pocos'],
  ['Over', 'sobre'],
  ['Serial', 'serie'],
  ['Keep Alive Memory', 'memoria de mantenimiento (KAM)'],
  ['Keep Alive', 'mantenimiento'],
  ['Upshift', 'cambio ascendente'],
  ['Downshift', 'cambio descendente'],
  ['Skip Shift', 'salto de marcha'],
  ['Skip', 'salto'],
  ['Complete', 'completo'],
  ['Aborted', 'abortado'],
  ['Upstream', 'antes del catalizador'],
  ['Downstream', 'después del catalizador'],
  ['Swapped', 'intercambiado'],
  ['Restriction', 'restricción'],
  ['Assist', 'asistencia'],
  ['Shifted', 'cambiado'],
  ['Shut Down', 'apagado'],
  ['Shut', 'cerrado'],
  ['Resistor', 'resistor'],
  ['Crank', 'arranque'],
  ['Multi', 'multi'],
  ['Faults', 'fallas'],
  ['Shorts', 'cortos'],
  ['Chip', 'chip'],
  ['Overadvanced', 'demasiado adelantado'],
  ['Overretarded', 'demasiado atrasado'],
  ['Port', 'puerto'],
  ['Split', 'dividido'],
  ['Bleed Up', 'purgar'],
  ['Bleed', 'purgar'],
  ['Tank', 'tanque'],
  ['Legislated', 'reglamentario'],
  ['Safing Sensor', 'sensor de seguridad'],
  ['Safing', 'seguridad'],
  ['Punch', 'punción'],
  ['Acc', 'accesorio'],
  ['Coolair', 'aire frío'],
  ['Echo', 'eco'],
  ['Doppler', 'Doppler'],
  // --- third round ------------------------------------------------------------
  ['Sys', 'sistema'], ['Cycling', 'ciclado'], ['Period', 'período'], ['Electrodrive', 'electrotracción'],
  ['Disagreement', 'discrepancia'], ['btwn', 'entre'], ['Word', 'palabra'], ['Deterrent', 'disuasivo'],
  ['Can', 'puede'], ['Retard', 'retraso'], ['Hall Effect', 'efecto Hall'], ['Effect', 'efecto'],
  ['Wheels', 'ruedas'], ['Transaxle', 'transeje'], ['Other', 'otro'], ['Chassis', 'chasis'],
  ['Inverter', 'inversor'], ['Energy', 'energía'], ['Odometer', 'odómetro'], ['Gateway', 'pasarela'],
  ['Security', 'seguridad'], ['Processing', 'procesamiento'], ['Tuner', 'sintonizador'],
  ['Cassette', 'casete'], ['Paging', 'localización'], ['Personalization', 'personalización'],
  ['Features', 'funciones'], ['Windows', 'ventanas'], ['Restraints', 'sistemas de retención'],
  ['Body', 'carrocería'], ['Tires', 'neumáticos'], ['Displays', 'pantallas'], ['Storage', 'almacenamiento'],
  ['Date', 'fecha'], ['Class', 'clase'], ['Ended', 'terminado'], ['Disk', 'disco'],
  ['Pushbutton', 'botón'], ['Keys', 'llaves'], ['Assistance', 'asistencia'], ['Longitudinal', 'longitudinal'],
  ['See Manufacturer', 'consulte al fabricante'], ['Manufacturer', 'fabricante'], ['See', 'ver'],
  ['Glass Break', 'rotura de vidrio'], ['Glass', 'vidrio'], ['Break', 'rotura'], ['Express', 'automático'],
  ['Simultaneously', 'simultáneamente'], ['Illegal', 'ilegal'], ['Service', 'servicio'],
  ['Continuous', 'continuo'], ['Format', 'formato'], ['Transceiver', 'transceptor'],
  ['Inoperative', 'inoperativo'], ['Obstructed', 'obstruido'], ['Microphone', 'micrófono'],
  ['Magnetic', 'magnético'], ['Inflate', 'inflar'], ['Deflate', 'desinflar'], ['Rest', 'reposo'],
  ['Connected', 'conectado'], ['Wind Shield', 'parabrisas'], ['Wind', 'viento'], ['Shield', 'protector'],
  ['Dimmer', 'atenuador'], ['Scanning', 'búsqueda'], ['Traffic', 'tráfico'], ['Connection', 'conexión'],
  ['Gyroscope', 'giroscopio'], ['Weak', 'débil'], ['Defected', 'defectuoso'], ['indicating', 'indicando'],
  ['While', 'mientras'], ['Broken', 'roto'], ['Dirver', 'conductor'], ['Optical', 'óptico'],
  ['Filler', 'llenado'], ['pillar', 'pilar'], ['Aid', 'ayuda'], ['Mechanism', 'mecanismo'],
  ['Limits', 'límites'], ['Intrusion', 'intrusión'], ['same as', 'igual que'], ['Cool', 'enfriar'],
  ['may be', 'puede estar'], ['Convertible Top', 'capota'], ['Convertible', 'convertible'], ['Top', 'superior'],
  ['Already', 'ya'], ['Batt', 'batería'], ['Unexpected', 'inesperado'], ['Reversal', 'inversión'],
  ['Commanded', 'comandado'], ['Successfully', 'correctamente'], ['Opened', 'abierto'], ['After', 'después de'],
  ['Tailgate', 'compuerta trasera'], ['Locking', 'bloqueo'], ['Frozen', 'congelado'],
  ['Closing', 'cierre'], ['Enabled', 'habilitado'], ['Deactivator', 'desactivador'], ['Base', 'base'],
  ['Two', 'dos'], ['Dumping', 'descarga'], ['Slack', 'holgura'], ['Gound', 'tierra'],
  ['Temporarily', 'temporalmente'], ['Force', 'fuerza'], ['Design', 'diseño'], ['Damping', 'amortiguación'],
  ['Trailer', 'remolque'], ['Mismatched', 'no coincide'], ['Leakage', 'fuga'], ['Conflict', 'conflicto'],
  ['Contactor', 'contactor'], ['Charging', 'carga'], ['Condition Detected', 'condición detectada'],
  ['Communication Error', 'error de comunicación'],
  // --- stopwords, last resort ------------------------------------------------
  ['in the', 'en el'],
  ['of the', 'del'],
  ['to the', 'al'],
  ['with the', 'con el'],
  ['the', 'el'],
  ['of', 'de'],
  ['and', 'y'],
  ['or', 'o'],
  ['for', 'para'],
  ['with', 'con'],
  ['without', 'sin'],
  ['from', 'desde'],
  ['to', 'a'],
  ['in', 'en'],
  ['is', 'está'],
  ['at', 'en'],
  ['by', 'por'],
  ['than', 'que'],
  ['too', 'demasiado'],
  ['no', 'sin'],
];

// ---------------------------------------------------------------------------

/** Minimal RFC 4180 parser: quoted fields, "" escapes, commas inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const SYSTEMS = { P: 'motor', B: 'carroceria', C: 'chasis', U: 'red' };

function isGeneric(code) {
  const second = code[1];
  if (code[0] === 'P') return second === '1' || second === '3' ? 0 : 1;
  return second === '1' || second === '2' ? 0 : 1;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// Word boundaries that also work next to "/", "(" and "-".
const wrap = (alt) => new RegExp(`(?<![A-Za-z0-9])(?:${alt})(?![A-Za-z0-9])`, 'gi');
const byLengthDesc = (a, b) => b[0].length - a[0].length;

const glossary = [...GLOSSARY].sort(byLengthDesc);
const glossaryMap = new Map();
for (const [en, es] of glossary) {
  const key = en.toLowerCase();
  if (!glossaryMap.has(key)) glossaryMap.set(key, es);
}
const glossaryRe = wrap(glossary.map(([en]) => escape(en)).join('|'));

const conditions = [...CONDITIONS].sort(byLengthDesc);
const conditionRes = conditions.map(([en, es]) => [new RegExp(`(?:^|\\s)${escape(en)}\\s*$`, 'i'), es]);

/** Single pass: output is never re-scanned, so Spanish words are safe. */
function translatePhrase(text) {
  return text
    .replace(glossaryRe, (m) => glossaryMap.get(m.toLowerCase()) ?? m)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

function translate(descEn) {
  let body = descEn.replace(/[;.]+$/, '').trim();
  // Keep trailing qualifiers such as "(Bank 1 Sensor 1)" or "- Bank 1" out of the condition match.
  let tail = '';
  const tailMatch = body.match(/\s*(\([^()]*\)|-\s*Bank\s*\d)\s*$/i);
  if (tailMatch && tailMatch.index > 0) {
    tail = tailMatch[1];
    body = body.slice(0, tailMatch.index).trim();
  }

  let result = null;
  for (const [re, es] of conditionRes) {
    const m = body.match(re);
    if (!m) continue;
    const subject = body.slice(0, m.index).trim();
    if (!subject) break; // the whole description is the condition — translate it plainly
    result = `${translatePhrase(subject)}: ${es}`;
    break;
  }
  if (result === null) result = translatePhrase(body);
  if (tail) result += ` ${translatePhrase(tail.replace(/^-\s*/, '('))}${tail.startsWith('-') ? ')' : ''}`;
  result = result.replace(/\s+/g, ' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// --- coverage reporting ------------------------------------------------------

const STOPWORDS = [' the ', ' of ', ' and ', ' to ', ' with '];
const hasStopword = (s) => {
  const padded = ` ${s.toLowerCase()} `;
  return STOPWORDS.some((w) => padded.includes(w));
};

// Every word the glossary can emit counts as Spanish; acronyms/codes do not count as English.
const spanishWords = new Set();
for (const [, es] of [...GLOSSARY, ...CONDITIONS]) {
  for (const w of es.toLowerCase().split(/[^a-záéíóúñü0-9]+/)) if (w) spanishWords.add(w);
}
function englishLeftovers(s) {
  return s
    .split(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9]+/)
    .filter((w) => w && !/^[A-Z0-9]+$/.test(w) && !/\d/.test(w) && w.length > 1)
    .filter((w) => !spanishWords.has(w.toLowerCase()));
}

// --- main --------------------------------------------------------------------

const rows = parseCsv(readFileSync(SRC, 'utf8'));
const seen = new Map();
let duplicates = 0;
let skipped = 0;
for (const [rawCode, ...rest] of rows) {
  const code = (rawCode ?? '').trim().toUpperCase();
  if (!/^[PBCU][0-3][0-9A-F]{3}$/.test(code)) {
    skipped++;
    continue;
  }
  if (seen.has(code)) {
    duplicates++;
    continue;
  }
  const descEn = rest.join(',').trim().replace(/^"+|"+$/g, '').trim();
  seen.set(code, descEn);
}

// --- overrides & consistency check -------------------------------------------

const overrides = JSON.parse(readFileSync(OVERRIDES_SRC, 'utf8'));

const SYNONYMS = [
  [/mass or volume air flow|mass air flow/g, ' maf '],
  [/manifold absolute pressure/g, ' map '],
  [/intake air temperature/g, ' iat '],
  [/engine coolant temperature/g, ' ect '],
  [/throttle\s*\/\s*pe[td]al position|throttle position|pedal position/g, ' tps '],
  [/exhaust gas recirculation/g, ' egr '],
  [/evaporative emission( control)?( system)?/g, ' evap '],
  [/idle air control|idle control/g, ' iac '],
  [/vehicle speed sensor/g, ' vss '],
  [/torque converter clutch|torque converter/g, ' tcc '],
  [/ho2s|oxygen sensor|o2 sensor/g, ' o2 '],
  [/crankshaft/g, ' crank '],
  [/camshaft/g, ' cam '],
];
const NOISE = new Set(
  'circuit malfunction sensor system input problem detected condition control switch or and for the of to with a b c d e bank single sensors fault failure'.split(' '),
);

// What is wrong, as a set of classes. Compared strictly: "Circuit Low" vs "Circuit
// High" on the same sensor is exactly the off-by-one error this check hunts for.
const CONDITION_CLASSES = [
  ['rp', /range\s*\/\s*performance|\brange\b/],
  ['perf', /\bperformance\b(?!.*range)/],
  ['low', /\blow\b/],
  ['high', /\bhigh\b/],
  ['intermittent', /\bintermittent\b/],
  ['open', /\bopen\b/],
  ['short', /\bshort(ed)?\b/],
  ['stuck-on', /stuck on/],
  ['stuck-off', /stuck off/],
  ['slow', /slow response/],
  ['no-activity', /no activity/],
  ['no-signal', /no signal/],
  ['electrical', /\belectrical\b/],
  ['insufficient', /insufficient/],
  ['excessive', /excessive/],
  ['lean', /\blean\b/],
  ['rich', /\brich\b/],
  ['lower', /\blower\b/],
  ['higher', /\bhigher\b/],
];
const CONDITION_WORDS = new Set(
  'range performance low high intermittent open short shorted stuck on off slow response no activity signal electrical insufficient excessive lean rich lower higher voltage erratic'.split(' '),
);

/** Keywords, letters, numbers and condition classes of an English DTC description. */
function signature(text) {
  let t = ` ${text.toLowerCase().replace(/["()]/g, ' ')} `;
  for (const [re, rep] of SYNONYMS) t = t.replace(re, rep);
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
  const letters = tokens.filter((w) => /^[a-l]$/.test(w));
  return {
    words: new Set(tokens.filter((w) => w.length > 1 && !/^\d+$/.test(w) && !NOISE.has(w) && !CONDITION_WORDS.has(w))),
    // No letter means "A" (older wording omits it); no number means "1".
    letters: (letters.length ? [...new Set(letters)] : ['a']).sort().join(','),
    numbers: tokens.filter((w) => /^\d+$/.test(w) && w !== '1').sort().join(','),
    conditions: CONDITION_CLASSES.filter(([, re]) => re.test(t)).map(([c]) => c).join(','),
  };
}

/** Rough "same meaning" test on normalised keywords; see signature(). */
function sameMeaning(a, b) {
  const sa = signature(a);
  const sb = signature(b);
  if (sa.numbers !== sb.numbers || sa.letters !== sb.letters || sa.conditions !== sb.conditions) return false;
  const inter = [...sa.words].filter((w) => sb.words.has(w)).length;
  const union = new Set([...sa.words, ...sb.words]).size;
  return union === 0 ? true : inter / union > 0.75;
}

const codeNum = (code) => parseInt(code.slice(1), 16);
const numCode = (n) => 'P' + n.toString(16).toUpperCase().padStart(4, '0');

const compared = []; // [{ code, match, shift }]
for (const [code, ov] of Object.entries(overrides)) {
  const csv = seen.get(code);
  if (csv === undefined || !isGeneric(code)) continue;
  const match = sameMeaning(csv, ov.descEn);
  let shift = null;
  if (!match) {
    for (const d of [-1, 1, -2, 2, -3, 3]) {
      const neighbour = overrides[numCode(codeNum(code) + d)];
      if (neighbour && sameMeaning(csv, neighbour.descEn)) {
        shift = d;
        break;
      }
    }
  }
  compared.push({ code, match, shift });
}
compared.sort((a, b) => codeNum(a.code) - codeNum(b.code));

// A "shifted range" is a run of consecutive mismatching comparisons (≥ 2), widened
// to the gap up to the nearest matching comparison on each side (or the edge of
// the P0 block when there is none): rows in that gap were never checked and sit
// among rows known to be wrong.
const shiftedRanges = [];
for (let i = 0; i < compared.length; ) {
  if (compared[i].match) {
    i++;
    continue;
  }
  let j = i;
  // Extend over mismatches, tolerating one isolated agreement between two of them.
  for (;;) {
    if (j + 1 < compared.length && !compared[j + 1].match) j++;
    else if (j + 2 < compared.length && compared[j + 1].match && !compared[j + 2].match) j += 2;
    else break;
  }
  if (j > i) {
    const lo = i > 0 ? codeNum(compared[i - 1].code) + 1 : 0x0000;
    const hi = j + 1 < compared.length ? codeNum(compared[j + 1].code) - 1 : 0x0fff; // no agreement after it: to the end of P0
    const run = compared.slice(i, j + 1);
    shiftedRanges.push({ lo, hi, first: run[0].code, last: run[run.length - 1].code, count: run.filter((r) => !r.match).length, shifts: run.filter((r) => r.shift !== null).length });
  }
  i = j + 1;
}
const inShiftedRange = (code) => shiftedRanges.some((r) => codeNum(code) >= r.lo && codeNum(code) <= r.hi);

const UNVERIFIED_ES = 'Código genérico — descripción sin verificar (consulta un manual)';
const unverified = [];

// Overrides win over the CSV and add codes the CSV lacks.
const merged = new Map(seen);
for (const [code, ov] of Object.entries(overrides)) merged.set(code, ov.descEn);

const out = [...merged.entries()]
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  .map(([code, descEn]) => {
    const row = { code, system: SYSTEMS[code[0]], descEn, descEs: '', isGeneric: isGeneric(code) };
    if (overrides[code]) {
      row.descEs = overrides[code].descEs; // hand-written; never glossary-translated
    } else if (row.isGeneric && code[0] === 'P' && inShiftedRange(code)) {
      row.descEs = UNVERIFIED_ES;
      unverified.push(`${code} ${descEn}`);
    } else {
      row.descEs = translate(descEn) || descEn || code;
    }
    return row;
  });

writeFileSync(OUT, JSON.stringify(out) + '\n');

const stopwordRows = out.filter((r) => hasStopword(r.descEs));
const leftoverCounts = new Map();
let leftoverRows = 0;
for (const r of out) {
  if (overrides[r.code] || r.descEs === UNVERIFIED_ES) continue; // only glossary output is measured
  const words = englishLeftovers(r.descEs);
  if (words.length) leftoverRows++;
  for (const w of words) leftoverCounts.set(w, (leftoverCounts.get(w) ?? 0) + 1);
}
const topLeftovers = [...leftoverCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TOP ?? 40));

console.log(`rows written:        ${out.length}  → ${OUT}`);
console.log(`duplicates dropped:  ${duplicates}`);
console.log(`invalid codes:       ${skipped}`);
console.log(`generic / manuf.:    ${out.filter((r) => r.isGeneric).length} / ${out.filter((r) => !r.isGeneric).length}`);
console.log(`rows with English stopword (${STOPWORDS.map((s) => s.trim()).join(', ')}): ${stopwordRows.length}`);
for (const r of stopwordRows.slice(0, 10)) console.log(`   ${r.code}  ${r.descEs}`);
console.log(`rows with a leftover non-glossary word: ${leftoverRows}`);
console.log(`top leftovers: ${topLeftovers.map(([w, n]) => `${w}:${n}`).join(' ')}`);

const mismatches = compared.filter((c) => !c.match);
console.log(`overrides:           ${Object.keys(overrides).length} (${Object.keys(overrides).filter((c) => !seen.has(c)).length} added, not in CSV)`);
console.log(`CSV vs override:     ${compared.length} compared, ${compared.length - mismatches.length} agree, ${mismatches.length} disagree (${mismatches.filter((m) => m.shift !== null).length} match a neighbouring code)`);
console.log('shifted ranges (CSV text disagrees with the SAE definition):');
for (const r of shiftedRanges)
  console.log(`   ${numCode(r.lo)}–${numCode(r.hi)}  (${r.count} mismatches ${r.first}..${r.last}, ${r.shifts} look like an off-by-N shift)`);
console.log(`generic rows marked "sin verificar": ${unverified.length}`);
for (const u of unverified) console.log(`   ${u}`);
if (process.env.VERBOSE) for (const m of compared.filter((c) => c.match)) console.log(`   ✓ ${m.code}  CSV: ${seen.get(m.code)}  |  SAE: ${overrides[m.code].descEn}`);
if (process.env.VERBOSE) for (const m of mismatches) console.log(`   ✗ ${m.code} shift=${m.shift}  CSV: ${seen.get(m.code)}  |  SAE: ${overrides[m.code].descEn}`);
