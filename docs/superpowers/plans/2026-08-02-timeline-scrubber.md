# Timeline + Scrubber (Piano 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Timeline istogramma + scrubber sotto la mappa (desktop) e sotto l'header (mobile): scrub = snapshot di tutta la UI al tempo T, persistito in `?t`.

**Architecture:** Stato `t` (epoch s) nell'URL come gli altri param; home-client deriva `visibleEvents` (lista/riepilogo/più-forti) mentre la mappa filtra via filter expression MapLibre (geojson sempre completo). Drag a due livelli: durante il gesto solo mappa (handle imperativo) + readout, commit di `?t` al rilascio. Binning semantico per finestra, altezza=conteggio (scala sqrt), colore=classe max del bin.

**Tech Stack:** Next.js 16 App Router, react-map-gl/maplibre (pinned ^5), TanStack Query, anime.js v4 (skill vendorizzata `.agents/skills/animejs`), vitest. Spec: `docs/superpowers/specs/2026-08-02-timeline-scrubber-design.md`.

## Global Constraints

- **Colori SOLO da `@quakewatch/tokens`** (`MAGNITUDE_COLORS[themeName]`, `magnitudeClassOf`); mai hex nei componenti. Il cursore/LIVE usa `--primary` (rosso): è l'uso sanzionato dell'accento — un solo elemento loud per schermo.
- Numeri e date in `font-mono` con attributo `data-numeric`.
- Copy strumentale: mai allerta/allarme/pericolo. Timezone locale Europe/Rome.
- TDD RED-first su tutta la logica pura; l'output RED va catturato PRIMA dell'implementazione e incluso nel report; mai dichiarare un rosso "pre-esistente" senza check sul parent commit.
- `EventDetail`/nodi doppi: tutto ciò che monta due volte deve essere instance-safe (niente id statici — `useId`; niente focus incondizionato). La Timeline monta in 2 istanze (desktop + mobile compact).
- Il polling non si tocca (già solo su 24h); lo scrub non aggiunge chiamate di rete.
- `prefers-reduced-motion` disattiva le animazioni (pattern quake-map.tsx:60-66); motion con anime.js v4 (MAI framer-motion/GSAP) — leggere la skill del repo `.agents/skills/animejs` prima di scrivere motion.
- Prima di scrivere il componente grafico (T4): ripassare i check della skill dataviz (form, marks/spacer ≥2px, hover layer obbligatorio); la palette è già validata (Piano 3 T1).
- Commit in italiano, messaggi esatti dei task; MAI trailer `Co-Authored-By`; MAI `--no-verify` (lefthook: oxlint+oxfmt sugli staged).
- Gate per task: `pnpm typecheck && pnpm test && pnpm lint && pnpm --filter web build`. Gate di fine piano: aggiungere `pnpm lint:types && pnpm format:check`.
- Lavoro su main (consenso utente esplicito). Working dir: repo root.

## Struttura file

```
apps/web/lib/url-state.ts               — param t (parse/serialize)                    [T1]
apps/web/test/url-state.test.ts         — test t                                       [T1]
apps/web/lib/timeline.ts                — binEvents, clampT, shouldDeselect,
                                          timeFilterExpression, romeDayStartMs         [T2]
apps/web/test/timeline.test.ts          — test logica pura                             [T2]
apps/web/components/quake-map.tsx       — timeMs nelle properties, filtri da prop,
                                          handle imperativo setTimeFilter              [T3]
apps/web/components/timeline.tsx        — componente (desktop + compact)               [T4, T6]
apps/web/app/home-client.tsx            — visibleEvents, clamp, deselezione, wiring    [T5, T6]
apps/web/components/shell/timeline-slot.tsx — ELIMINATO                                [T5]
```

---

### Task 1: Param `t` in url-state

**Files:**
- Modify: `apps/web/lib/url-state.ts`
- Test: `apps/web/test/url-state.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `AppState.t: number | null` (epoch **secondi**, null = live). `parseAppState` valida `^\d+$` (nessun clamp: parse pura, niente Date.now — lezione hydration); `serializeAppState` appende `t` per ultimo, omesso se null.

- [ ] **Step 1: Test RED**

Aggiungere a `apps/web/test/url-state.test.ts`:

```ts
it('t numerico → epoch secondi', () => {
	expect(parseAppState(new URLSearchParams('t=1754130000')).t).toBe(1754130000)
})

