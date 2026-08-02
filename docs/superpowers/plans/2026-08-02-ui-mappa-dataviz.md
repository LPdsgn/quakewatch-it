# Piano 3 — UI, mappa e dataviz

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La mappa diventa leggibile come le dashboard INGV: codifica bivariata dei marker (colore = classe di magnitudo, opacità = età), legenda, layer ShakeMap per evento, dettaglio flottante in A/B, round 2 della sidebar ("I più forti" + hero ultimo evento), chiusura dei residui UI del Piano 2.

**Architecture:** Le scale colori nascono in `packages/tokens` (scala classi magnitudo dark+light validata coi criteri dataviz; scala MMI = standard INGV/USGS fissa, identica nei due temi) e fluiscono nei layer MapLibre via feature properties. Il layer ShakeMap consuma i contorni `cont_mi.json` via un nuovo route handler proxy (fonte verificata: `https://shakemap.ingv.it/data/{eventId}/current/products/`, stesso eventId FDSN, no CORS — vedi `docs/risorse-esterne.md`). Corpus di riferimento: `docs/inspiration/dashboards/`.

**Tech Stack:** invariato (Piano 2). Nessuna dipendenza nuova.

**Spec:** `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md` (§2 con revisione 2026-08-02 "round dataviz"). Timeline → Piano 4 (riordino confermato).

## Global Constraints

