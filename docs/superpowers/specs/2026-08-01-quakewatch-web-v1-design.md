# QuakeWatch IT — Design v1 web

Data: 2026-08-01 · Stato: approvato a sezioni in brainstorming, in revisione finale utente

Webapp di monitoraggio sismico per il cittadino, basata sui Web Services FDSN INGV. Vista principale: mappa dell'Italia con gli epicentri; sidebar informativa; timeline storica con scrubber; modalità esperto opzionale. Fonte unica: API INGV via proxy con cache condivisa (vedi `docs/api-web-services.md`).

## Decisioni chiave

| Ambito | Decisione |
| :-- | :-- |
| Mappa | MapLibre GL via **react-map-gl** (visgl), tile gratuiti OpenFreeMap/Protomaps, stile custom monocromo generato dai token (dark + light) |
| Componenti UI | **shadcn/ui** per tutta l'interfaccia; **Tweakpane** solo per il pannello expert, ri-temato via CSS vars `--tp-*` sugli stessi token |
| Estetica | Design system ispirato a **Nothing** (monocromo, dot-matrix, accento rosso singolo) fuso con il carattere "instrument panel" di Tweakpane |
| Temi | **Dark + light dalla v1**, dark default (identità Nothing). Classi `.theme-dark`/`.theme-light` + `@custom-variant dark`, init da `prefers-color-scheme`, toggle manuale |
| Animazioni | **GSAP** (skill nel repo: `gsap-core`, `gsap-react`, …), **non** framer-motion. Componenti React di terze parti che animano il DOM con framer-motion vanno migrati a GSAP o scartati in selezione |
| Token | SoT platform-neutral in **`packages/tokens`** (TS/JSON) → generatori per CSS vars web, stile MapLibre, costanti RN (Fase 2). Tailwind v4 è solo un consumatore |
| Deploy | **Vercel inizialmente** (revisione della scelta Cloudflare in AGENTS.md, su richiesta esplicita). Proxy con semantica HTTP standard → portabile a Cloudflare |
| Dati | Approccio "un dataset per finestra": query grandi solo dal proxy (cache CDN condivisa), interazioni (scrub/filtri) client-side sul dataset caricato |
| Target | Cittadino in area sismica; informazione quasi-real-time, **mai** allerta/early warning |

## 1. Architettura e data flow

```
INGV FDSN Event API
      │  (1 req/min per finestra, condivisa tra tutti gli utenti)
      ▼
Next.js Route Handler  /api/events?window=24h|7d|30d|90d
  - fetch INGV format=text, parsing → JSON tipizzato (Earthquake[]) via packages/core
  - query canonicalizzate (timestamp quantizzati al minuto) → alta hit rate su cache CDN
  - Cache-Control: public, s-maxage=60, stale-while-revalidate=300
      │
      ▼
apps/web (client)
  - TanStack Query: una query per finestra attiva
  - live (finestra 24h): refetchInterval 60s + dedup per eventid
  - scrubbing timeline = filter expression MapLibre (time ≤ cursore), zero rete
  - filtri expert = selettori memoizzati sul dataset in cache
```

- **Finestre**: 24h e 7g con tutte le magnitudo; 30g e 90g con `minmagnitude=2` applicato dal proxy per contenere i payload (~1–2 MB max in formato text a monte).
- **Monorepo**: `apps/web` (Next.js App Router) + `packages/core` (TS puro: client FDSN, parser text/QuakeML, dedup `eventid`, logica revisioni, tipi, hook TanStack Query) + `packages/tokens` (SoT design token). `packages/core` è usato sia dal Route Handler sia dal client, e in Fase 2 dall'app Expo.
- **Portabilità**: nessuna API proprietaria Vercel nel proxy; solo header HTTP standard. Migrazione futura a Cloudflare Workers = spostare il route handler.

## 2. Layout e componenti

### Desktop

```
┌───────────┬──────────────────────────────────┐
│  SIDEBAR  │   MAPPA                 ┌──────┐ │
│           │                         │Expert│ │
│ Riepilogo │      (epicentri)        │panel │ │
│ Preset    │                         └──────┘ │
│ Lista ↕   │                                  │
│ (Dettaglio│                                  │
│  overlay) │──────────────────────────────────│
│ Attrib.   │   TIMELINE (istogramma+scrubber) │
└───────────┴──────────────────────────────────┘
```