it('t non numerico o assente → null', () => {
	expect(parseAppState(new URLSearchParams('t=abc')).t).toBeNull()
	expect(parseAppState(new URLSearchParams('t=-5')).t).toBeNull()
	expect(parseAppState(new URLSearchParams('')).t).toBeNull()
})

it('serializza t in coda, omesso se null', () => {
	const base = { window: '24h', area: 'italia', event: null, variant: 'default' } as const
	expect(serializeAppState({ ...base, t: 1754130000 })).toBe('t=1754130000')
	expect(serializeAppState({ ...base, t: null })).toBe('')
	expect(serializeAppState({ ...base, window: '7d', t: 1754130000 })).toBe('window=7d&t=1754130000')
})
```

I letterali `AppState` esistenti nel file di test vanno aggiornati con `t: null` (il campo è required): fa parte del RED (typecheck fallisce prima, test dopo).

- [ ] **Step 2: Verifica RED** — `pnpm --filter web test -- url-state` → FAIL (property `t` inesistente / typecheck). Cattura l'output.

- [ ] **Step 3: Implementazione**

In `url-state.ts`: aggiungere a `AppState` il campo `/** Cursore timeline, epoch secondi; null = live (Piano 4). */ t: number | null`. In `parseAppState`:

```ts
// t: epoch secondi, solo formato — il clamp su finestra/adesso vive in clampT (lib/timeline.ts),
// perché qui non c'è (e non deve esserci) Date.now: parse pura, stessa su server e client.
const tParam = params.get('t')
const t = tParam && /^\d+$/.test(tParam) ? Number(tParam) : null
```

In `serializeAppState`, dopo `variant`:

```ts
if (state.t !== null) {
	params.append('t', String(state.t))
}
```

- [ ] **Step 4: Verifica GREEN** — `pnpm --filter web test -- url-state` → PASS; poi gate task.
- [ ] **Step 5: Commit** — `web: param ?t (cursore timeline) nello stato URL`

---

### Task 2: Logica pura timeline (binning, clamp, deselezione, filtro)

**Files:**
- Create: `apps/web/lib/timeline.ts`
- Test: `apps/web/test/timeline.test.ts`

**Interfaces:**
- Consumes: `WINDOW_CONFIG` (`@quakewatch/core`, `{ durationMs }`), `magnitudeClassOf` (`@quakewatch/tokens`), tipo `Earthquake` (`@quakewatch/core`).
- Produces (usati da T3/T4/T5):

```ts
export interface TimelineBin {
	startMs: number
	endMs: number
	count: number
	/** id classe dell'evento più forte nel bin ('m0'|'m2'|'m3'|'m4'), null se vuoto */
	maxClassId: string | null
}
export const BIN_SIZE_MS: Record<TimeWindow, number>
export function romeDayStartMs(ms: number): number
export function binEvents(events: Earthquake[], window: TimeWindow, nowMs: number): TimelineBin[]
/** null = live; tSec fuori finestra → clamp; tSec entro 60s da nowMs → null (torna live) */
export function clampT(tSec: number | null, nowMs: number, window: TimeWindow): number | null
export function shouldDeselect(eventTimeMs: number, tMs: number | null): boolean
/** Expression MapLibre ['<=',['get','timeMs'],tMs] o null se live */
export function timeFilterExpression(tMs: number | null): unknown[] | null
```

- [ ] **Step 1: Test RED**

`apps/web/test/timeline.test.ts` (fixture: eventi reali abbreviati dalla risposta INGV — copiare 3-4 oggetti da `packages/core/test/fixtures/` adattati al tipo `Earthquake`):

```ts
import type { Earthquake } from '@quakewatch/core'
import { describe, expect, it } from 'vitest'

import {
	BIN_SIZE_MS,
	binEvents,
	clampT,
	romeDayStartMs,
	shouldDeselect,
	timeFilterExpression,
} from '../lib/timeline'

const ev = (time: string, magnitude: number): Earthquake =>
	({ eventId: String(Math.abs(magnitude * 1000)), time, magnitude, latitude: 40.8, longitude: 14.1, depthKm: 2.5, locationName: 'Campi Flegrei' }) as Earthquake

