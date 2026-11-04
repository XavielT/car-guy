# Calibration drive (speed and odometer)

What the replay tests in `docs/imp-03112026/speed-before-after.md` cannot tell: how Car Guy's GPS speed compares with **your** car's speedometer and odometer. A car's speedometer reads high on purpose (commonly +2 to +6 %); the GPS is the truth. Do this once per car (and again after changing tyres).

## Speed (15 minutes, a safe straight road, ideally a highway)
1. Open the car → **Ficha → Calibración → Calibrar velocidad**.
2. Use cruise control if the car has it. A passenger reads and types; the driver never looks at the phone.
3. Hold a **steady** 60, then 80, then 100 km/h for at least 15 seconds each. At each speed the passenger types what the dashboard says (or photographs the dash) while the app shows the GPS speed.
4. Optional second check: run Google Maps or Waze on a second phone and note its speed at the same moments. The two phones should agree within ~1–2 km/h; if not, the road has tall buildings or a tunnel, or one phone has a poor view of the sky: repeat somewhere open.
5. After 3 samples the app proposes the median factor ("Tu tablero marca 4.2 % más que el GPS"). Accept it only if the three samples agree within about 1 %.

What to expect: the dash 2–6 % above the GPS. If the dash is *below* the GPS, or the factor is outside 0.8–1.2, something is wrong (the wrong number typed, a very poor GPS, a tyre-size change): repeat.

## Odometer (one fill-up cycle)
1. Fill the tank and note the odometer. Record every drive with Iniciar viaje (or leave automatic trips on).
2. Drive normally for ≥ 100 km. At the next fill-up note the odometer again.
3. Compare the odometer difference with Car Guy's total GPS km for the same period. A GPS total 1–3 % *below* the dash is normal (tyre size, calibration, the odometer rounding up).
4. The rule for the odometer factor is built and tested (`proposeOdoFactor`: ≥ 3 intervals of ≥ 100 km, median of odometer ÷ GPS), but **there is no screen for it yet**: until there is, this step is a manual comparison.

## Replaying a bad trip
No extra switch is needed: the raw GPS points of a trip are kept for 30 days, and **a long press on the trip map** exports the trip as GeoJSON, with every fix's time, speed and accuracy. `fixesFromTripGeojson` (lib/trips/exportGeojson.ts) loads that file back, and `analyzeFixes` (lib/trips/speed.ts) replays it through the SpeedEngine; a trip that looks wrong can then be saved as a fixture in `__tests__/trips/`.
