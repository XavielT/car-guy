# 03 — MICM weekly prices (first-hand), DR fuel stations, and how to study Wheelz over adb

## A. MICM fuel prices — what exists (read through Xaviel's Chrome, 2026-09-30)

- The weekly notice lives at
  `https://micm.gob.do/direcciones/combustibles/avisos-semanales-de-precios/avisos-semanales-de-precios-de-combustibles/`.
  It lists the four latest notices as **PDF downloads** ("Aviso Precios Combustibles del 25 de
  septiembre al 02 de octubre del 2026 — Descargar .PDF") and one page per year back to 2001. Each
  notice covers a Saturday-to-Friday week (the current one says "del 25 de septiembre al 02 de
  octubre" — a Friday-to-Friday window in that wording; treat the *valid from* date as the first day
  named).
- `https://combustibles.micm.gob.do/` (the "Portal de Combustibles") is **stale** (its "último
  anuncio" is September 2025) — do not use it.
- `https://micm.gob.do/` home has a "Precios de Combustibles" block whose text was also stale
  (2023) on the first fetch; the notices page is the source of truth.
- No JSON/RSS. Fuel names used by MICM: *Gasolina Premium, Gasolina Regular, Gasoil Óptimo, Gasoil
  Regular, Kerosene, Gas Licuado de Petróleo (GLP), Gas Natural (GNV)*; prices in RD$ per galón
  (GNV per m³). The app's `FuelType` ids already map to these (lib/fuel.ts `FUEL_CATALOG`).

### Importer design (PROMPT-05)

`api/precios.ts` (Vercel function, scheduled weekly by Vercel Cron on Saturday 08:00 AST and callable
on demand): fetch the notices page → first "Descargar .PDF" link → download the PDF → extract text
(`pdf-parse` or `pdfjs-dist` legacy build in Node) → regex the seven fuel lines → validate (every
price within ±20 % of the previous stored week, all seven present, week label parsed) → upsert into
`carguy.fuel_price_ref` (week_start, week_end, fuel_type, price, source 'micm', pdf_url, imported_at)
→ respond with the row set; CDN cache 1 h. The app pulls the reference rows on launch when online
(anon select on that table only) and shows "Precios MICM · semana del 25 sep · importados el sáb"
with an **Editar** that creates a user row (source 'manual'). If the parse fails, the function
returns the last good week with `stale: true`, and the app shows the manual editor with the date
picker — nothing silently wrong. Store `raw_text` of the PDF for debugging (no personal data).

Unverified (from knowledge): whether the PDF is text-based every week (some ministries publish
scanned images); the prompt tells Claude Code to download the four current PDFs first and check
`pdftotext` output before writing the parser; if any is an image, the fallback is a **manual weekly
entry by Xaviel** with the date picker (still note 1) and the importer stays as a bonus.

## B. Fuel station brands in the Dominican Republic (for the picker)

Current list in `lib/fuel.ts` `STATIONS`: Texaco, Shell, TotalEnergies, Next, Isla, Esso, Pueblo,
Otra. Extended list (brands, from knowledge — verify names/spelling when Claude Code can fetch or
from Xaviel; mark GLP-only where applicable):

| Brand | Notes |
|---|---|
| Texaco | (Chevron licensee) |
| Shell | |
| TotalEnergies | formerly Total |
| Sunix | large local network |
| Isla | |
| Sigma | |
| Nativa | |
| **Petronan** | Xaviel's usual (note 7) |
| United Petroleum | |
| Next | |
| Esso | historical brand, still on some stations |
| Pueblo | |
| Petromóvil | |
| Gulf | |
| Ecopetróleo | |
| Coastal Petroleum | |
| Propagas | **GLP only** |
| Tropigas | **GLP only** |
| Sol / Independiente / sin marca | free text |
| Otra | free text |

Model: `refdata/stations.json` with `{ id, name, fuels: ['gasolina','gasoil','glp','gnv'] }`, the
picker filters by the fuel type of the log (GLP-only brands only when the fuel is GLP), shows
**recent stations first** (from the user's own logs), and keeps "Otra" free text. A user-typed name
that matches a brand (accent-insensitive) is normalised to it.

## C. Studying Wheelz on Xaviel's phone over adb (PROMPT-00) — read-only protocol

Xaviel authorised (2026-09-30): open the app, navigate by taps/scroll, take screenshots and UI
dumps, using his signed-in session. **Never**: start or end a drive, change any Wheelz setting,
touch his account/profile, post or share anything, grant permissions.

```
ADB=~/Android/Sdk/platform-tools/adb
$ADB devices                                   # the Redmi must be authorised
$ADB shell monkey -p com.gigamow.wheelz -c android.intent.category.LAUNCHER 1
$ADB exec-out screencap -p > docs/imp-30092026/01-research/wheelz/00-home.png
$ADB exec-out uiautomator dump /dev/tty > .../00-home.xml    # element tree with texts/ids
$ADB shell input tap X Y   |  input swipe x1 y1 x2 y2 300   |  input keyevent KEYCODE_BACK
```

Walk: home / live view (if a past drive is shown, not a live one) → drives timeline → one drive
detail (map, stats, speed distribution, replay, share sheet — open the share sheet and **cancel**)
→ statistics → settings → "Drive Tracking" (read the options: automatic, manual, both; sensitivity;
minimum trip; keep screen on) → permissions screen → profile (read only). For each screen: PNG +
XML dump + three lines in `05-wheelz-firsthand.md`: what it shows, what it lets you do, what Car Guy
takes from it (or not). Stop after 25 screenshots; if a dialog asks for anything, press Back.