const NOW = Date.parse('2026-08-02T12:00:00Z')

describe('BIN_SIZE_MS', () => {
	it('taglie semantiche per finestra', () => {
		expect(BIN_SIZE_MS['24h']).toBe(15 * 60_000)
		expect(BIN_SIZE_MS['7d']).toBe(2 * 3_600_000)
		expect(BIN_SIZE_MS['30d']).toBe(8 * 3_600_000)
		expect(BIN_SIZE_MS['90d']).toBe(24 * 3_600_000)
	})
})

describe('romeDayStartMs', () => {
	it('mezzanotte Europe/Rome in estate (CEST, UTC+2)', () => {
		// 2026-08-02 12:00 UTC → mezzanotte Roma = 2026-08-01T22:00:00Z
		expect(romeDayStartMs(NOW)).toBe(Date.parse('2026-08-01T22:00:00Z'))
	})
	it('mezzanotte Europe/Rome in inverno (CET, UTC+1)', () => {
		const jan = Date.parse('2026-01-15T12:00:00Z')
		expect(romeDayStartMs(jan)).toBe(Date.parse('2026-01-14T23:00:00Z'))
	})
})

describe('binEvents', () => {
	it('conta gli eventi nel bin giusto e prende la classe max', () => {
		const events = [
			ev('2026-08-02T11:05:00Z', 1.2), // stesso bin 15min di 11:10
			ev('2026-08-02T11:10:00Z', 3.4),
			ev('2026-08-02T10:00:00Z', 0.8),
		]
		const bins = binEvents(events, '24h', NOW)
		const hit = bins.find((b) => b.startMs <= Date.parse('2026-08-02T11:05:00Z') && Date.parse('2026-08-02T11:05:00Z') < b.endMs)!
		expect(hit.count).toBe(2)
		expect(hit.maxClassId).toBe('m3')
	})
	it('bins coprono la finestra, ancorati a confini naturali, ultimo bin include nowMs', () => {
		const bins = binEvents([], '24h', NOW)
		expect(bins[0]!.startMs % BIN_SIZE_MS['24h']).toBe(0) // 15min: confini allineati all'ora UTC (=Roma, offset intero)
		expect(bins.at(-1)!.endMs).toBeGreaterThanOrEqual(NOW)
		expect(bins.at(-1)!.startMs).toBeLessThanOrEqual(NOW)
		expect(bins[0]!.endMs).toBeGreaterThan(NOW - 24 * 3_600_000) // il primo bin tocca la finestra
	})
	it('90d: bin giornalieri ancorati alla mezzanotte di Roma', () => {
		const bins = binEvents([], '90d', NOW)
		expect(bins.at(-1)!.startMs).toBe(romeDayStartMs(NOW))
	})
	it('evento fuori finestra ignorato, bin vuoto ha maxClassId null', () => {
		const bins = binEvents([ev('2026-07-01T00:00:00Z', 5)], '24h', NOW)
		expect(bins.every((b) => b.count === 0 && b.maxClassId === null)).toBe(true)
	})
})

describe('clampT', () => {
	const nowSec = Math.floor(NOW / 1000)
	it('null resta live', () => expect(clampT(null, NOW, '24h')).toBeNull())
	it('t entro 60s da adesso → live (null)', () => {
		expect(clampT(nowSec - 30, NOW, '24h')).toBeNull()
		expect(clampT(nowSec + 999, NOW, '24h')).toBeNull()
	})
	it('t prima della finestra → clamp all_inizio', () => {
		expect(clampT(nowSec - 2 * 24 * 3600, NOW, '24h')).toBe(nowSec - 24 * 3600)
	})
	it('t valido passa invariato', () => {
		expect(clampT(nowSec - 3600, NOW, '24h')).toBe(nowSec - 3600)
	})
})

describe('shouldDeselect', () => {
	it('true solo se t è storico E l_evento è dopo t', () => {
		expect(shouldDeselect(NOW, NOW - 1000)).toBe(true)
		expect(shouldDeselect(NOW - 5000, NOW - 1000)).toBe(false)
		expect(shouldDeselect(NOW, null)).toBe(false)
	})
})

