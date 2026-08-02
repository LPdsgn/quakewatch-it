# Risorse esterne — INGV su GitHub e cataloghi PA

Ricognizione (2026-08-01) dei cataloghi PA italiani e dell'organizzazione GitHub INGV (77 repository). Solo ciò che è rilevante per questo progetto.

## Repository INGV utili (github.com/INGV)

| Repo | Cosa | Rilevanza |
| :-- | :-- | :-- |
| [mcp-fdsnws-event](https://github.com/INGV/mcp-fdsnws-event) | **MCP server ufficiale INGV** per le API FDSN Event, multi-datacenter (INGV, EMSC, USGS, GFZ). 6 tool: ricerca eventi, dettaglio, arrivals, magnitudes, origins, focal mechanisms. Docker Hub: `ingv/mcp-fdsnws-event` (stdio) e variante `-mcpo` (wrapper REST/OpenAPI) | **Alta in sviluppo**: gli agent AI possono interrogare il catalogo eventi direttamente via MCP invece di curl manuali |
| [openapi](https://github.com/INGV/openapi) | Definizioni OpenAPI 3. Oltre a `fdsnws/event`, definisce **`ingvws/shakedata`** (dati di scuotimento per ShakeMap, `webservices.ingv.it/ingvws/shakedata/1/`) e schemi comuni riusabili (`definitions.yaml`) | Alta: shakedata è un servizio in più non citato in `api-web-services.md`; gli schemi comuni servono per tipizzare `packages/core` |
| [x-fdsnws-event](https://github.com/INGV/x-fdsnws-event) | Estensione version-aware del modello FDSNWS/event per cataloghi riproducibili | Media: riferimento concettuale per la logica revisioni |
| [shakemap4-web](https://github.com/INGV/shakemap4-web) | Portale web ShakeMap4 (JS, ★21) | Media: riferimento UI per eventuali mappe di scuotimento |
| [fdsnws-fetcher](https://github.com/INGV/fdsnws-fetcher) | Docker per recupero forme d'onda/resp/sac da nodi FDSN | Bassa ora: torna utile solo se in futuro entrano le waveform (fuori MVP) |
| [qquake](https://github.com/INGV/qquake) | Plugin QGIS che consuma i web services sismologici | Bassa: esempi d'uso reali delle query FDSN |

## Cataloghi PA — esito

- **Catalogo software Developers Italia**: INGV è publisher registrato (l'intera org GitHub viene indicizzata); 8 repo a catalogo via `publiccode.yml` (tra cui mcp-fdsnws-event, fdsnws-fetcher, shakemap4-web). Nessun'app di monitoraggio riusabile per il nostro caso.
- **PDND (catalogo e-service, 15.619 voci)**: **nessun e-service INGV**. Esistono servizi sismici regionali (Trento, Bolzano, Sicilia, Lombardia, Demanio) ma sono riservati alle PA aderenti con autenticazione PDND: non utilizzabili da un'app pubblica. Non rilevante per il progetto.
- **Piattaforme abilitanti (developers.italia.it/it/piattaforme)**: identità, pagamenti, notifiche per PA (IO, pagoPA, SEND, ecc.). Nessuna rilevanza per un progetto personale no-profit.

Conclusione operativa: la via FDSN diretta (già scelta) resta l'unica sensata; il valore aggiunto trovato è l'MCP server per lo sviluppo e il servizio `shakedata` come possibile estensione futura.

## ShakeMap: layer di scuotimento per la nostra mappa (verificato empiricamente 2026-08-02)

Esame di shakemap4-web + probe live del portale ufficiale `https://shakemap.ingv.it` (che È shakemap4-web deployato):

- **I prodotti per evento sono file statici pubblici**: `https://shakemap.ingv.it/data/{eventId}/current/products/…` con **lo stesso `eventId` FDSN** (verificato su 46725592, Campi Flegrei M4.7 del 2026-07-31)
- I file utili per un layer mappa:
  - `cont_mi.json` — **GeoJSON di contorni MMI** (MultiLineString), features auto-descrittive `{value, units, color, weight}` → in MapLibre basta un source geojson + line layer con `line-color: ['get','color']` (~10 KB per evento)
  - `intensity_overlay.png` (~27 KB) — riempimento raster; bounds in `info.json` → `output.map_information.{min,max}` (lon/lat) per un image source MapLibre
  - `cont_pga/pgv/psa*.json`, `stationlist`, legenda MMI in `mmi_legend.png`; scala colori in `js/colors.js` (USGS + variante INGV)
- **Niente CORS** sui prodotti → serve il nostro proxy (`/api/events/{id}/shakemap`), coerente con l'architettura (cache CDN)
- **Non tutti gli eventi hanno prodotti** (solo quelli processati, tipicamente M≥~3, più l'archivio storico macrosismico): si sonda per evento, 404 → niente layer
- `ingvws/shakedata` NON è la fonte dei prodotti: accetta solo `format=event|event_dat` e restituisce i dati di *input* per ShakeMap (ampiezze stazioni), non i render
- Cautele: endpoint dati del portale, non API documentata → degradare con grazia; prodotti soggetti a revisione (`/current/`); attribuzione ShakeMap INGV + condizioni d'uso da verificare pre-release (stesso blocker della licenza dati)

## Come consumare questi repo (niente submodule)

Modalità corrette:

- **mcp-fdsnws-event** → immagine Docker via voce in `.mcp.json` (`docker run -i --rm ingv/mcp-fdsnws-event`); il tag dell'immagine è il pin di versione.
- **openapi** → per il codegen dei tipi TS puntare alla raw URL pinnata a uno SHA, es. `raw.githubusercontent.com/INGV/openapi/<sha>/docs/fdsnws/event/0.0.1/event.yaml`.
- **x-fdsnws-event, shakemap4-web, qquake, fdsnws-fetcher** → sola lettura di riferimento; clonare altrove quando serve.