- **Scale colori = dati, non skin.** La scala classi magnitudo segue la convenzione INGV (giallo→rosso per classi <2 · 2-2.9 · 3-3.9 · ≥4) ma i valori esatti si definiscono in OKLCH in `packages/tokens`, con passi distinti per dark e light, e si VALIDANO con criteri dataviz: separazione CVD tra coppie adiacenti ΔE(OKLab×100) ≥ 8 (6–8 solo con codifica secondaria — qui c'è: il raggio ∝ magnitudo), floor normal-vision ≥ 15, contrasto col surface del tema. Validator eseguibile in questa sessione: `node "C:\Users\ONDAR~1.BIO\AppData\Local\Temp\claude\bundled-skills\2.1.220\57ac8f3b19ed31944d9620a5ab022188\dataviz\scripts\validate_palette.js" "<hex,...>" --mode dark|light` — output incollato nel report; se il path non esiste più, il controller riesegue la validazione al review.
- **Scala MMI ShakeMap: standard di dominio, NON si ristilizza** — valori da `js/colors.js` di shakemap4-web (`intColors`), identici in dark e light; i GeoJSON arrivano già auto-colorati e si rispettano.
- **Disciplina accento aggiornata (mappa):** il rosso pieno diventa territorio della classe M≥4; la **selezione** sulla mappa = anello (`circle-stroke`) in `--foreground` + raggio maggiorato, MAI un colore di classe; il rosso `--primary` resta per LIVE dot, selezione in LISTA e futuri cursori. Un solo elemento loud per schermo resta la regola.
- **Legenda obbligatoria e sempre raggiungibile**: classi magnitudo (colore), età (opacità), selezione (anello); scala MMI aggiunta SOLO quando il layer ShakeMap è attivo. Identità mai affidata al solo colore (etichette testuali sempre).
- **Niente colori hardcoded nei componenti**: tutto da `packages/tokens` (feature properties per i layer). I test tokens coprono le nuove scale (parità dark/light dei nomi, drift-guard theme.css invariato).
- Route handler ShakeMap: semantica HTTP standard, cache `public, s-maxage=300, stale-while-revalidate=3600` (i prodotti si aggiornano con le revisioni ShakeMap, non al minuto), 404 upstream → 404, guasto → 502 `no-store`, timeout `AbortSignal.timeout(10_000)`. Fixture da risposta REALE (mai a mano).
- Copy strumentale (mai allerta/allarme/pericolo); attribuzione prodotto: il layer ShakeMap mostra "ShakeMap INGV" accanto alla legenda MMI.
- TDD dove c'è logica; RED catturato PRIMA dell'implementazione; mai dichiarare un rosso "pre-esistente" senza verifica sul parent commit.
- Pre-commit hook (mai `--no-verify`); commit in italiano; mai trailer `Co-Authored-By`.
- Gate di fine piano: `pnpm test && pnpm lint && pnpm lint:types && pnpm typecheck && pnpm format:check && pnpm --filter web build` verdi.

## Struttura file (nuovi/modificati)

```
packages/tokens/src/scales.ts        — MAGNITUDE_CLASSES (soglie+colori dark/light+label), MMI_SCALE
packages/tokens/test/scales.test.ts
packages/core/src/shakemap.ts        — tipi ShakemapContours + buildShakemapUrl(eventId)
packages/core/test/shakemap.test.ts  (+ fixture reale cont_mi in test/fixtures/)
apps/web/app/api/events/[eventId]/shakemap/route.ts (+ test)
apps/web/components/quake-map.tsx    — bivariata, anello selezione, layer shakemap
apps/web/components/map-legend.tsx   — legenda overlay (magnitudo/età/selezione/MMI)
apps/web/components/shell/event-detail.tsx — toggle "Scuotimento (ShakeMap)"
apps/web/components/shell/strongest.tsx    — pane "I più forti"
apps/web/components/shell/summary.tsx      — hero "ultimo terremoto"
apps/web/components/shell/event-detail-float.tsx — variante A/B flottante
apps/web/app/home-client.tsx         — wiring + ?variant= per l'A/B
```

---

### Task 1: Tokens — scala classi magnitudo (validata) e scala MMI

**Files:**
- Create: `packages/tokens/src/scales.ts`, `packages/tokens/test/scales.test.ts`
- Modify: `packages/tokens/src/index.ts`

**Interfaces:**
- Produces:
  - `MagnitudeClass { id: string; label: string; min: number; max: number | null }`
  - `MAGNITUDE_CLASSES: readonly MagnitudeClass[]` — 4 classi convenzione INGV: `{id:'m0',label:'Fino a 2',min:0,max:2}`, `{'m2','2.0–2.9',2,3}`, `{'m3','3.0–3.9',3,4}`, `{'m4','4.0+',4,null}`
  - `MAGNITUDE_COLORS: Record<ThemeName, Record<classId, string>>` — OKLCH→stringhe colore; hue giallo→rosso; lightness/chroma calibrate per superficie (dark: passi più chiari; light: più saturi/scuri)
  - `magnitudeClassOf(magnitude: number): MagnitudeClass`
  - `MMI_SCALE: readonly { value: number; label: string; color: string }[]` — da `intColors` di shakemap4-web (1→10, colori fissi, stessi in entrambi i temi)
- Consumato da T2 (mappa), T3 (legenda), T6 (layer MMI)

- [ ] **Step 1: test che falliscono** — copertura: 4 classi ordinate e contigue (max di una = min della successiva); `magnitudeClassOf` su boundary esatti (1.99→m0, 2→m2, 4→m4, 6.5→m4); colori presenti per OGNI classe in ENTRAMBI i temi (parità nomi); MMI_SCALE con 10 step e colori identici nei due temi; nessuna classe usa lo stesso identico valore di `--primary` (il rosso M≥4 è VICINO ma distinto dal rosso brand: il brand resta riconoscibile). Cattura RED.
- [ ] **Step 2: implementa.** Colori di partenza (poi validati e ritoccati): dark `m0 oklch(0.85 0.16 100)`, `m2 oklch(0.78 0.16 80)`, `m3 oklch(0.72 0.18 55)`, `m4 oklch(0.62 0.22 30)`; light `m0 oklch(0.75 0.15 100)`, `m2 oklch(0.68 0.16 75)`, `m3 oklch(0.60 0.19 50)`, `m4 oklch(0.52 0.22 28)`. Emetti stringhe `oklch(...)` (MapLibre le accetta; verifica su maplibre-gl 5, in caso converti a hex nel modulo).
- [ ] **Step 3: VALIDAZIONE dataviz (obbligatoria, evidenza nel report).** Converti i 4 colori per tema in hex (script Node inline nel report) e lancia il validator con `--mode dark` (surface `#0a0a0a`) e `--mode light` (surface del tema light da theme.css): tutte le coppie adiacenti devono passare (ΔE≥8 target; 6–8 accettabile SOLO documentando la codifica secondaria raggio; normal-vision ≥15 hard). Se un passo fallisce, ritocca lightness/chroma (non lo hue) e ripeti. Output completo del validator nel report per entrambi i temi.
- [ ] **Step 4: verifica PASS + typecheck + commit** — `tokens: scala classi magnitudo (validata CVD/contrasto) e scala MMI ShakeMap`

---

### Task 2: Mappa — codifica bivariata + anello selezione

**Files:**
- Modify: `apps/web/components/quake-map.tsx`

**Interfaces:**
- Consumes: `MAGNITUDE_COLORS`, `magnitudeClassOf` (T1)
- Produces: marker `circle-color` = colore classe (feature property, per tema), `circle-opacity` = età (logica esistente invariata, MA la selezione non forza più opacity 1 col colore: vedi sotto); selezione = secondo layer `events-selected-ring` (circle stroke `--foreground` width 2, fill transparent, raggio = raggio marker + 3) filtrato su eventId selezionato; il vecchio rosso selezione/più-recente sui marker SPARISCE (il pulse resta, invariato, gated live)

- [ ] **Step 1: implementa** — il colore rosso `RED[500]` non è più usato per i marker (resta solo nel pulse layer); `isAccent`/logica introdotta dal fix f6c885a si rimuove; l'evento selezionato mantiene opacity 1 + anello. Niente colori inline: mappa `MAGNITUDE_COLORS[themeName]` → property `color` per feature.
- [ ] **Step 2: verifica** — typecheck/lint/test/build verdi; dev boot + curl 200. Verifica visiva (controller/browser MCP): 4 classi distinguibili su dark E light, anello selezione visibile su ogni classe, pulse invariato.
- [ ] **Step 3: commit** — `web: marker bivariati per classe di magnitudo con anello di selezione`

---

### Task 3: Legenda mappa

**Files:**
- Create: `apps/web/components/map-legend.tsx`
- Modify: `apps/web/app/home-client.tsx` (mount), `apps/web/components/quake-map.tsx` (solo se serve passare stato)

**Interfaces:**
- Consumes: `MAGNITUDE_CLASSES`, `MAGNITUDE_COLORS`, `MMI_SCALE` (T1); tema da next-themes
- Produces: `<MapLegend showMmi={boolean} />` — overlay sulla mappa (angolo basso-sinistra, sopra l'attribution), pane compatto stile shell (bg-card/85 + backdrop-blur, radius, testo 10-11px): righe classi magnitudo (dot colorato + label), riga età (3 dot stessa classe a opacità 1/0.65/0.35 + "recente → 12h+"), riga selezione (anello + "selezionato"); sezione MMI (10 step compatti + "ShakeMap INGV") SOLO quando `showMmi`. Su mobile: collassata di default in un bottone "Legenda" (44px target), espansa in popover/pane sopra il sheet; `aria-label` esplicito.

- [ ] **Step 1: implementa** (requisiti sopra; label testuali sempre — identità mai solo colore)
- [ ] **Step 2: verifica** — gate verde; visiva: leggibilità su entrambi i temi, non copre l'attribution né il TimelineSlot, mobile collassata non copre i chip
- [ ] **Step 3: commit** — `web: legenda mappa (classi magnitudo, età, selezione; MMI on-demand)`

---

### Task 4: Proxy ShakeMap — core + route handler

**Files:**
- Create: `packages/core/src/shakemap.ts`, `packages/core/test/shakemap.test.ts`, fixture `packages/core/test/fixtures/shakemap-cont-mi.json`
- Create: `apps/web/app/api/events/[eventId]/shakemap/route.ts`, `apps/web/test/api-shakemap.test.ts`
- Modify: `packages/core/src/index.ts`, `apps/web/lib/env.ts` (var `SHAKEMAP_BASE_URL` default `https://shakemap.ingv.it`)

**Interfaces:**
- Produces (core): `buildShakemapContoursUrl(baseUrl: string, eventId: string): URL` → `{base}/data/{eventId}/current/products/cont_mi.json`; tipo `ShakemapContours` (FeatureCollection di MultiLineString con properties `{value, units, color, weight}`) + guard `isShakemapContours(json): boolean` (validazione struttura minima: FeatureCollection, features con properties.value numerico e color stringa)
- Produces (route): `GET /api/events/:eventId/shakemap` → 200 GeoJSON pass-through con `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`; 400 id non numerico; upstream 404/204 → 404 `no-store`; upstream !ok/throw/JSON non valido → 502 `no-store`; `AbortSignal.timeout(10_000)`
- Consumato da T5 (hook+layer)

- [ ] **Step 1: fixture reale** — `curl -s 'https://shakemap.ingv.it/data/46725592/current/products/cont_mi.json' -o packages/core/test/fixtures/shakemap-cont-mi.json` (9 feature MMI verificate 2026-08-02); documenta eventId nel README fixtures
- [ ] **Step 2: TDD core** (RED catturato): URL esatta; guard true sulla fixture reale, false su `{}`/array/features senza value
- [ ] **Step 3: TDD route** (pattern api-event-detail.test.ts, fetch stubbato): 200+header con fixture, 400, 404 (upstream 404 E 204), 502 (500/timeout/JSON invalido)
- [ ] **Step 4: verifica live** — dev boot, `curl /api/events/46725592/shakemap` → 200 con 9 feature; un eventId senza prodotti → 404
- [ ] **Step 5: commit** — `shakemap: proxy contorni MMI con validazione struttura e cache CDN`

---

### Task 5: Layer ShakeMap sulla mappa + toggle nel dettaglio

**Files:**
- Create: hook `useShakemapQuery(eventId: string | null, enabled: boolean)` in `packages/core/src/hooks.ts` (+ test)
- Modify: `apps/web/components/quake-map.tsx` (Source/Layer contorni), `apps/web/components/shell/event-detail.tsx` (toggle), `apps/web/app/home-client.tsx` (stato `showShakemap`, reset a cambio evento), `map-legend.tsx` (riceve showMmi)

**Interfaces:**
- Hook: queryKey `['shakemap', eventId]`, `enabled: enabled && eventId !== null`, staleTime 300_000; 404 → `data: null` SENZA isError (assenza prodotto = stato normale: usa un fetchJson che su 404 ritorna null)
- Toggle nel dettaglio: switch/bottone "Scuotimento (ShakeMap)" visibile SOLO se il prodotto esiste (hook con enabled=true parte al mount del dettaglio; se null → riga "ShakeMap non disponibile per questo evento" muted, niente toggle); attivo → layer line sulla mappa (`line-color: ['get','color']`, `line-width: ['get','weight']` cap 3, opacity 0.9, SOTTO il layer epicentri) + legenda MMI on + attribuzione "ShakeMap INGV" in legenda
- Stato `showShakemap` si azzera al cambio di evento selezionato e alla chiusura del dettaglio

- [ ] **Step 1: TDD hook** (404→null senza errore; 200→FeatureCollection; disabled→idle)
- [ ] **Step 2: implementa layer+toggle+wiring**
- [ ] **Step 3: verifica** — gate verde; visiva: evento 46725592 (deep-link `/?event=46725592`) mostra toggle, contorni colorati leggibili su dark e light, legenda MMI appare/scompare; evento senza prodotto mostra la riga muted
- [ ] **Step 4: commit** — `web: layer ShakeMap con toggle nel dettaglio e legenda MMI`

---

### Task 6: A/B — dettaglio flottante su mappa (desktop)

**Files:**
- Create: `apps/web/components/shell/event-detail-float.tsx`
- Modify: `apps/web/app/home-client.tsx` (switcher `?variant=detail-float`, gated `process.env.NODE_ENV !== 'production'` per lo switcher UI ma la variante raggiungibile via URL in dev)

**Interfaces:**
- Variante B (riferimento: `docs/inspiration/dashboards/ingv-popup-dettaglio-su-mappa.webp`): con `?variant=detail-float`, su ≥md il dettaglio NON sostituisce la lista — appare come riquadro flottante ancorato in alto-sinistra della mappa (~360px, max-h 70%, scroll interno, stesso contenuto di EventDetail: RIUSA il componente, wrapper diverso); la lista resta visibile e navigabile. Mobile: invariato (sheet). Default (senza param): comportamento attuale.
- Cleanup della variante perdente: NON in questo piano — decisione utente al termine, task nel piano successivo o fix diretto post-verdetto.

- [ ] **Step 1: implementa** (riuso EventDetail, zero duplicazione contenuto; focus management coerente — il focus va al back del riquadro)
- [ ] **Step 2: verifica** — gate verde; entrambe le varianti navigabili in dev; annota nel report l'URL per il confronto utente
- [ ] **Step 3: commit** — `web: variante A/B dettaglio flottante su mappa (desktop, ?variant=detail-float)`

---

### Task 7: Sidebar round 2 — "I più forti" + hero ultimo evento

**Files:**
- Create: `apps/web/components/shell/strongest.tsx`
- Modify: `apps/web/components/shell/summary.tsx` (o header), `apps/web/app/home-client.tsx`, `apps/web/components/shell/mobile-sheet.tsx`

**Interfaces:**
- `<Strongest events onSelect selectedId />`: pane "I più forti" — top 4 della finestra per magnitudo (poi per recenza a parità), righe compatte cliccabili (stesso pattern EventList: mono magnitudo COL COLORE DI CLASSE come dot/testo, località, tempo relativo); collocato tra Riepilogo e Preset; su mobile dentro il sheet (half)
- Hero ultimo evento (riferimento dashboard 7giorni): nel pane Riepilogo, sopra le tre stat, una riga sentence-style: "Ultimo: **Md 1.0** — Campi Flegrei, 12 min fa" (dati dall'evento più recente; clickable → seleziona)
- Rispetta la lingua dei numeri (mono, tnum) e i token; nessun colore fuori scala classi

- [ ] **Step 1: implementa**
- [ ] **Step 2: verifica** — gate verde; visiva: gerarchia del pane stack regge (non ruba scena alla lista), mobile ok
- [ ] **Step 3: commit** — `web: pane "I più forti" e hero ultimo evento nel riepilogo`

---

### Task 8: Residui Piano 2

**Files:**
- Modify: `apps/web/components/shell/mobile-sheet.tsx` (passa `hasError` alla Summary inline del PEEK — parked della fix wave), `apps/web/components/shell/event-detail.tsx` (copy differenziata: 404 evento → "Evento non trovato."; altri errori → copy attuale; richiede status dal fetch: estendi il fetchJson dell'hook dettaglio per esporre il 404 come `data:null` analogo a T5, con riga dedicata), `packages/tokens/src/index.ts` (import con estensione `.ts` uniforme — deferred T2/P2)

- [ ] **Step 1: implementa i tre fix** (per il dettaglio: se il cambio hook è invasivo, documenta e limita al copy generico più onesto — "Dettaglio non disponibile." — senza promettere retry)
- [ ] **Step 2: verifica + commit** — `web: residui Piano 2 (hasError su peek mobile, copy dettaglio, import uniformi tokens)`

---

### Task 9: Verifica finale del piano

- [ ] **Step 1: gate completo** — i 6 comandi, tutti verdi
- [ ] **Step 2: verifica visiva** (browser MCP se disponibile, altrimenti checklist all'utente): bivariata su entrambi i temi ai 4 breakpoint; legenda (+MMI col layer attivo); anello selezione; ShakeMap su 46725592 e assenza su evento minore; A/B fianco a fianco; "I più forti"; hero; pulse invariato; disciplina accento (il rosso brand appare solo su LIVE/lista/selezione lista)
- [ ] **Step 3: aggiorna la coda del piano con l'esito e i deferred** + commit — `Piano 3: esito esecuzione`

## Decisioni chiuse in stesura

- Soglie classi = convenzione INGV (0-2, 2-2.9, 3-3.9, 4+); niente classe 5+ separata finché i dati non la richiedono (YAGNI)
- Contorni MMI (line) e NIENTE overlay raster in v1 (il PNG georeferenziato è un'estensione futura documentata in risorse-esterne)
- Legenda = overlay mappa (non pane sidebar): vicina a ciò che spiega
- Selezione mappa = anello foreground; il rosso brand esce dai marker
- Cleanup variante A/B perdente: fuori piano, post-verdetto utente

## Fuori scope (→ Piano 4+)

Timeline+scrubber (eredita le scale di questo piano), mini-chart andamento giornaliero in sidebar (stesso dataset della timeline), overlay raster ShakeMap, expert mode Tweakpane, pagine /evento/[id] e /info, stati resilienza avanzati (banner staleness/offline).

---

## Esito esecuzione (2026-08-02)

Tutti i 9 task completati su main, subagent-driven, review per task + review finale whole-branch (fable). Gate finale 6/6 verde (111 test: tokens 23, core 47, web 41). Verifica visiva browser (light/dark, desktop/mobile): superata.

- **T1–T3** scale token + mappa bivariata + legenda: commit `8f94de5`, `83eab2d`, `5ff11cd`+`17bf686` (fix round)
- **T4** proxy ShakeMap: `a68ccd1` — **T5** layer+toggle: `86f4db4`+`714e1aa` (fix round: reset showShakemap state-derived, 502 ≠ assenza)
- **T6** A/B dettaglio flottante: `3758eb2`+`bba5b70` (fix round: key={state.event}) — **verdetto utente: vince B (float)**; cleanup variante A → piano successivo
- **T7** I più forti + hero: `ae4296f` — **T8** residui Piano 2: `89aa9da`
- Interludio utente: `32bd51d` (dvh), `c192aec` (cap sheet HALF), `bdcf98b` (switch Mappa d'impatto, X desktop), più tuning vari
- Fix wave review finale: `9326658` (useId per switch ShakeMap, focus stabile back button su mobile)

### Da fare nel piano successivo (fix-scheduled, non silenziosamente deferred)

1. **Legenda mobile irraggiungibile a HALF** (Important della review finale): l'offset deriva solo da SHEET_PEEK ma col dettaglio aperto lo sheet sta a HALF proprio quando appare la legenda MMI — derivare offset/ancoraggio dallo snap reale del sheet
2. ~~Cleanup variante A (perdente) + rimozione switcher dev~~ **Decisione utente 2026-08-02: variante A e switcher si TENGONO** come possibile futuro controllo avanzato di layout (es. expert mode); nota nel codice a home-client.tsx
3. `units`/`weight` opzionali in `ShakemapContours` + test 502 guard-fails + assert no-store nel test timeout
4. Valutare infra RTL/happy-dom in apps/web (ritira i deferred "nessun component test")
5. Edge case: focus-steal al crossing runtime del breakpoint 768px con dettaglio aperto (minor, nota della re-review fix wave)

### Deferred minori (triagiati "stays deferred" dalla review finale)

Duplicazioni difendibili (fetchShakemap/fetchEventDetail, one-liner evento più recente ×3, row markup Strongest), showMmi=intento non stato layer, tooltip località Strongest, skeleton height drift, pop-in ShakemapSection, variant param non gated in produzione (moot col cleanup A). Dettaglio completo nel ledger `.superpowers/sdd/2026-08-02-ui-mappa-dataviz/progress.md` (storico in git).
