# QuakeWatch IT — Future plan

Backlog di feature e miglioramenti **non in scope v1**. Ogni voce è un'idea in attesa di spec/plan; non è lavoro pianificato. Le future voci seguono lo schema della prima (Data · Stato · Contesto · Cosa sappiamo · Cosa manca · Decisioni aperte · Riferimenti).

---

## Stazioni sismiche INGV sulla mappa

Data: 2026-08-02 · Stato: in analisi

### Contesto

Opzione nel menu dell'header (`apps/web/components/shell/header-menu.tsx`) per mostrare sulla mappa le stazioni sismiche dell'INGV come layer opzionale. Presuppone disporre della loro posizione geografica.

### Cosa sappiamo (verificato empiricamente 2026-08-02)

- **Endpoint**: `GET https://webservices.ingv.it/fdsnws/station/1/query` — servizio FDSN standard, già documentato in `docs/api-web-services.md:119-148`.
- **Formato text**, `level=station`: righe pipe-separated
  `#Network | Station | Latitude | Longitude | Elevation | SiteName | StartTime | EndTime`
  - `EndTime` vuota = stazione ancora attiva.
- **CORS aperto** (`Access-Control-Allow-Origin: *`), identico all'endpoint Event.
- **Cache INGV `max-age=60`**, come Event.
- **`limit` non supportato** (400 "Unknown parameter"). Filtraggio via `network` / `station` / `starttime`/`endtime` / bbox.
- **Volume**: il solo bbox Campi Flegrei restituisce ~35 stazioni su reti multiple (`2I`, `IV`, `IX`, `Y4`). Tutta Italia = centinaia di stazioni su molte reti (`IV` nazionale, `MN`, `AC`, `3A`, `Y4`, `IX`, …).

### Cosa manca nel codebase

`packages/core` ha client/parser per event (text + QuakeML) e shakemap, ma niente per station. Da aggiungere seguendo il pattern esistente:

- `packages/core/src/types.ts` → tipo `Station`
- `packages/core/src/parse-station.ts` → parser text (analogico a `parse-text.ts`)
- `packages/core/src/fdsn-client.ts` → `buildStationsUrl()`
- `packages/core/src/hooks.ts` → `useStationsQuery()`
- `apps/web/app/api/stations/route.ts` → route handler proxy (come `api/events/route.ts`)

### Decisioni aperte

1. **Scope** — la design spec mette esplicitamente le stazioni fuori scope v1 (`docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md:148`). È una feature nuova: vuole una spec/plan in `docs/superpowers/` prima del codice.
2. **Filtro reti** — quali reti mostrare? Solo `IV` (nazionale INGV)? `IV` + OV (Osservatorio Vesuviano)? Tutte? Senza filtro il layer è rumore.
3. **Filtro validità** — solo stazioni attive ora (EndTime vuota / `endtime=<now>`)? O storiche?
4. **Cache proxy** — le stazioni cambiano raramente → cache molto più lunga dei 60s degli eventi (es. `s-maxage=86400` o più).
5. **Marker** — forma/colore neutri per non confonderli con gli epicentri (che usano già la codifica bivariata magnitudo/età). Legenda dedicata.
6. **UI** — toggle on/off nel menu (come la variante dettaglio esistente), stato persistito in **localStorage** via `usePersistentPref('stations', false)` (non in URL: è una preferenza, non una view — vedi AGENTS.md).

### Riferimenti

- `docs/api-web-services.md` (sez. FDSN Station)
- `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md` (riga 148, fuori scope v1)
- `apps/web/components/shell/header-menu.tsx` (dove andrebbe il toggle)
- `apps/web/app/api/events/route.ts` (pattern di riferimento per il proxy)

---

## Miglioramento aspetto mappa: province, città, terreno, stile switcher

Data: 2026-08-02 · Stato: in analisi

### Contesto

La mappa attuale (`packages/tokens/src/generate-map-style.ts`) è minimale: solo `background`, `water`, `boundary` admin_level 2 (stati) e 4 (regioni). Si vogliono: confini **province**, **città**, opzione **terreno naturale** (altitudine/montagna-pianura) e un controllo stile-navigatore a tile in `header-menu` per cambiare basemap.

### Cosa sappiamo (verificato empiricamente 2026-08-02)

**Tile source attuale** — OpenFreeMap `https://tiles.openfreemap.org/planet`, schema **OpenMapTiles** (confermato dalla TileJSON). Fonte free, keyless, CORS aperto. `maxzoom: 14`. Attribuzione obbligatoria: `OpenFreeMap · © OpenMapTiles · OpenStreetMap`.

**Dati già presenti nei tile** (nessuna nuova fonte per province/città):
- source-layer `boundary`, campo `admin_level` (Number): 2=stato, 4=regione, **6=provincia**, 8=comune.
- source-layer `place`, campi `class` (city/town/village/hamlet), `name`, `rank`, `capital`, **`name:it`** (localizzato).
- source-layer `mountain_peak` (veti con `ele`), `water_name` (nomi laghi/mari), `landcover` (vegetazione), `landuse`.

**Terreno** — OpenFreeMap non fornisce DEM. Opzione free keyless verificata:
- **AWS terrarium**: `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png` — CORS `Access-Control-Allow-Origin: *`, SRTM-based, globale, gratuita, nessuna chiave. Encoding `terrarium` per `raster-dem` source in MapLibre.
- Alternative: sonny LiDAR (Europa, più dettagliato), MapTiler (free tier a chiave).