describe('timeFilterExpression', () => {
	it('live → null; storico → <= su timeMs', () => {
		expect(timeFilterExpression(null)).toBeNull()
		expect(timeFilterExpression(123)).toEqual(['<=', ['get', 'timeMs'], 123])
	})
})
```

- [ ] **Step 2: Verifica RED** — `pnpm --filter web test -- timeline` → FAIL "Cannot find module '../lib/timeline'". Cattura.

- [ ] **Step 3: Implementazione** — `apps/web/lib/timeline.ts`:

```ts
import { WINDOW_CONFIG, type Earthquake, type TimeWindow } from '@quakewatch/core'
import { magnitudeClassOf } from '@quakewatch/tokens'

export interface TimelineBin {
	startMs: number
	endMs: number
	count: number
	maxClassId: string | null
}

/** Taglie semantiche: ~90 bin per finestra, confini naturali (quarto d'ora/ora/giorno). */
export const BIN_SIZE_MS: Record<TimeWindow, number> = {
	'24h': 15 * 60_000,
	'7d': 2 * 3_600_000,
	'30d': 8 * 3_600_000,
	'90d': 24 * 3_600_000,
}

/** Tolleranza del confine live: entro un bucket di polling dal presente si è "adesso". */
const LIVE_EPSILON_MS = 60_000

/**
 * Mezzanotte Europe/Rome dell'istante dato, in epoch ms UTC.
 * L'offset di Roma è sempre a ore intere (CET +1 / CEST +2): lo si legge formattando
 * mezzogiorno UTC del giorno (DST-stabile) e confrontando l'ora locale con 12.
 */
export function romeDayStartMs(ms: number): number {
	const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(ms)
	const [y, mo, d] = dateStr.split('-').map(Number) as [number, number, number]
	const noonUtc = Date.UTC(y, mo - 1, d, 12)
	const romeHour = Number(
		new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(noonUtc)
	)
	return Date.UTC(y, mo - 1, d) - (romeHour - 12) * 3_600_000
}

/** Ancora della griglia bin: mezzanotte Roma per i bin giornalieri, confine multiplo della taglia altrimenti (offset Roma intero → coincide coi confini UTC). */
function binAnchor(windowStartMs: number, size: number): number {
	if (size === BIN_SIZE_MS['90d']) return romeDayStartMs(windowStartMs)
	return Math.floor(windowStartMs / size) * size
}

export function binEvents(events: Earthquake[], window: TimeWindow, nowMs: number): TimelineBin[] {
	const size = BIN_SIZE_MS[window]
	const windowStartMs = nowMs - WINDOW_CONFIG[window].durationMs
	const anchor = binAnchor(windowStartMs, size)

	const bins: TimelineBin[] = []
	for (let start = anchor; start <= nowMs; start += size) {
		bins.push({ startMs: start, endMs: start + size, count: 0, maxClassId: null })
	}

	let maxMagPerBin: (number | null)[] = bins.map(() => null)
	for (const e of events) {
		const t = Date.parse(e.time)
		if (t < windowStartMs || t > nowMs) continue
		const i = Math.floor((t - anchor) / size)
		const bin = bins[i]
		if (!bin) continue
		bin.count += 1
		if (maxMagPerBin[i] === null || e.magnitude > maxMagPerBin[i]!) maxMagPerBin[i] = e.magnitude
	}
	for (let i = 0; i < bins.length; i++) {
		const m = maxMagPerBin[i]
		if (m !== null) bins[i]!.maxClassId = magnitudeClassOf(m).id
	}
	return bins
}

export function clampT(tSec: number | null, nowMs: number, window: TimeWindow): number | null {
	if (tSec === null) return null
	const tMs = tSec * 1000
	if (tMs >= nowMs - LIVE_EPSILON_MS) return null
	const windowStartMs = nowMs - WINDOW_CONFIG[window].durationMs
	if (tMs < windowStartMs) return Math.ceil(windowStartMs / 1000)
	return tSec
}

export function shouldDeselect(eventTimeMs: number, tMs: number | null): boolean {
	return tMs !== null && eventTimeMs > tMs
}