- **Sidebar** (~360px) come **stack di panes** arrotondati (riferimenti: `docs/inspiration/sidebar/`):
  - *Riepilogo*: numeri grandi in display seven-segment (eventi 24h, magnitudo max, area più attiva)
  - *Aree preset*: controllo segmentato (Tutta Italia / Campi Flegrei / Etna / …; lista definita come costante configurabile in `packages/core`) che filtra mappa e lista su bounding box
  - *Lista eventi*: voci piatte, dati (M, profondità, tempo relativo) in mono, evento selezionato in rosso accento, badge `PRELIMINARE`/`RIVISTO`
  - *Dettaglio evento* (scorre sopra la lista, con back): magnitudo e tipo, profondità, coordinate, tempo (locale + UTC), storico revisioni con valori precedenti barrati, link a scheda INGV
  - Footer: attribuzione **INGV — Osservatorio Nazionale Terremoti** sempre visibile
- **Mappa**: epicentri come cerchi — raggio ∝ magnitudo, recenza in accento rosso che sfuma verso il grigio con l'età; pulse sull'ultimo evento in live; selezione sincronizzata lista↔mappa. Niente cluster in v1.
- **Timeline** (docked sotto la mappa; riferimenti: `docs/inspiration/timeline/`): istogramma a tick verticali di densità eventi + cursore a linea rossa con readout data in mono; tooltip per evento su hover; tab preset 24h/7g/30g/90g. Default: cursore su "adesso" = **modalità live** (polling attivo). Lo scrub entra in modalità storica; bottone `● LIVE` per tornare al presente.
- **Expert panel**: Tweakpane flottante in alto a destra, collassabile, con folder:
  - *Filtri*: magnitudo min/max, profondità min/max, tipo magnitudo (ML/Mw/Md)
  - *Mappa*: scala cerchi, opacità, heatmap on/off, etichette
  - Niente monitor tecnici né dati revisioni nel panel (le revisioni stanno nel dettaglio evento)

### Mobile (mobile-first)

Mappa a tutto schermo; chip di riepilogo in alto; sidebar come **bottom sheet** (shadcn Drawer/vaul) con tre snap point: peek (riepilogo + ultimo evento), metà (lista), full (dettaglio). Timeline compatta sopra il sheet. Expert panel da icona, come sheet a tutta larghezza.

### Routing e stato URL

- `/`: app principale. Stato UI in query params (`?window=`, `?area=`, `?event=`) → ogni vista è linkabile
- `/evento/[eventId]`: pagina server-rendered per SEO/condivisione (motivazione principale di Next.js); apre l'app con evento selezionato e mappa centrata
- `/info`: disclaimer completo, licenza dati, link INGV

### Componenti shadcn

Drawer/Sheet, Tabs (finestre), ScrollArea (lista), Badge, Tooltip, Sonner (toast), Skeleton (loading).

## 3. Design system e token

### SoT cross-platform

`packages/tokens` (TS/JSON, struttura W3C DTCG-compatibile) è l'unica fonte. Generatori producono:

1. `theme.css` per il web (CSS vars) — Tailwind v4 `@theme inline` fa solo mapping, mai definizione di valori
2. Stile MapLibre JSON (dark + light) dagli stessi valori
3. (Fase 2) costanti TS per React Native — indipendente dal supporto NativeWind/Tailwind v4

### Struttura token (modello: luigipdt.dev `theme.css`/`tailwind.css`, senza verde)