### Cosa serve per ogni richiesta

1. **Province + città** = solo stile. Aggiungere a `buildMapStyle`:
   - layer `line` `boundary-province` filter `admin_level == 6`
   - layer `symbol` `place-city` / `place-town` con `text-field` su `name:it`, filter su `class`, `minzoom` per densità.
   - Nessuna nuova fonte, nessuna nuova dipendenza.

2. **Terreno** = nuova `source` `raster-dem` (terrarium) + layer `hillshade` (2D, consigliato) oppure `map.setTerrain()` (3D, distorce i marker se pitched). Per data-viz: **hillshade**.

3. **Stile switcher in `header-menu`** = `buildMapStyle(theme, basemap)` con varianti (es. `minimal` / `stradale` / `terrain`), stato in **localStorage** via `usePersistentPref('basemap', 'minimal')` (non in URL: è una preferenza, non una view — vedi AGENTS.md; `variant` segue lo stesso pattern), thumbnail statici (SVG/PNG) per le preview. Il meccanismo di swap `mapStyle` a runtime è già in uso in `quake-map.tsx:76` per il theme switch.

### Decisioni aperte

1. **Scope / deroga design spec** — la spec v1 (riga 114) fissa "mappa monocroma custom… confini e label sommessi, **zero POI**". Aggiungere città/POI/terrain è una **revisione di design**: va registrata come deroga o spec update, non come tweak.
2. **Contrasto visivo** — hillshade e label città non devono clashing con la codifica bivariata marker (magnitudo/età, riga 69). Legenda mappa (`map-legend.tsx`) va aggiornata.
3. **Hillshade vs 3D terrain** — hillshade (2D) consigliato per non distorcere le posizioni epicentro. 3D solo come toggle esperto?
4. **Varianti di basemap** — quali? `minimal` (attuale) / `stradale` (cities + roads) / `terrain` (hillshade) / `satellite`? Satellite serve fonte raster separata (es. ESRI World Imagery, free).
5. **Densità label** — filtro `class` + `minzoom` per evitare clutter (town da zoom 8, city da zoom 5, village mai o solo zoom alto).
6. **Localizzazione** — `name:it` con fallback a `name` (espressione `coalesce`).
7. **Attribuzione** — quando terrain attivo, aggiungere AWS/terrarium all'attribution control (vincolo: attribuzioni sempre visibili).
8. **Cache** — i tile DEM sono immutabili (SRTM): cache browser/CDN lunga, nessun bisogno di proxy.

### Riferimenti

- [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/) (source types: `vector`, `raster-dem`; layer types: `line`, `symbol`, `hillshade`)
- `packages/tokens/src/generate-map-style.ts` (stile attuale, dove si aggiungono layer)
- `apps/web/components/quake-map.tsx:76` (swap `mapStyle` a runtime già usato per il tema)
- `apps/web/components/shell/header-menu.tsx:64-74` (toggle `variant` — riferimento per il pattern, ora localStorage via `usePersistentPref`, non più URL state)
- `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md` riga 114 (vincolo "zero POI / monocroma" da derogare)

---

## Persistenza stato UI: view in URL, preferenze in localStorage

Data: 2026-08-02 · Stato: **implementato** (2026-08-04) — piano `docs/superpowers/plans/2026-08-03-persistenza-preferenze-localstorage.md`

### Contesto

Ora `variant` (preferenza) è codificato in URL insieme al view state (`window`/`area`/`event`/`t`). Con le feature future (basemap, stations, expert panel) l'URL diverrebbe `?window=24h&area=italia&event=123&t=…&variant=detail-float&basemap=terrain&stations=1&expert=1`: brutto e leakante preferenze nei link condivisi (history/referrer). Il pattern ibrido già esiste: theme su localStorage via next-themes, resto in URL.

### Decisione (2026-08-02)