export function timeFilterExpression(tMs: number | null): unknown[] | null {
	return tMs === null ? null : ['<=', ['get', 'timeMs'], tMs]
}
```

Nota firma: `binEvents` riceve gli eventi NON filtrati (tutta la finestra sempre visibile — spec §4).

- [ ] **Step 4: Verifica GREEN** — `pnpm --filter web test -- timeline` → PASS; gate task.
- [ ] **Step 5: Commit** — `web: logica timeline pura (binning semantico, clamp t, deselezione, filtro tempo)`

---

### Task 3: QuakeMap — timeMs, filtri temporali, handle imperativo

**Files:**
- Modify: `apps/web/components/quake-map.tsx`

**Interfaces:**
- Consumes: `timeFilterExpression(tMs)` da `@/lib/timeline` (T2).
- Produces:
  - prop `timeFilterMs?: number | null` (dichiarativa, da URL committato)
  - prop `handleRef?: Ref<QuakeMapHandle>` con `export interface QuakeMapHandle { setTimeFilter(tMs: number | null): void }` (imperativa, per il drag)
  - feature property `timeMs: number` nel geojson

Niente test unit (gap RTL noto): verifica via typecheck + browser in T5/T7. La logica dell'expression è già testata in T2.

- [ ] **Step 1: properties** — nel `useMemo` del geojson aggiungere alle properties: `timeMs: new Date(e.time).getTime()`.

- [ ] **Step 2: filtri componibili** — helper nel file (fuori dal componente):

```ts
import { timeFilterExpression } from '@/lib/timeline'

// I layer hanno già filtri propri (pulse: isPulse; ring: eventId): il filtro tempo si compone
// in AND. MapLibre accetta expression annidate in ['all', ...].
function composeFilters(base: unknown[] | null, tMs: number | null): unknown[] | undefined {
	const time = timeFilterExpression(tMs)
	if (base && time) return ['all', base, time]
	return (base ?? time) ?? undefined
}
```

Applicare ai tre layer (prop `filter` dei `<Layer>`):
- `events-circle`: `filter={composeFilters(null, timeFilterMs ?? null) as never}` — se undefined, NON passare la prop (spread condizionale `{...(f ? { filter: f as never } : {})}`)
- `events-pulse`: base `['==', ['get', 'isPulse'], true]`
- `events-selected-ring`: base `['==', ['get', 'eventId'], selectedId ?? '']`

- [ ] **Step 3: handle imperativo**

```ts
export interface QuakeMapHandle {
	/** Applica il filtro tempo direttamente sui layer (drag: zero re-render React). */
	setTimeFilter(tMs: number | null): void
}
```

Nel componente (nuove prop `timeFilterMs?: number | null`, `handleRef?: Ref<QuakeMapHandle>`):

```ts
useImperativeHandle(handleRef, () => ({
	setTimeFilter(tMs) {
		const map = mapRef.current?.getMap()
		if (!map?.getLayer('events-circle')) return
		map.setFilter('events-circle', composeFilters(null, tMs) as never)
		map.setFilter('events-pulse', composeFilters(['==', ['get', 'isPulse'], true], tMs) as never)
		map.setFilter(
			'events-selected-ring',
			composeFilters(['==', ['get', 'eventId'], selectedIdRef.current ?? ''], tMs) as never
		)
	},
}))
```

`selectedIdRef` = ref specchiato su `selectedId` (pattern `eventsRef` già nel file). Al commit il re-render riallinea i filtri dichiarativi (stesso `composeFilters` → convergenza garantita). Nessun `setData` in tutto il percorso.

- [ ] **Step 4: gate** — `pnpm typecheck && pnpm --filter web test && pnpm lint && pnpm --filter web build` verdi; dev boot 200.
- [ ] **Step 5: Commit** — `web: filtro temporale sui layer mappa (dichiarativo da ?t + handle imperativo per lo scrub)`

---

### Task 4: Componente Timeline (desktop)

**Files:**
- Create: `apps/web/components/timeline.tsx`

**Interfaces:**
- Consumes: `binEvents`, `BIN_SIZE_MS`, `clampT` (T2); `MAGNITUDE_COLORS`, `magnitudeClassOf` label (tokens); `toThemeName` (`@/lib/theme`); pattern mounted-guard SSR (map-legend.tsx:92-96); reduced-motion (quake-map.tsx:60-66); skill animejs (`.agents/skills/animejs`).
- Produces:

```ts
export interface TimelineProps {
	/** Eventi NON filtrati della finestra. */
	events: Earthquake[]
	window: TimeWindow
	/** Cursore committato (ms); null = live. */
	tMs: number | null
	/** Orologio condiviso; null finché non montato → skeleton. */
	nowMs: number | null
	isLoading: boolean
	hasError: boolean
	/** Commit (rilascio drag, click, tastiera, bottone LIVE): epoch SECONDI o null=live. */
	onCommit: (tSec: number | null) => void
	/** Livello imperativo durante il drag (mappa via QuakeMapHandle). */
	onScrub: (tMs: number | null) => void
	/** Variante mobile (T6): altezza ridotta, niente tooltip, readout solo in storica/drag. */
	compact?: boolean
}
export function Timeline(props: TimelineProps): ReactNode
```

Prima di scrivere: ripassare i check dataviz (form/marks/hover) e leggere la skill animejs del repo.

- [ ] **Step 1: struttura e resa** (desktop; `compact` accettato ma raffinato in T6)

Struttura del componente (codice guida — adattare i dettagli allo stile del repo, tab, commenti in italiano):

```tsx
'use client'

