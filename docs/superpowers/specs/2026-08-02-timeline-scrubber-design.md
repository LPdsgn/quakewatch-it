# Timeline + scrubber (Piano 4) — design

Data: 2026-08-02 · Stato: approvato a voce, in review scritta
Eredita: scale colore classi magnitudo validate (Piano 3, `packages/tokens/src/scales.ts`), stato URL (`apps/web/lib/url-state.ts`), pattern shell (Piano 2).
Riferimenti visivi: `docs/inspiration/timeline/` (tick di densità, passato pieno / oltre-cursore spento, readout mono centrato, cursore rosso).

## Decisioni chiuse in brainstorming (2026-08-02)

1. **Lo scrub fotografa tutta la UI**: al tempo T mappa, lista, riepilogo e "I più forti" riflettono lo stato ≤ T — non solo la mappa.
2. **Encoding istogramma**: bin temporali; altezza tick = conteggio eventi nel bin, colore tick = classe di magnitudo dell'evento più forte nel bin (scala tokens validata).
3. **Desktop + mobile nello stesso piano** (progetto mobile-first).
4. **Nessun tab finestra sulla timeline**: la finestra si cambia solo dai preset sidebar/sheet (un solo controllo, stato URL condiviso); la timeline riflette.
5. **Cursore persistito nell'URL**: `?t=<epoch s>`; assente = live.
6. **Mini-chart sidebar**: fuori scope, piano successivo (riuserà binning e scale).
7. **Drag a due livelli**: durante il gesto solo mappa (filter expression imperativa) + readout; al rilascio (e per click/tastiera) commit di `?t` → tutta la UI si aggiorna.
8. **Timeline mobile sotto l'header** (blocco overlay in alto, sotto Header + chip riepilogo), NON ancorata allo sheet: niente accoppiamento con lo snap del drawer né conflitto con la pill legenda.

## 1 · Stato e URL

- Nuovo param `t` in `url-state.ts` (parse/serialize accanto a `area`/`window`/`event`/`variant`): epoch **secondi** interi.
- Clamp in parse: `t ≥ adesso` → scartato (live); `t <` inizio finestra corrente → clamp all'inizio finestra. "Adesso" per il clamp = tempo del render (il confine live ha tolleranza di un bucket di polling, non serve precisione al ms).
- Cambio finestra/area: `t` si conserva se dentro il nuovo range, altrimenti clamp (gestito naturalmente dal parse al render successivo).
- Back/forward: nessun handler dedicato — lo stato deriva da `useSearchParams` (lezione T5: mai fidarsi degli handler per i cambi di stato URL).

## 2 · Snapshot globale (home-client)

- `const tMs = state.t !== null ? state.t * 1000 : null`
- `visibleEvents = useMemo(() => tMs ? events.filter(e => timeMs(e) <= tMs) : events, [events, tMs])` → passa a `EventList`, `Summary`, `Strongest`. La mappa NON usa `visibleEvents` (vedi §3).
- `isLive = state.window === '24h' && state.t === null` (pulse spento in modalità storica).
- **Deselezione coerente**: se `state.t` scavalca all'indietro l'evento selezionato (`event.time > t`), la selezione si azzera (effect: `router.replace` senza `event`); con lei spariscono dettaglio e layer ShakeMap. Regola pura testabile: `shouldDeselect(eventTimeMs, tMs)`.
- **Polling invariato**: gira solo sulla finestra 24h, 1 req/min verso il proxy (≤1 req/min verso INGV condivisa via CDN, `s-maxage=60`); in storica non si ferma — costo nullo aggiuntivo, ritorno a LIVE con cache fresca. Le altre finestre non pollano affatto.

## 3 · Mappa (QuakeMap)

- Il geojson resta **sempre completo** (zero `setData` durante lo scrub); le feature guadagnano `timeMs` nelle properties.
- `QuakeMap` espone un imperative handle `setTimeFilter(tMs | null)` che applica/rimuove `['<=', ['get','timeMs'], tMs]` sui layer `events-circle`, `events-pulse`, `events-selected-ring` (composto con i filter esistenti di pulse/ring).
- A commit di `?t`, home-client sincronizza il filtro dichiarativamente (prop `timeFilterMs` → effect interno che chiama lo stesso setter): il filtro imperativo del drag e quello da URL convergono sullo stesso codice.

