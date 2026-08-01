# AGENTS.md

Guida per i coding agent che operano in questo repository.

## Progetto

Webapp informativa di monitoraggio sismico (Italia, focus possibile su aree come i Campi Flegrei) basata sui Web Services FDSN pubblici dell'INGV. **Progetto personale senza scopo di lucro.** Greenfield: non c'è ancora codice.

## Fonte dati

Tutto il necessario sull'API INGV è in `docs/api-web-services.md` (endpoint, parametri, formati, strategia di polling). Non duplicare qui quel contenuto. Fatti verificati empiricamente (2026-08) oltre la doc:

- CORS aperto (`Access-Control-Allow-Origin: *`) sull'endpoint Event
- INGV cache-a le risposte con `max-age=60` → polling a 60s si allinea alla loro cache
- Lo storico revisioni magnitudo/localizzazione è già nell'API (`includeallorigins=true&includeallmagnitudes=true`) → **nessun database proprio necessario**

## Architettura decisa (valutazione fattibilità 2026-08)

Monorepo React a fasi:

- **Fase 1 (attuale)**: web con **Next.js** + proxy edge **Cloudflare Pages/Workers** con cache condivisa (N utenti = 1 req/min verso INGV). Strutturare da subito come monorepo con `packages/core` (TS puro: client FDSN, parsing text/QuakeML, dedup per `eventid`, logica revisioni, tipi, hook TanStack Query).
- **Fase 2 (dopo validazione del web)**: app mobile **Expo** che riusa `packages/core`; notifiche push via Cron Trigger sul Worker + Expo Push API. Non anticipare lavoro di Fase 2.

Scelte chiuse — non rimetterle in discussione senza richiesta esplicita:

- Next.js e non SvelteKit (condivisione codice con React Native in Fase 2)
- Monorepo Next.js + Expo, **non** universal app con react-native-web (SEO pagine evento)
- Mappe: **MapLibre GL** + tile gratuiti (OpenFreeMap/Protomaps), zero costi licenza
- Niente backend/DB proprio, niente CMS/WordPress: l'API INGV è la sola fonte
- Polling HTTP, non WebSocket (l'API è query-only); finestra sovrapposta 5–15 min

## Vincoli non negoziabili

- Attribuzione **"INGV — Osservatorio Nazionale Terremoti"** sempre visibile
- I parametri (magnitudo, localizzazione) sono preliminari e soggetti a revisione: la UI deve dichiararlo esplicitamente
- **Mai** presentare l'app come sistema di allerta/early warning
- Verificare licenza/condizioni di ridistribuzione dati INGV prima di pubblicare

## Regole

Regole aggiuntive in `.claude/rules/` (verranno popolate durante lo sviluppo). Gli agent diversi da Claude Code devono leggerle comunque: valgono per tutti.