// Layout riga: [readout mono sx] [istogramma SVG flex-1] [● LIVE dx]
// - bins = useMemo(binEvents(events, window, nowMs)) — nowMs "congelato" del clock condiviso
// - larghezza via ResizeObserver sul contenitore (ref) → binWidth = width / bins.length
// - altezza rect: sqrt(count / maxCount) * (H - 2), min 2px se count > 0; y ancorata al baseline
// - fill: MAGNITUDE_COLORS[themeName][bin.maxClassId], bin vuoti: nessun rect
// - oltre il cursore (bin.startMs > cursorMs): opacity 0.25 (stile reference "spento")
// - gap 1px tra i rect (spacer dataviz: mark sottili, surface gap)
// - cursore: <line> stroke var(--primary) strokeWidth 2 a x = posizione di cursorMs;
//   in live x = bordo destro. Readout: font-mono data-numeric, "LIVE" o data/ora Europe/Rome
//   (Intl.DateTimeFormat 'it-IT' { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' })
// - bottone ● LIVE: in live = stato (dot bg-primary + testo, non interattivo aria-current);
//   in storica = <Button variant="outline" size="xs"> "● LIVE" che chiama onCommit(null)
// - dot-grid di sfondo (classe esistente) come nel TimelineSlot placeholder
```

Mappatura tempo↔x (pura, nel componente):

```ts
const domainStart = bins[0]?.startMs ?? 0
const domainEnd = nowMs ?? 0
const msToX = (ms: number) => ((ms - domainStart) / (domainEnd - domainStart)) * width
const xToMs = (x: number) => domainStart + (x / width) * (domainEnd - domainStart)
```

- [ ] **Step 2: stati** — `isLoading || nowMs === null` → `<Skeleton className="h-8 w-full" />` nella riga; `hasError` o finestra vuota (`events.length === 0`) → dot-grid + label muted (`Dati non disponibili al momento.` / `Nessun evento nella finestra`), pattern lista di home-client.

- [ ] **Step 3: interazioni**

```tsx
// Stato locale: dragMs (number | null) — SOLO durante il gesto; hoverBin (index | null).
// cursorMs mostrato = dragMs ?? tMs ?? nowMs.
//
// Pointer (sul contenitore istogramma, pointer capture):
//  - onPointerDown: setPointerCapture; dragMs = clamp(xToMs(offsetX)); onScrub(dragMs)
//  - onPointerMove (se capturing): idem
//  - onPointerUp: onCommit(toSec(dragMs)); dragMs = null
//    dove toSec = (ms) => { const c = clampT(Math.floor(ms/1000), nowMs, window); return c }
//    (clampT restituisce null se si rilascia sul presente → live)
//  - click secco = down+up stesso punto: già coperto dal flusso sopra
//
// Tastiera (sul cursore, role="slider", tabIndex=0):
//  - aria-valuemin=domainStart/1000, aria-valuemax=nowMs/1000, aria-valuenow=cursorMs/1000
//  - aria-valuetext = readout formattato ("LIVE" o data/ora)
//  - ArrowLeft/Right: onCommit(clampT(sec ∓/± binSize/1000)); PgUp/PgDn ±10 bin;
//    Home = inizio finestra; End = onCommit(null)  → commit immediato, niente doppio livello
//
// Tooltip bin (hover/focus, solo !compact): div assolutamente posizionato sopra il bin:
//  intervallo (formatta start–end), "N eventi", etichetta classe max (MAGNITUDE_CLASSES label)
//  — identità mai solo colore. pointer-events-none.
```

- [ ] **Step 4: motion** — anime.js v4 (leggere `.agents/skills/animejs`): snap-back del cursore verso il bordo destro quando si torna LIVE (translate della `<line>` via `animate`, ~300ms easing sobrio); transizione altezze rect al cambio finestra. Gate `prefers-reduced-motion` (matchMedia + listener, pattern quake-map). Niente animazioni durante il drag (il cursore segue il pointer 1:1).

- [ ] **Step 5: verifica compilazione** — il componente non è ancora wirato (arriva in T5): il gate del task (typecheck+lint+build) è la verifica; la verifica visiva completa avviene in T5. Gate task verde.

- [ ] **Step 6: Commit** — `web: componente timeline (istogramma bin per classe, cursore, LIVE, a11y slider)`

---

### Task 5: Wiring desktop in home-client

**Files:**
- Modify: `apps/web/app/home-client.tsx`
- Delete: `apps/web/components/shell/timeline-slot.tsx`

**Interfaces:**
- Consumes: `Timeline` (T4), `QuakeMapHandle`/`timeFilterMs` (T3), `clampT`/`shouldDeselect` (T2), `AppState.t` (T1).
- Produces: stato `tMs` derivato e handler per T6.

- [ ] **Step 1: stato e derivazioni**

```tsx
// t: URL → clamp col clock condiviso. Il clamp NON vive nel parse (pura): qui c'è nowMs.
const tMs = state.t !== null ? state.t * 1000 : null