- **View** (cosa guardi: `window`, `area`, `event`, `t`) → **URL**. Condivisibile, deep-linkable, server-renderable, back/forward.
- **Preferenze** (come ti piace: `variant`, future `basemap`/`stations`/`expert`) → **localStorage**. Persiste, privato, niente clutter, non richiede consenso (esenzione strictly-necessary dell'ePrivacy).
- Substrato: **localStorage** (non cookie — inviati al server a ogni request + rischio consenso; non IndexedDB — overkill per key-value; non sessionStorage — per-tab; non XState/zustand — over-engineering).
- URL può **override temporaneo**: deep link `?basemap=terrain` forza per quella visita, preferenza persistita = default quando l'URL non specifica.
- Theme resta su next-themes.

### Cosa serve

- Hook `usePersistentPref<T>(key, default)` — localStorage-backed, SSR-safe (null fino a `mounted`, come `nowMs`/`mounted` in `quake-map.tsx`). ~15 righe, zero librerie.
- Spostare `variant` da URL a localStorage (con URL override opzionale).

### Privacy (ePrivacy/GDPR, Italia/EU)

- localStorage per preferenze strettamente necessarie non richiede consenso (esenzione strictly-necessary). Nessun banner.
- App senza tracking/analytics/third-party (verificato in `apps/web/app/providers.tsx`). localStorage non lascia mai il device.
- Spostare le preferenze fuori dall'URL **riduce** il leak attuale (preferenze non finiscono in history/referrer dei link condivisi).

### Quando

Implementato il 2026-08-04 (piano `docs/superpowers/plans/2026-08-03-persistenza-preferenze-localstorage.md`). `variant` ora vive in localStorage via `usePersistentPref`; l'hook è pronto per le future preferenze (`basemap`/`stations`/`expert`). URL override temporaneo non implementato (YAGNI — si aggiunge se servirà shareable).

### Riferimenti

- `AGENTS.md` — Scelte chiuse (persistenza stato UI)
- `apps/web/lib/url-state.ts` (view state attuale in URL)
- `apps/web/app/providers.tsx` (next-themes già su localStorage, pattern di riferimento)
- `apps/web/components/shell/header-menu.tsx:64-74` (controllo `variant` da spostare)
- `apps/web/components/quake-map.tsx` (pattern SSR-safe `mounted`/`nowMs` da replicare nell'hook)

---

## ShakeMap: confronto `ingvws/shakedata/1` vs implementazione attuale

Data: 2026-08-02 · Stato: **scartato (overengineering)** — esame spec + probe live fatti

### Contesto

L'implementazione ShakeMap attuale fetcha un file statico JSON — `https://shakemap.ingv.it/data/{eventId}/current/products/cont_mi.json` (contorni MMI come GeoJSON `MultiLineString`) — via proxy `apps/web/app/api/events/[eventId]/shakemap/route.ts` (cache `s-maxage=300, swr=3600`). Si esamina il web service `ingvws/shakedata/1/` (spec OpenAPI/swagger) e si valuta se migrare migliora performance/stabilità.

### Cosa è emerso (spec `ingvws/shakedata/1/swagger.yml` + probe live, 2026-08-02)

Il web service è un **prodotto dati diverso**, non un sostituto del file `cont_mi.json`. Endpoint `GET /ingvws/shakedata/1/query`, parametri `eventid` (required) + `format` (required, `event`|`event_dat`) + `catalog` (`INGV` default / `ESM` / `ONT`) + `flag` (`0`/`1`/`all`). Output **XML** (`application/xml`), schema FDSN StationXML. Licenza dichiarata: **CC-BY 4.0**. Versione swagger 1.41.0 (servizio reale 1.52.6; `/version` 404, swagger non aggiornato — irrilevante).

Probe live sull'evento 46725592 (Campi Flegrei M4.7):

| | `shakemap.ingv.it/.../cont_mi.json` (attuale) | `ingvws/shakedata/1/query` (`event_dat`) |
|---|---|---|
| Cosa restituisce | **Output renderizzato**: contorni MMI GeoJSON (`MultiLineString` auto-colorate), pronto da disegnare | **Input grezzo**: ampiezze per stazione (acc/vel/psa03/psa10/psa30) in StationXML, da passare al programma USGS ShakeMap |
| Latenza | 0.13s | 4.1–4.4s (~30x) |
| Size | 9.666 bytes | 330.295 bytes (~34x; 433.642 su 12697591) |
| Formato | JSON | XML |
| CORS | assente (gestito dal proxy) | aperto `*` |
| Cache | ETag + Last-Modified (file statico nginx) | `public, max-age=60` (PHP 7.3-backed) |
| Stabilità | file statico | backend PHP |
| Licenza | non dichiarata esplicitamente | **CC-BY 4.0** (dichiarata nello spec) |

`format=event` (353 bytes) restituisce solo metadati evento (lat/lon/mag/depth/locstring) già coperti da FDSN event. Su `eventid` inesistente il servizio ritorna 200 con payload vuoto (152 bytes), non 204/404 come lo swagger suggerisce — comportamento non documentato da gestire se mai si consumasse.

Per disegnare i contorni MMI sulla mappa, il web service **non serve**: non restituisce contorni, ma dati strong-motion per stazione. Non c'è una migrazione like-for-like da valutare.

### Esito

- **Scartare come miglioramento all'implementazione ShakeMap attuale**: non è un sostituto. Sostituire `cont_mi.json` con `event_dat` significherebbe reimplementare l'interpolazione ShakeMap (GMPE + interpolazione spaziale + generazione contorni) in `packages/core` — overengineering puro, fuori dall'ambito di un'app informativa no-profit. La fonte attuale è inoltre *superiore* su performance (30x più veloce) e stabilità (file statico vs PHP-backed).
- **Tenere come nota per feature futura**: il web service potrebbe alimentare una feature **divisa** — visualizzazione dati strong-motion per stazione (PGA/PGV/PSA) — che si incrocia con la voce "Stazioni sismiche INGV sulla mappa" di questo backlog e con l'"expert mode" menzionata in `docs/superpowers/plans/2026-08-02-ui-mappa-dataviz.md:195`. Per quello servirebbe: parser StationXML (o `format=event_dat` text), route handler dedicato, layer mappa per stazione. Resta una feature nuova a sé, non un'evoluzione del layer ShakeMap.
- **Licenza**: il web service dichiara CC-BY 4.0, il file statico no. Utile per il blocker di release "verificare licenza dati INGV" (`AGENTS.md`, Vincoli non negoziabili) — anche se il file `cont_mi.json` resta la fonte per i contorni, la licenza esplicita del web service è un dato da registrare per l'attribuzione.

### Riferimenti

- Spec: `https://webservices.ingv.it/ingvws/shakedata/1/swagger.yml`
- `packages/core/src/shakemap.ts` (implementazione attuale: `buildShakemapContoursUrl`, `isShakemapContours`)
- `apps/web/app/api/events/[eventId]/shakemap/route.ts` (proxy attuale)
- voce "Stazioni sismiche INGV sulla mappa" in questo stesso doc (feature futura che potrebbe usare `ingvws/shakedata/1` per dati strong-motion)

---

## Layer mappa con faglie sismogeniche (DISS INGV)

Data: 2026-08-03 · Stato: in analisi

### Contesto

Layer opzionale sulla mappa con le faglie sismogeniche italiane, per dare contesto geologico agli epicentri. Riferimento proposto: esempio MapLibre "Add a GeoJSON line" (https://maplibre.org/maplibre-gl-js/docs/examples/add-a-geojson-line/). La domanda critica è la **fonte del dato**.

### Cosa sappiamo (verificato empiricamente 2026-08-03)

**Fonte: DISS 3.3.1 (INGV)** — Database of Individual Seismogenic Sources, https://diss.ingv.it. Compilazione di sorgenti sismogeniche potenziali per terremoti M>5.5 in Italia e area circostante.

- **Stesso publisher dei dati evento** (INGV) → coerente col vincolo di attribuzione "INGV — Osservatorio Nazionale Terremoti".
- **Licenza CC-BY 4.0 esplicita** → sblocca il blocker di release "verificare licenza dati INGV" (`AGENTS.md`, Vincoli non negoziabili).
- **DOI: 10.13127/diss3.3.1** → versione pinnata, riproducibile (allineato a `x-fdsnws-event` per il catalogo eventi).
- Copertura: Italia + area circostante (lon ~3–24, lat ~34–47).
- 4 categorie di sorgenti (Individual, Composite, Debated, Subduction), 8 feature type WFS.

**Endpoint WFS (GeoServer):** `https://services.seismofaults.eu/DISS331/ows`

- WFS 2.0.0, `GetCapabilities` disponibile.
- `outputFormat=application/json` → restituisce **GeoJSON nativo** (nessuna conversione lato client).
- CRS: **EPSG:4326** (WGS84) → match diretto MapLibre, nessuna riproiezione.
- **CORS chiuso** (nessun `Access-Control-Allow-Origin` su GetCapabilities né GetFeature) → serve il nostro proxy, come per ShakeMap.

**Feature type e volumi** (count via WFS `resultType=hits`, 2026-08-03):

| type | descrizione | features |
| :-- | :-- | :-- |
| `iss331` | Individual Seismogenic Sources | 132 (147 KB GeoJSON) |
| `csscnt331` | Composite SS — Contour | 2.193 |
| `csspln331` | Composite SS — Plane | 201 |
| `csstop331` | Composite SS — Top | 201 |
| `dss331` | Debated Seismogenic Sources | 44 |
| `subdcnt331` | Subduction Contours | 354 |
| `subdzon331` | Subduction Zones | 6 |
| `areaofrelevance` | Area of relevance | 3 |

**Geometria: `MultiPolygon`** (proiezione in superficie del piano di faglia 3D), **non `LineString`**. Proprietà per feature: `idsource` (es. `ITIS002`), `sourcename`, **`maxmag`** (magnitudo max attesa), `strike`/`dip`/`rake` (geometria faglia), `mindepth`/`maxdepth`, `length`/`width`, `latesteq` (ultimo terremoto associato, es. "21 May 2003"), **`linktoinfo`** (deep link `https://diss.ingv.it/diss331/sources.php?{idsource}` → 302 a `/mapper/sources.php?{id}`, **accessibile senza auth**, verificato), flag di qualità (suffisso `q`).

**Download alternativo:** `https://diss.ingv.it/download-diss-3-3-1` — bottone "Download GeoJSON" genera `DISS331_GeoJSON.zip` client-side (JSZip) fetchando ogni tipo via WFS; disponibili anche progetto QGis `.qgz` e SLD. Per l'app il **WFS via proxy è preferibile** (sempre allineato alla release, niente bundle nel repo, cache CDN).

**ITHACA (ISPRA, faglie capaci):** pagina non trovata (404 su `ithaca.isprambiente.it` e più URL `isprambiente.gov.it`). Presumibilmente discontinuato o ricollocato. DISS copre comunque il bisogno meglio: le *sorgenti sismogeniche* (M>5.5) sono più rilevanti di una mappa generica di faglie capaci per un'app di monitoraggio sismico.

### Sull'esempio MapLibre indicato

https://maplibre.org/maplibre-gl-js/docs/examples/add-a-geojson-line/ — pattern `addSource({type:'geojson'})` + `addLayer({type:'line'})` per una `LineString`. **È già il pattern in uso nel codebase** per i contorni ShakeMap (`apps/web/components/quake-map.tsx:238-252`: `<Source type="geojson">` + `<Layer type="line" paint={{'line-color':['get','color']}}>`). L'esempio non aggiunge nulla: è lo stesso pattern. Due note:

- L'esempio usa `maplibre-gl@6.1.0`; il progetto pinnna `^5` (AGENTS.md, fallimento silenzioso v6 verificato 2026-08). Il pattern `addSource`/`addLayer` è identico v5/v6 — valido come riferimento.
- Le faglie DISS sono **`MultiPolygon`**, non `LineString` → il layer sarà `fill` (riempimento) + opzionale `line` (contorno), non `line` su LineString. Esempi MapLibre più pertinenti: "Add a GeoJSON polygon" e "Style lines with a data-driven property".

### Cosa manca nel codebase

`packages/core` non ha client/parser per DISS. Da aggiungere seguendo il pattern esistente:

- `packages/core/src/diss.ts` → `buildDissUrl(type, bbox?)`, tipo `DissSource`, validazione Zod del GeoJSON WFS.
- `packages/core/src/hooks.ts` → `useDissQuery(type)` (TanStack Query, `staleTime` lungo — i dati cambiano solo a nuove release DISS, ~ogni 3–4 anni).
- `apps/web/app/api/diss/route.ts` → route handler proxy (come `api/events/[eventId]/shakemap/route.ts`), cache `s-maxage=86400` o più.
- Layer in `quake-map.tsx`: `<Source type="geojson" data={diss}>` + `<Layer type="fill">` + `<Layer type="line">` (contorno).

### Decisioni aperte

1. **Scope** — fuori scope v1 (la spec fissa mappa monocroma con soli epicentri + ShakeMap, riga 114). Feature nuova: vuole spec/plan in `docs/superpowers/` prima del codice.
2. **Quale/i feature type mostrare** — `iss331` (132 sorgenti individuali, M>5.5) è il candidato naturale per iniziare. `csscnt331` (2.193 contorni) è rumore a zoom basso. `dss331` (44 dibattute) utile ma con disclaimer. Subduction (Calabro-Ionio) rilevante per il sud. Inizio: solo ISS, espandere dopo.
3. **Stile** — `fill` con `fill-opacity` bassa + `line` contorno. Stile data-driven per `maxmag` (es. saturazione maggiore per M>6.5)? O neutro? Non deve clashing con la codifica bivariata marker magnitudo/età (riga 69) — la legenda mappa (`map-legend.tsx`) va aggiornata.
4. **Filtro bbox** — caricare tutto (ISS=147 KB, rientra nel budget) o filtrare per `area` view corrente? Tutto è più semplice; bbox riduce il payload ma complica l'hook.
5. **Toggle UI** — come stazioni/basemap: toggle in `header-menu`, stato in **localStorage** via `usePersistentPref('faults', false)` (preferenza, non view — vedi AGENTS.md).
6. **Interazione** — click sulla faglia → popup con `sourcename`, `maxmag`, `latesteq`, `strike`/`dip`, link `linktoinfo` (pagina dettaglio INGV).
7. **Disclaimer** — DISS è "work in progress" e non garantisce completezza (disclaimer esplicito INGV). La UI deve dichiararlo, coerente col vincolo "parametri preliminari/soggetti a revisione".
8. **Attribuzione** — aggiungere "DISS — INGV" all'attribution control quando il layer è attivo (vincolo attribuzioni sempre visibili).
9. **Versione** — puntare a `DISS331` (pinnato, riproducibile) o al "current version" endpoint? Pinnato per coerenza col catalogo eventi; migrare a mano a nuove release.

### Riferimenti

- DISS homepage: https://diss.ingv.it · Data: https://diss.ingv.it/data · DOI: https://doi.org/10.13127/diss3.3.1
- WFS GetCapabilities: `https://services.seismofaults.eu/DISS331/ows?service=WFS&request=getCapabilities`
- Licenza: CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- `apps/web/components/quake-map.tsx:238-252` (pattern `<Source type="geojson">` + `<Layer>` già in uso per ShakeMap)
- `apps/web/app/api/events/[eventId]/shakemap/route.ts` (pattern proxy di riferimento, cache CDN)
- `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md` riga 114 (vincolo mappa monocroma v1 da derogare)
- voce "Stazioni sismiche INGV sulla mappa" in questo stesso doc (pattern toggle/header-menu/localStorage di riferimento)

---

## Layer mappa faglie geologiche

Data: 2026-08-02 · Stato: in analisi (fonti verificate, decisione fonte da prendere)

### Contesto

Aggiungere un layer mappa opzionale con le faglie geologiche italiane. A monte: da dove reperire il dato. Il rendering è **già risolto** — `quake-map.tsx:242-251` renderizza già GeoJSON `MultiLineString` (contorni ShakeMap) come layer `line`, identico al pattern dell'esempio MapLibre `add-a-geojson-line`. La domanda è solo la **fonte del dato**.

### Fonti candidate (verificate 2026-08-02)

| Fonte | Copertura | Formato | Licenza | Note |
|---|---|---|---|---|
| **DISS 3.3.1** (INGV) | Italia + surrounding, faglie M≥5.5 | Download (shapefile/GeoPackage, da verificare) + servizio Seismofaults.EU | INGV (da verificare) | **Autoritativa Italia-specifica**, coerente con attribuzione INGV esistente. DOI 10.13127/diss3.3.1, v3.3.1 (2025). 4 categorie sorgenti sismogenetiche. |
| **GEM GAF-DB** (GEM Foundation) | Globale, Italia via SHARE (Woessner 2015) | **GeoJSON** (version of record), GeoPackage, KML, Shapefile | **CC-BY-SA-4.0** | **Lazy option**: GeoJSON pronto da renderizzare come-is. Repo `GEMScienceTools/gem-global-active-faults`. Attributi ricchi (dip, slip rate, kinematics, name). DOI 10.1177/8755293020944182. |
| **ITHACA** (INGV) | Italia, faglie capaci (capable faults) | Da verificare (sito non raggiunto al fetch) | INGV (da verificare) | `ithaca.ingv.it` — non verificato empiricamente (transport error). Da riprovare. |

### Raccomandazione

- **Primo step: GEM GAF-DB.** GeoJSON pronto, licenza aperta dichiarata, copertura Italia via SHARE. Zero lavoro di conversione: bundle o fetch + filter bbox Italia, render come `line` layer (pattern esistente). Per un progetto personale no-profit è il percorso lazy.
- **Upgrade futuro: DISS (INGV).** Più autoritativa e completa per l'Italia (M≥5.5, sorgenti sismogenetiche catalogate INGV), coerente con la fonte dati esistente. Richiede verifica formato download + conversione GeoJSON + licenza. Vale come evoluzione se il layer GEM si dimostra utile.
- **ITHACA**: riprovare il fetch; se accessibile, terza opzione (faglie capaci, complementare a DISS).

### Decisioni aperte

1. **Fonte** — GEM (lazy, GeoJSON pronto, CC-BY-SA-4.0) vs DISS (autoritativa INGV, più lavoro). Decisione da prendere in base a: completezza per Italia, effort integrazione, vincoli licenza.
2. **Licenza/sharealike** — GEM è **CC-BY-SA-4.0** (sharealike: opere derivate devono usare stessa licenza). DISS/INGV licenza da verificare. Rilevante per il blocker di release "verificare licenza dati INGV" (`AGENTS.md`, Vincoli non negoziabili) — va verificato prima di pubblicare.
3. **Distribuzione del dato** — bundle nel repo (file statico, ~MB filtrato Italia) vs route handler proxy/cache (come eventi/shakemap). Bundle è più lazy se il file è piccolo e immutabile; proxy se cambia o per non appesantire il bundle.
4. **Stile layer** — linea sottile neutra (es. grigio semitrasparente), non deve competere con la codifica bivariata marker (magnitudo/età). Legenda dedicata. Distinguere faglie capaci/sismogenetiche da faglie minori? Attributi GEM/DISS lo permettono.
5. **Toggle UI** — preferenza in localStorage (`usePersistentPref`, vedi voce persistenza in questo doc), non in URL. `?faults=1` solo come override temporaneo.

### Riferimenti

- [MapLibre: add a GeoJSON line](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-geojson-line/) (pattern rendering, già in uso per ShakeMap)
- GEM GAF-DB: https://github.com/GEMScienceTools/gem-global-active-faults (GeoJSON, CC-BY-SA-4.0)
- DISS 3.3.1: https://diss.ingv.it (INGV, Italia M≥5.5)
- ITHACA: https://ithaca.ingv.it (INGV, capable faults — da verificare)
- `apps/web/components/quake-map.tsx:242-251` (pattern GeoJSON line esistente)
- voci correlate in questo doc: "Persistenza stato UI" (toggle preferenza), "Miglioramento aspetto mappa" (layer/legenda)

---

## Theming accessibilità: contrasto mappa dark mode e leggibilità

Data: 2026-08-02 · Stato: in analisi (audit empirico da fare con preflight)

### Contesto

In dark mode la mappa ha contrasto insufficiente (land/water quasi indistinguibili, confini invisibili). Si valuta un miglioramento del theming in ottica accessibilità e leggibilità.

### Cosa è emerso (analisi `packages/tokens/src/palette.ts`, 2026-08-02)

MAP_DARK attuale:
- land `hsl(0 0% 8.5%)` vs water `hsl(0 0% 4%)` → entrambi molto scuri, luminanza relativa quasi identica (~1.1:1). Land/water praticamente indistinguibili. WCAG 1.4.11 (non-text contrast) richiede ≥3:1 per oggetti grafici.
- boundaryCountry `rgba(255,255,255,0.28)` su land → linea debolissima; boundaryRegion `rgba(255,255,255,0.10)` → invisibile.
- La spec (riga 114) dice "confini e label sommessi" — scelta deliberata, ma "sommesso" è stato over-applicato sotto la soglia di leggibilità. Fix = calibrazione (mantieni estetica, alza sopra la soglia), non reversal di design.

Altre note accessibilità:
- Markers magnitudo validati contro `#0a0a0a` (NEUTRAL_DARK 900 = app bg) ma la mappa land è `hsl(0 0% 8.5%)` (~`#151515`) — superficie di validazione leggermente diversa dal bg reale dei marker.
- TEXT_DARK secondary `hsl(0 0% 54%)` su bg `4%` → ~5.5:1, AA ma borderline per muted.
- Reduced motion già gestito (`quake-map.tsx` matchMedia).
- CVD safety dei colori magnitudo già validato (ΔE ≥8, commento in `scales.ts`).

### Skill e comandi da utilizzare

Già previsti da `.agents/rules/iter-sviluppo.md` (review trasversali + Fase 0):

- **Audit**: `cortex:preflight` (check statico: contrast ratios, a11y, AI-slop), `cortex:oklch-skill` (palette/contrasto in OKLCH), `cortex:studio-audit` / `wip-senior-audit` (audit prodotto live). Nel set skill disponibile: `preflight`, `ui-principles`.
- **Verifica visiva**: MCP chrome-devtools/playwright + `web-architect:web-screenshots` (conferma empirica del contrasto mappa).
- **Fix**: edit `palette.ts` (MAP_DARK/MAP_LIGHT land/water/boundary) — cambio a livello token, nessun codice. Validare con `dataviz/scripts/validate_palette.js` + `packages/tokens/test/scales.test.ts` (esistenti).
- **Verify**: `superpowers:verification-before-completion` + re-run `preflight`.

### Decisioni aperte

1. **Soglia target** — WCAG 1.4.11 ≥3:1 per oggetti grafici (land/water, boundaries) o più alto (es. 4.5:1) per leggibilità mappa? "Sommesso" ma sopra la soglia.
2. **Light mode** — land 94% vs water 85% (~1.7:1) anch'essa sotto 3:1; stesso fix?
3. **Markers vs land** — rivalutare i colori magnitudo contro la land reale (non app bg)?
4. **Scope entry** — solo palette mappa, o audit theming completo (text, status, primary)?
5. **AGENTS** — nessuna nuova regola: l'audit workflow è già in `iter-sviluppo.md`. Eventuale amendment solo se emerge una convenzione nuova (es. "validare sempre la palette mappa contro WCAG 1.4.11").

### Riferimenti

- `packages/tokens/src/palette.ts` (MAP_DARK/MAP_LIGHT da calibrare)
- `packages/tokens/src/scales.ts` (MAGNITUDE_COLORS, validator script)
- `.agents/rules/iter-sviluppo.md` (skill/audit obbligatori)
- `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md` riga 114 ("confini e label sommessi")
- skill: `preflight`, `ui-principles`, `cortex:oklch-skill`, `cortex:preflight`, `web-architect:audit-ux`

---

## Visualizzazione attività vulcanica: seconda vista vs layer su esistente

Data: 2026-08-02 · Stato: in analisi (fonti verificate)

### Contesto

Valutare l'aggiunta di una seconda visualizzazione (struttura speculare a `apps/web/app/home-client.tsx`) per attività vulcanica, oppure di un layer mappa sull'esistente. Verificare la fattibilità con gli stessi criteri delle voci precedenti (ricerca empirica della fonte dati).

### Cosa è emerso (verificato 2026-08-02)

**Nessun web service pubblico per attività vulcanica.** La pagina ufficiale dei web services INGV (`terremoti.ingv.it/webservices_and_software`) elenca solo:
- FDSNWS: `station`, `event`, `dataselect` (tutti sismici)
- EIDAWS: `routing`, `wfcatalog` (forme d'onda)
- INGVWS: `shakedata`, `sqlx`

Nessuna API per tremore vulcanico, emissioni di ash/gas, deformazione (uplift), livelli di allerta o eruzioni. Questi dati sono pubblicati come **bollettini** (PDF/pagine web) e pagine umane di listing sismico — non machine-readable:
- "Terremoti dei vulcani campani" → `terremoti.ov.ingv.it/gossip/` (Osservatorio Vesuviano, GOSSIP)
- "Terremoti dei vulcani siciliani" → `www.ct.ingv.it/.../elenco-eventi` (Osservatorio Etneo)

**La sismicità vulcanica è già nel FDSN event.** Query di prova (bbox Etna, giugno–ago 2026) restituisce eventi con:
- colonna `EventType` → tutti `earthquake` (il tipo non distingue i terremoti vulcanici)
- colonna `Author` → `SURVEY-INGV-CT` (Osservatorio Etneo) per gli eventi etnei
- Quindi i terremoti near-vulcano sono disponibili e identificabili per **bbox** e/o **contributor** (`SURVEY-INGV-CT` per Etna/Stromboli, `SURVEY-INGV-OV` per Vesuvio/Campi Flegrei attesi).

**Licenza**: dati INGV distribuiti **CC-BY 4.0** (confermato in pagina web services) — vale anche per la sismicità vulcanica (stessa fonte FDSN).

### Opzioni a confronto

| | Seconda vista (attività vulcanica) | Layer sismicità vulcanica su esistente |
|---|---|---|
| Fonte dati | **Non esistente** (nessuna API per tremore/ash/deformazione/eruzioni) | FDSN event (già integrato) — filtra per bbox vulcano / contributor |
| Fattibilità | **No** senza scraping di pagine umane (fragile, termini di servizio, non real-time) | **Sì**, costo basso |
| Scope onesto | Sarebbe un prodotto diverso (monitoraggio vulcanologico) — non sismico | Resta nel dominio sismico dell'app |
| Allerta | Rischio di leggersi come allerta vulcanica (dominio DPC, non questa app) | Nessun rischio: sono terremoti |

### Risorse esaminate (2026-08-02, follow-up)

**Aggregatori commerciali (risorse 2, 3) — dead end.** Reverse-engineering dei JS:
- `volcanodiscovery.de/app/earthquakemap/map_55.js` (Leaflet + Esri Ocean basemap): endpoint dati = `volcanoesandearthquakes.com/app/earthquakemap/getQuakeMarker.php?quakeId=` — **backend PHP proprietario**, nessuna API pubblica. Aggrega USGS + DB vulcani interno.
- `volcanoesandearthquakes.com/widget/volcanoInfo0.js` (2 MB): DB vulcani embedded (permalink a `volcanodiscovery.com/<coord>_unnamed.html`), fonte USGS citata. Stessa azienda del precedente.
- **Non usabili**: proprietari, commerciali, nessuna licenza di riuso, TOS, non INGV. Conferma: nessuna fonte aperta qui.

**INGV Open Data Portal (risorsa 4) — fonte machine-readable INGV, ma dataset di ricerca non real-time.** `data.ingv.it`:
- Data Registry istituzionale, dataset DOI-tagged, 3 dipartimenti (Terremoti, **Vulcani**, Ambiente).
- **CKAN API live verificata**: `data.ingv.it/api/3/action/package_search?q=etna` → 97 risultati, licenza CC-BY, holder INGV. Anche CSW (OGC) + OAI-PMH.
- Metadati CC0 1.0; dati sotto licenze Creative Commons.
- **Non è un feed real-time**: è un registry di dataset di ricerca (es. serie deformazione Etna, dati tremore). Può alimentare un layer "riferimento vulcani" curato (posizioni, info, link ai dataset), non un monitoraggio live.

**EPOS TCS Volcano Observations (risorsa 1) — infrastruttura ricerca, supersiti italiani.**
- Dati multidisciplinari (sismici, geodetici, elettromagnetici, geochimici, ambientali) per vulcani europei.
- Supersiti italiani: Vesuvio/Campi Flegrei + Etna (portale **MED-SUV**). Catalogo europeo vulcani **EUROVOLC** (72 vulcani attivi).
- Accesso via portale EPOS (non REST semplice). Licenza CC-BY-SA 4.0.
- Integrazione complessa, research-grade, non real-time. Il catalogo EUROVOLC può dare posizioni/nomi vulcani per un layer riferimento.

### Raccomandazione (aggiornata dopo follow-up)

- **Scartare la seconda vista live**: nessuna fonte real-time confermata (negativo anche dopo il follow-up su queste 4 risorse). Overengineer su fondamenta inesistenti.
- **Valutare il layer sismicità vulcanica su esistente** (FDSN, near-vulcano): ancora l'opzione cheap — filtro eventi FDSN per bbox vulcanico e/o contributor, preset aggiuntivi (Stromboli, Vulcano, Vesuvio), highlight marker. Resta onesta (sismicità, non attività).
- **NUOVO — Layer riferimento vulcani (curato, non live)**: posizioni + nomi + link a dataset INGV, via CKAN `data.ingv.it` e/o catalogo EUROVOLC (72 vulcani europei, CC-BY-SA 4.0). Distinto da "attività" (sarebbe fuorviante): layer cartografico di riferimento, non monitoraggio. Onesto col vincolo "mai allerta".
- **Distinzione UI**: "terremoti nell'area del vulcano X" / "riferimento vulcani", mai "attività/allerta vulcano" (vincolo non negoziabile: mai presentarsi come early warning; l'allerta vulcanica è dominio DPC/INGV-OV, non questa app).

### Decisioni aperte

1. **Scope** — layer sismicità vulcanica (FDSN), layer riferimento vulcani (CKAN/EUROVOLC), o entrambi? (Oggi: valutare entrambi come layer distinti, non seconda vista.)
2. **Filtro sismicità** — per bbox (abbiamo già `AREA_PRESETS` con `etna`/`campi-flegrei`) o per contributor (`SURVEY-INGV-CT`/`-OV`, richiede estendere `parse-text.ts` a catturare la colonna `Author`, oggi ignorata)?
3. **Presets vulcanici** — aggiungere Stromboli, Vulcano, Vesuvio a `AREA_PRESETS` (`packages/core/src/areas.ts`)?
4. **Marker** — stile distintivo per eventi near-vulcano e/o vulcani senza competere con la codifica bivariata magnitudo/età?
5. **EventType/Author parsing** — estendere `parseEventsText` (`packages/core/src/parse-text.ts`) a catturare `Author` (col 6) e `EventType` (col 14)? Oggi il parser salta entrambi.
6. **Layer riferimento vulcani — fonte** — CKAN `data.ingv.it` (dataset research, CC-BY, non posizioni vulcani per sé) vs catalogo EUROVOLC (72 vulcani, posizioni+nomi, CC-BY-SA 4.0, più adatto a un layer posizioni). Da verificare formato download EUROVOLC.
7. **`sqlx` INGVWS** — servizio non investigato ("API to interact with the output of SQLX software"); verificarne rilevanza in futuro.

### Vincoli non negoziabili (da AGENTS.md)

- Attribuzione **"INGV — Osservatorio Nazionale Terremoti"** sempre visibile (vale anche per sismicità vulcanica: stessa fonte). Per layer riferimento vulcani: attribuzione aggiuntiva EUROVOLC/EPOS se usati.
- Mai presentare come sistema di allerta/early warning — **in particolare per il vulcano** (l'allerta vulcanica è dominio DPC): la UI deve dire "terremoti nell'area del vulcano" / "riferimento vulcani", non "attività/allerta vulcano".
- Dati preliminari soggetti a revisione: dichiararlo.

### Riferimenti

- Pagina servizi INGV: `https://terremoti.ingv.it/webservices_and_software` (FDSNWS/EIDAWS/INGVWS, licenza CC-BY 4.0)
- INGV Open Data Portal: `https://data.ingv.it/docs/index_en.html` + CKAN API `https://data.ingv.it/api/3/action/package_search` (verificata, CC-BY, holder INGV)
- EPOS TCS Volcano Observations: `https://www.epos-italia.it/it/tcs-osservazioni-sui-vulcani` (MED-SUV, EUROVOLC, CC-BY-SA 4.0)
- Aggregatori commerciali (non usabili): `earthquakes.volcanodiscovery.com`, `www.volcanoesandearthquakes.com` — JS `map_55.js` (endpoint proprietario `getQuakeMarker.php`), `volcanoInfo0.js` (DB embedded)
- `docs/api-web-services.md` (FDSN event/station/dataselect)
- `packages/core/src/parse-text.ts` (parser: oggi ignora `Author` col 6 e `EventType` col 14)
- `packages/core/src/areas.ts` (`AREA_PRESETS`: `italia`, `campi-flegrei`, `etna` — da estendere)
- `apps/web/app/home-client.tsx` (struttura vista sismica, riferimento per il layer)
- Pagine umane (non API, solo riferimento): `terremoti.ov.ingv.it/gossip/` (Campania), `www.ct.ingv.it/.../elenco-eventi` (Sicilia)