## 4 · Componente Timeline (desktop)

Sostituisce `timeline-slot.tsx` nella riga 72px sotto la mappa.

- **Binning semantico** per finestra: 24h → 15 min (96 bin) · 7g → 2h (84) · 30g → 8h (90) · 90g → 1g (90). Bin calcolati dagli eventi **non filtrati** (tutta la finestra sempre visibile); allineati a confini naturali (ora/giorno, Europe/Rome per il giorno).
- **Resa SVG**: un rect per bin; altezza ∝ conteggio con **scala sqrt** (i bin da 1 evento restano leggibili accanto ai picchi di sciame); min-height 2px per bin non vuoto; colore = classe max del bin da `MAGNITUDE_COLORS[themeName]`. Oltre il cursore: opacity ridotta (~0.25), stile "spento" della reference.
- **Cursore**: linea rossa `--primary` (uso sanzionato dell'accento, spec v1) + readout data/ora `font-mono` `data-numeric`; in live il cursore sta sul bordo destro e il readout dice `LIVE`.
- **Bottone `● LIVE`** a destra della riga: in live è lo stato (dot rosso); in storica è l'azione "torna al presente" (azzera `t`).
- **Tooltip per bin** (hover/focus): intervallo temporale, N eventi, classe max con etichetta testuale — identità mai affidata al solo colore. Il colore di classe è già spiegato dalla legenda mappa (stessa scala).
- **A11y**: cursore `role="slider"` con `aria-valuemin/max/now` e `aria-valuetext` (data leggibile); frecce = ±1 bin, PgUp/PgDn = ±10, Home = inizio finestra, End = LIVE; la tastiera committa subito (niente doppio livello).
- **Interazione**: click sulla striscia = jump (commit immediato); drag con pointer capture = livello imperativo (§3) + readout, commit al rilascio.
- **Motion**: anime.js v4 — snap-back del cursore verso LIVE, transizione altezze bin al cambio finestra; disattivato con `prefers-reduced-motion` (pattern quake-map).
- Prima della scrittura del grafico: ripasso check dataviz (form, marks/spacer, hover layer); palette già validata a monte.

## 5 · Timeline mobile

- Striscia compatta (~40px) nel **blocco overlay in alto** (`home-client`, sotto Header + chip Summary), full-width, `pointer-events-auto`.
- Stesso componente ricomposto (prop `compact`): niente readout permanente (visibile solo in storica/drag), `● LIVE` ridotto (dot + testo), tooltip disattivato (tap = jump, drag = scrub).
- Visibile a ogni snap dello sheet (il blocco header resta scoperto anche a FULL). Pill legenda invariata.

## 6 · Stati

- Loading: skeleton sulla riga timeline (pattern page.tsx).
- Errore fetch / finestra vuota: dot-grid con label muted (pattern lista), niente istogramma.
- Copy sempre strumentale (mai allerta/allarme/pericolo).

## 7 · Struttura file e TDD

```
apps/web/lib/timeline.ts            — binEvents(events, window, nowMs) puro; clamp/shouldDeselect  [TDD, fixture reali]
apps/web/lib/url-state.ts           — param t: parse/serialize/clamp                                 [TDD]
apps/web/components/timeline.tsx    — componente (desktop + compact)
apps/web/components/quake-map.tsx   — timeMs nelle properties, setTimeFilter, prop timeFilterMs
apps/web/app/home-client.tsx        — visibleEvents, deselezione, wiring striscia mobile
```

- TDD RED-first su tutta la logica pura (binning, clamp, deselezione, url-state). Componente senza test RTL (gap noto e ledgerato); verifica visiva browser desktop+mobile, entrambi i temi.
- Vincoli invariati: colori solo da tokens; un solo elemento loud (il cursore/LIVE è l'uso sanzionato del rosso); attribuzione INGV visibile; numeri in mono `data-numeric`.

## Fuori scope (piani successivi)

Mini-chart giornaliero in sidebar (stesso binning), aggregazione server-side dei bin (solo se i volumi crescono), range temporale libero oltre i preset, zoom della timeline (reference NASA) — YAGNI finché lo scrub semplice non mostra limiti.