// Correzione URL: t fuori range (finestra cambiata, t nel futuro) si riscrive una volta nota l'ora.
useEffect(() => {
	if (nowMs === null || state.t === null) return
	const clamped = clampT(state.t, nowMs, state.window)
	if (clamped !== state.t) {
		const qs = serializeAppState({ ...state, t: clamped })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}
}, [nowMs !== null, state.t, state.window]) // nowMs!==null: correggi al primo tick, non a ogni secondo

// Snapshot per lista/riepilogo/più-forti (la mappa NON usa questo: filtra via expression)
const visibleEvents = useMemo(
	() => (tMs !== null ? events.filter((e) => new Date(e.time).getTime() <= tMs) : events),
	[events, tMs]
)

// isLive: pulse/affordance live solo su 24h E sul presente
const isLive = state.window === '24h' && state.t === null

// Deselezione coerente: scrub prima dell'evento selezionato → selezione azzerata.
// Se l'evento non è nella finestra (deep-link), il suo time non è noto qui: non si giudica.
useEffect(() => {
	if (state.event === null || tMs === null) return
	const selected = events.find((e) => e.eventId === state.event)
	if (selected && shouldDeselect(new Date(selected.time).getTime(), tMs)) {
		const qs = serializeAppState({ ...state, event: null })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}
}, [tMs, state.event, events])
```

Passare `visibleEvents` (al posto di `events`) a: `Summary` (×2), `Strongest` (×2), `EventList`/`listContent`, `MobileSheet` prop `events`. `QuakeMap` continua a ricevere `events` pieni + `timeFilterMs={tMs}` + `isLive={isLive}` (sostituisce l'attuale `state.window === '24h'`).

- [ ] **Step 2: handler e ref**

```tsx
const mapHandleRef = useRef<QuakeMapHandle | null>(null)

function handleTimeCommit(tSec: number | null) {
	const qs = serializeAppState({ ...state, t: tSec })
	router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
}
const handleScrub = (ms: number | null) => mapHandleRef.current?.setTimeFilter(ms)
```

`<QuakeMap handleRef={mapHandleRef} … />`.

- [ ] **Step 3: sostituzione slot** — al posto di `<TimelineSlot />`:

```tsx
<div className="hidden overflow-hidden border-t border-border md:col-start-2 md:row-start-2 md:flex">
	<Timeline
		events={events}
		window={state.window}
		tMs={tMs}
		nowMs={nowMs}
		isLoading={isLoading}
		hasError={isError}
		onCommit={handleTimeCommit}
		onScrub={handleScrub}
	/>
