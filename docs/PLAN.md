# Tu Combustible RD — Plan & rules

## Research summary

Fuel trackers that people actually keep using (Fuelio, My Cars, Refuelr, OdoGrid) share the same core:

1. **Log a fill-up in under 20 seconds** while still at the pump.
2. **Two of three math**: gallons, RD$/gal, total — the third is calculated.
3. **Brim-to-brim economy**: km/gal is only honest between two full tanks. Partial fills still count toward spend, but they are rolled into the next full tank for consumption.
4. **Multi-vehicle**, local data, no account required.
5. **Spend dashboards**: this month, cost/km, split by fuel grade.

Dominican Republic specifics (MICM, weekly prices, Aug 15–21 2026 as seed):

| Combustible        | Unidad | Precio semilla |
|--------------------|--------|----------------|
| Gasolina Premium   | galón  | RD$ 341.10     |
| Gasolina Regular   | galón  | RD$ 307.50     |
| Gasoil Regular     | galón  | RD$ 259.80     |
| Gasoil Óptimo      | galón  | RD$ 293.10     |
| GLP                | galón  | RD$ 135.20     |
| Gas natural (GNV)  | m³     | RD$ 43.97      |

Odometers in RD are in **kilometers**. Pumps sell in **US gallons** (not liters). Currency is **DOP**.

## Product

A local-first Expo (React Native) app for Dominican drivers to register every carga, know how much they spend, and see real consumption (km/gal) by fuel type/grade.

**Not in v1:** accounts, cloud sync, receipt OCR, OBD2, live MICM scraping, maps of stations.

## Stack

- Expo + TypeScript + Expo Router (tabs)
- SQLite (`expo-sqlite`) for vehicles + fill-ups
- Spanish UI, DOP + galones + km
- No backend

## Information architecture

```
Onboarding → crear primer vehículo
Tabs:
  Inicio     dashboard (gasto mes, último km/gal, precios MICM)
  Cargar     form de carga (primary action)
  Historial  lista filtrable
  Cifras     tendencias y desglose por tipo
  Más        vehículos, precios de referencia, exportar JSON
```

## Domain rules

1. A **carga** belongs to exactly one vehicle.
2. Required: date, odometer (km), fuel type, at least two of {galones, precio/gal, total}.
3. `total = galones × precioPorGalon` (round to 2 decimals). GNV uses m³ instead of galones; same formula.
4. Odometer must be ≥ previous carga for that vehicle.
5. **km/gal (or km/m³)** for a full tank:
   - Find previous full tank.
   - Distance = current odo − previous full odo.
   - Volume = sum of volumes of every carga after that previous full, including the current full tank.
   - Economy = distance / volume. Skip if distance ≤ 0 or volume ≤ 0.
6. First full tank is a **baseline** (no economy yet).
7. Spend always includes partials. Economy never uses a lone partial as a complete tank.
8. Official MICM prices are **reference only**; the user can override them. Logged cargas always keep the price actually paid.
9. Fuel types are the MICM set above, grouped as:
   - Gasolina → Premium | Regular
   - Gasoil → Regular | Óptimo
   - GLP
   - GNV

## Data model

- `vehicles`: id, name, plate?, defaultFuelType, tankGallons?, createdAt
- `fillups`: id, vehicleId, occurredAt, odometerKm, volume, pricePerUnit, totalDop, fuelType, isFullTank, station?, notes?
- `settings`: activeVehicleId, referencePrices JSON, priceWeekLabel

## Design (identity)

Not a generic fintech dashboard. Visual language of a **tablero de precios de bomba** at dusk: deep petrol canopy, thermal-receipt cards, amber LED figures for money.

- Canopy `#0B1F1C`
- Receipt `#F3EFE4`
- Ink `#1C241F`
- LED amber `#F0B429`
- Nozzle coral `#E85D4C` (primary CTA)
- Grade teal `#3C9A8A`

Type: Syne (titles) + Figtree (UI) + IBM Plex Mono (money and km/gal).

Signature: the home hero is a **price board** — month spend in LED digits, with MICM grades as rows underneath.

## Implementation order

1. Scaffold Expo tabs app
2. Persistence + domain math
3. Screens: onboarding, cargar, inicio, historial, cifras, más
4. Seed reference prices and demo-safe empty states