- **Scale neutre numerate** `--dark-900…500` / `--light-900…500`, speculari tra i temi
- **Layer semantico shadcn-compatibile**: `background/foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `border/input/outline`, più le vars `--sidebar-*`
- **`--primary` = scala rossa 50–950** (rosso Nothing ~`hsl(355 100% 50%)`), identica in dark e light
- **Status colors** mantenuti (`error/warning/success/info`) con vincolo: `--error` su rosso smorzato e distinto dal primary — il rosso brillante è identità/recenza, non deve leggersi come "pericolo"
- **Spacing fluido, radius, durate/easing** con impianto identico al riferimento (`postcss-utopia`)
- **Tipografia**: requisiti fissati — grotesk per UI/titoli, mono con `tnum` + `zero` (numeri tabulari, zero barrato) per tutti i dati numerici. **Scelta font e token tipografici: decisione aperta, da chiudere in implementazione**

### Linguaggio visivo

- Panes arrotondati su fondo scuro/chiaro, bordi a bassissimo contrasto, texture **dot-grid** (firma Nothing) nelle aree vuote e sulla timeline
- Display **seven-segment** per i numeri del riepilogo
- Un solo accento (rosso) usato con disciplina: voce attiva, cursore timeline, eventi recenti/selezionati, LIVE
- Mappa monocroma custom: terra quasi-nera (dark) / carta chiara (light), confini e label sommessi, zero POI
- Tweakpane rimappato sui token via `--tp-*` in entrambi i temi
- Motion sobrio e strumentale, implementato con **GSAP** (`gsap.matchMedia()` per `prefers-reduced-motion` e breakpoint); nessun effetto drammatizzante. Framer-motion escluso: eventuali componenti terzi che lo usano vanno migrati a GSAP

## 4. Stati, errori e trasparenza dati

- **Loading**: mappa monta subito lo stile base; skeleton su panes e timeline
- **Vuoto**: pane dot-grid con messaggio neutro ("Nessun evento M≥2 nelle ultime 24h")
- **Resilienza**: il client conserva sempre l'ultima risposta buona (TanStack Query); il proxy serve stale se INGV è giù; retry con backoff; offline detection con banner
- **Indicatore freschezza**: "agg. HH:MM:SS" accanto al toggle LIVE; su fallimenti ripetuti ingiallisce + banner "Dati non aggiornati da X min" (warning, non error); toast solo alla prima occorrenza
- **Trasparenza (vincoli non negoziabili → UI)**:
  - Attribuzione INGV: attribution control della mappa (sempre visibile anche mobile) + footer sidebar
  - Badge `PRELIMINARE`/`RIVISTO` su ogni evento; storico revisioni nel dettaglio
  - Riga fissa: *"Dati preliminari soggetti a revisione. Questa app non è un sistema di allerta."* + pagina `/info`
  - Orari UTC dall'API → mostrati in ora locale italiana, UTC esplicito nel dettaglio
  - Copy strumentale e neutro; mai "allerta", "allarme", "pericolo"
- **Licenza dati INGV**: da verificare prima della pubblicazione (blocker di release, non di sviluppo)

## 5. Testing

- **`packages/core` in TDD** (Vitest): parser text/QuakeML con fixture da risposte reali, dedup, logica revisioni, canonicalizzazione finestre. Qui vive quasi tutta la logica → qui il grosso dei test
- **`packages/tokens`**: test di build dei generatori (CSS/style JSON validi, nessun token orfano tra dark e light)
- **Route handler**: integrazione con INGV mockata (MSW) — header cache, canonicalizzazione, `minmagnitude` finestre lunghe, comportamento su 5xx
- **UI**: test mirati (Testing Library) su sync lista↔mappa e transizione live↔storico; un e2e Playwright sullo happy path (load → seleziona → scrub → cambio tema)
- **Verifica visiva/a11y**: browser MCP a ogni iterazione; audit axe + `web-architect:audit-ux` pre-pubblicazione (da `.claude/rules/iter-sviluppo.md`)

## Decisioni aperte

1. **Font e token tipografici** — in implementazione (requisiti già fissati: grotesk UI, mono `tnum`/`zero` per i dati)
2. **Tooling monorepo** (pnpm workspaces, eventuale turborepo) — nel piano di implementazione
3. **Licenza/condizioni ridistribuzione dati INGV** — verifica obbligatoria pre-release

## Fuori scope v1

Notifiche push e app Expo (Fase 2), cluster mappa, aggregazione server-side dei bin timeline (evoluzione se i volumi crescono), forme d'onda e stazioni (`fdsnws/dataselect`/`station`), dati di scuotimento (`ingvws/shakedata`), range temporale libero oltre i preset.

## Riferimenti

- API e polling: `docs/api-web-services.md` · Risorse INGV/MCP: `docs/risorse-esterne.md`
- Ispirazione timeline: `docs/inspiration/timeline/` · sidebar: `docs/inspiration/sidebar/`
- Wireframe iniziale: brief utente 2026-08-01 (sidebar sx, mappa centrale, timeline bottom, expert panel flottante dx)
- Modello token: `Z:\REPOS\luigipdt.dev\src\styles\{theme,tailwind}.css`