</div>
```

Eliminare `timeline-slot.tsx` e il suo import.

- [ ] **Step 4: verifica** — gate verde; dev boot; browser desktop: scrub fluido (mappa filtra durante il drag), al rilascio lista/riepilogo/più-forti si aggiornano, `?t` nell'URL, back/forward coerenti, ● LIVE torna al presente, deep-link con `?t` parte in storica, cambio finestra clampa. Annotare l'esito nel report.
- [ ] **Step 5: Commit** — `web: scrubber attivo — snapshot globale da ?t, filtro mappa a due livelli, timeline al posto del placeholder`

---

### Task 6: Variante mobile compact

**Files:**
- Modify: `apps/web/components/timeline.tsx` (raffinare `compact`), `apps/web/app/home-client.tsx`

**Interfaces:**
- Consumes: tutto da T4/T5.
- Produces: —

- [ ] **Step 1: compact in Timeline** — con `compact`: altezza riga ~40px (istogramma ~24px), niente tooltip, readout visibile SOLO se `dragMs !== null || tMs !== null` (in live nessun testo, solo il dot LIVE compatto), bottone LIVE ridotto (`size="xs"`, solo `●` + `LIVE`). Touch: `touch-action: none` sull'istogramma (il drag orizzontale non deve scrollare la pagina). Instance-safe: nessun id statico (usare `useId` per aria-labelledby del gruppo).

- [ ] **Step 2: piazzamento** — in home-client, nel blocco overlay top mobile (sotto `<Summary …/>` dentro il div `pointer-events-auto`, home-client.tsx:181-190):

```tsx
<Timeline
	compact
	events={events}
	window={state.window}
	tMs={tMs}
	nowMs={nowMs}
	isLoading={isLoading}
	hasError={isError}
	onCommit={handleTimeCommit}
	onScrub={handleScrub}
/>
```

La striscia sta SOTTO l'header (decisione brainstorming n.8): niente ancoraggio allo sheet, visibile a ogni snap, pill legenda invariata. Stile card coerente coi chip (rounded-xl border bg-card, come Summary).

- [ ] **Step 3: verifica** — gate; browser mobile viewport (390×844): drag scrubba la mappa, rilascio aggiorna sheet (lista/riepilogo con visibleEvents), nessuno scroll della pagina durante il drag, entrambi i temi.
- [ ] **Step 4: Commit** — `web: timeline compatta mobile sotto l'header`

---

### Task 7: Verifica finale del piano

- [ ] **Step 1: gate completo** — `pnpm test && pnpm lint && pnpm lint:types && pnpm typecheck && pnpm format:check && pnpm --filter web build` tutti verdi.
- [ ] **Step 2: verifica visiva** (browser MCP se disponibile, altrimenti checklist all'utente): istogramma leggibile su dark e light (colori classe = mappa); cursore/LIVE unico loud; scrub 60fps sulla mappa; commit aggiorna tutto; tooltip bin con testo (mai solo colore); tastiera (frecce/Home/End) funziona; `?t` deep-link e back/forward; mobile sotto header, drag senza scroll; deselezione scrubbando prima dell'evento selezionato; pulse spento in storica; attribuzione INGV e disclaimer visibili.
- [ ] **Step 3: esito** — appendice "Esito esecuzione" nel piano (pattern Piano 3) con commit, deferred e residui; commit `Piano 4: esito esecuzione`.

## Decisioni chiuse in stesura

- Parse di `t` pura (solo formato), clamp in `clampT` dove c'è `nowMs`: niente Date.now nel parse (hydration).
- Bin ancorati ai confini UTC per 15min/2h/8h (offset Roma a ore intere → coincidono coi confini locali) e alla mezzanotte Europe/Rome per i bin giornalieri (90g).
- Scala sqrt sulle altezze (bin singoli leggibili accanto ai picchi di sciame), min-height 2px.
- Tooltip custom leggero (div posizionato), non ui/tooltip: un solo tooltip attivo, 90+ target, overhead non giustificato.
- La tastiera committa subito (niente livello imperativo): un solo percorso di commit per gesto discreto.
