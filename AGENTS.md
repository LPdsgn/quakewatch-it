# AGENTS.md

Guida per i coding agent che operano in questo repository.

## Progetto

Webapp informativa di monitoraggio sismico (Italia, focus possibile su aree come i Campi Flegrei) basata sui Web Services FDSN pubblici dell'INGV. **Progetto personale senza scopo di lucro.** Greenfield: non c'è ancora codice.

## Fonte dati

Tutto il necessario sull'API INGV è in `docs/api-web-services.md` (endpoint, parametri, formati, strategia di polling). Risorse INGV su GitHub e valutazione dei cataloghi PA in `docs/risorse-esterne.md` — in particolare: esiste l'**MCP server ufficiale INGV** (`docker run -i --rm ingv/mcp-fdsnws-event`) per interrogare il catalogo eventi durante lo sviluppo, e il servizio extra `ingvws/shakedata` per i dati di scuotimento. Non duplicare qui quei contenuti. Fatti verificati empiricamente (2026-08) oltre la doc:

- CORS aperto (`Access-Control-Allow-Origin: *`) sull'endpoint Event
- INGV cache-a le risposte con `max-age=60` → polling a 60s si allinea alla loro cache
- Lo storico revisioni magnitudo/localizzazione è già nell'API (`includeallorigins=true&includeallmagnitudes=true`) → **nessun database proprio necessario**

## Architettura decisa (valutazione fattibilità 2026-08)

Monorepo React a fasi:

- **Fase 1 (attuale)**: web con **Next.js**, deploy iniziale su **Vercel** (revisione 2026-08 della scelta Cloudflare, su richiesta esplicita); proxy = Route Handler Next.js con cache CDN condivisa e semantica HTTP standard, portabile a Cloudflare Workers in futuro (N utenti = 1 req/min verso INGV). Strutturare da subito come monorepo con `packages/core` (TS puro: client FDSN, parsing text/QuakeML, dedup per `eventid`, logica revisioni, tipi, hook TanStack Query).
- **Fase 2 (dopo validazione del web)**: app mobile **Expo** che riusa `packages/core`; notifiche push via Cron Trigger sul Worker + Expo Push API. Non anticipare lavoro di Fase 2.

Scelte chiuse — non rimetterle in discussione senza richiesta esplicita:

- Next.js e non SvelteKit (condivisione codice con React Native in Fase 2)
- Monorepo Next.js + Expo, **non** universal app con react-native-web (SEO pagine evento)
- Mappe: **MapLibre GL** via **react-map-gl** (visgl) + tile gratuiti (OpenFreeMap/Protomaps), zero costi licenza — confermata 2026-08 dopo valutazione Mapbox
- Niente backend/DB proprio, niente CMS/WordPress: l'API INGV è la sola fonte
- Polling HTTP, non WebSocket (l'API è query-only); finestra sovrapposta 5–15 min
- Per i repo INGV: MCP server via Docker/`.mcp.json`, spec OpenAPI via raw URL pinnata a SHA (dettagli in `docs/risorse-esterne.md`)
- Niente template/starter per `apps/web` (valutati e scartati satus e basement next-typescript): `create-next-app` liscio + solo il necessario (TanStack Query, MapLibre GL, Zod). Da satus si copiano idee, non il repo: TS strict, oxlint/oxfmt, validazione env con Zod

Il design v1 del web (UI, token, data flow, stati) è specificato in `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md`.

## Vincoli non negoziabili

- Attribuzione **"INGV — Osservatorio Nazionale Terremoti"** sempre visibile
- I parametri (magnitudo, localizzazione) sono preliminari e soggetti a revisione: la UI deve dichiararlo esplicitamente
- **Mai** presentare l'app come sistema di allerta/early warning
- Verificare licenza/condizioni di ridistribuzione dati INGV prima di pubblicare

## Regole

Regole aggiuntive in `.agents/rules/` (symlinkate in `.claude/rules/` per Claude Code) — in particolare l'**iter di design e sviluppo** in `.agents/rules/iter-sviluppo.md` (fasi, skill da usare, review obbligatorie). Gli agent diversi da Claude Code devono leggerle comunque: valgono per tutti.
