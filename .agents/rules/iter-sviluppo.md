# Iter di design e sviluppo

Processo di riferimento per portare avanti il progetto. I nomi tra backtick (`namespace:nome`) sono skill installate in Claude Code: gli altri agent seguono comunque le fasi e i criteri, anche senza le skill corrispondenti.

## Sequenza

Brainstorming requisiti → esplorazione design → piano scritto → TDD su `packages/core` → esecuzione su `apps/web`. Verifica e review a fine di ogni blocco di lavoro.

## Fase 0 — Design (prima del codice)

1. **Requisiti di prodotto** con `superpowers:brainstorming`: viste necessarie (lista eventi, mappa, pagina evento, storico revisioni), come comunicare i dati preliminari, ambito della v1.
2. **Esplorazione UI** con `design-lab` (5 varianti a confronto + piano di implementazione) oppure `cortex:prototype` per prototipi usa-e-getta. Wireframe rapidi: `cortex:wiretext`.
3. **Fondamenta visive** (plugin cortex):
   - `cortex:studio` va caricata **prima di qualunque lavoro di design** (è il front door della design practice cortex: regole, playbook, inventario tool);
   - `cortex:ui-principles` per spacing, tipografia, layout;
   - `cortex:oklch-skill` per palette e contrasto (rilevante per la scala colore delle magnitudo);
   - `dataviz` obbligatoria prima di scrivere qualunque grafico (timeline magnitudo, profondità, sciami).
4. I sistemi stilistici cortex (`swiss-design`, `nothing-design`, `muller-brockmann-grid-systems`) sono **opt-in**: solo su richiesta esplicita dell'utente, mai auto-applicati.

## Fase 1 — packages/core

- Piano con `superpowers:writing-plans`.
- Sviluppo in **TDD** (`superpowers:test-driven-development`): client FDSN, parsing text/QuakeML, dedup per `eventid`, logica revisioni. Fixture prese da risposte reali dell'API; catalogo interrogabile in sviluppo via MCP server INGV (vedi `docs/risorse-esterne.md`).

## Fase 2 — apps/web

- Esecuzione del piano con `superpowers:executing-plans`, oppure `superpowers:subagent-driven-development` per task paralleli indipendenti.
- Knowledge skill mentre si scrive codice Next.js: `vercel:nextjs`, `vercel:react-best-practices`, `coding-rules:nextjs-tailwind`.
  - Deploy iniziale su **Vercel** (revisione 2026-08 in AGENTS.md): le skill di deploy del plugin vercel sono utilizzabili. Mantenere il proxy su semantica HTTP standard: la portabilità futura a Cloudflare Workers resta un requisito.
- Verifica visiva iterativa nel browser (MCP chrome-devtools/playwright, `web-architect:web-screenshots`).
- Polish quando serve: `cortex:loading-states` (stati di polling/attesa), `cortex:responsive-craft` (mappa + tabelle dati), `cortex:css-interaction-tips` per micro-interazioni.
- Motion: **anime.js v4** con la skill `animejs` del repo (`.agents/skills/animejs`, symlinkata per Claude Code). **Non** usare `cortex:framer-motion` né skill/pattern GSAP: scelta chiusa in AGENTS.md.

## Trasversali (sempre validi)

- Bug o comportamento inatteso: `superpowers:systematic-debugging` prima di proporre qualunque fix.
- Fine di ogni blocco di lavoro: `superpowers:requesting-code-review` + `superpowers:verification-before-completion`.
- Review di design: `cortex:preflight` (check statico pre-ship, a11y, anti AI-slop); `cortex:studio-audit` o `cortex:wip-senior-audit` per audit del prodotto live; `web-architect:audit-ux` / `audit-full` prima della pubblicazione.
- I vincoli non negoziabili di AGENTS.md (attribuzione INGV, dati preliminari dichiarati, mai presentarsi come early warning) valgono anche come criteri di review del design, non solo del codice.
