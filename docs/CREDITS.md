# Créditos

## Datos de referencia

These are the pickers' lists in `lib/domain/refdata/`. Each file also carries its own `source` and `license`.

| Archivo | Fuente | Licencia |
|---|---|---|
| `makes.json` | Curated by hand by Car Guy (60 makes, 863 models, DR/LATAM models included). Year ranges were checked against [us-car-models-data](https://github.com/abhionlyone/us-car-models-data) by Abhilash Reddy (abhionlyone), and two were corrected from it. Changes from that dataset: non-US makes and models added, global production years in place of US model years, and body styles left out. | Partial data from us-car-models-data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The rest is factual data (names, years) curated by Car Guy. |
| `bodyTypes.json` | Curated by Car Guy. The DR terms ("jeepeta", "guagua") come from general knowledge and have not been checked. | Car Guy's own list |
| `colors.json` | Curated by Car Guy. It has 18 exterior colours plus Otro, and separate lists for interior colour, material and finish. | Car Guy's own list |
| `oil.json` | SAE J300 grades and the API, ILSAC and ACEA specs come from Wikipedia's "Motor oil" article. API SQ, ILSAC GF-7, the OEM approvals and the brands come from general knowledge, and whether each brand is sold in the DR has not been checked. | Factual data, Car Guy's own list |
| `fluids.json` | Curated by Car Guy from general knowledge and not checked. The owner's manual has the final word. | Car Guy's own list |

Credit to show in Más → Acerca de: "Datos parciales: us-car-models-data (Abhilash Reddy), CC BY 4.0."

## Otros

- OBD-II codes (`lib/domain/dtc.es.json`): from mytrile/obd-trouble-codes, MIT. See `lib/domain/LICENSE-mytrile.txt`.
