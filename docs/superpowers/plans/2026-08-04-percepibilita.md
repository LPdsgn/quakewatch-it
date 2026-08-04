# Filtro Percepito vs Assoluto — Implementation Plan

> **Spec:** [`docs/superpowers/specs/2026-08-04-percepibilita-design.md`](../specs/2026-08-04-percepibilita-design.md)
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un toggle "Tutti / Percepiti" che filtra la lista eventi mostrando solo i terremoti probabilmente percepibili (stima IPE Atkinson-Wald 2007 da magnitudo + profondità, senza fetch aggiuntive). Gli eventi sotto soglia in modalità "Tutti" appaiono attenuati (`opacity-60`).

**Architecture:** Funzioni pure `estimateEpicentralMMI` / `isFelt` in `packages/core/src/shakemap.ts`; preferenza `feltFilter` persistita via `usePersistentPref` (già esistente); prop drilling da `home-client` → `AreaPreset` (nuovo `TabbedControl` nella seconda riga) + `EventList` (filtro + opacità condizionale). `Summary` e `Strongest` vedono già `visibleEvents` filtrato — nessuna modifica.

**Tech Stack:** TypeScript strict, Vitest, React 19, oxlint/oxfmt.

## Global Constraints

- Zero nuove dipendenze, zero fetch aggiuntive. I dati (`magnitude`, `depthKm`) sono già nell'`Earthquake` type.
- Formula IPE: `MMI = 3.23 + 1.18 * M - 2.44 * log10(R)` con `R = max(depthKm, 1)`. Soglia: `MMI >= 3.0`.
- Preferenza `feltFilter` (`'all' | 'felt'`) in localStorage via `usePersistentPref<'all' | 'felt'>('feltFilter', 'all')` — stesso pattern di `variant`.
- Tooltip su "Percepiti": _"Stima basata su modello IPE internazionale"_ per trasparenza sul fatto che è una stima, non una misura.
- TS strict, `oxlint --max-warnings=0`, `oxfmt`, `vitest run`.

---

### Task 1: Funzioni IPE in `packages/core`

**Files:**
- Modify: `packages/core/src/shakemap.ts`
- Modify: `packages/core/test/shakemap.test.ts`
- No change: `packages/core/src/index.ts` (già esporta barrel `shakemap`)

**Interfaces:**
- Produce: `estimateEpicentralMMI(magnitude, depthKm) → number`, `isFelt(magnitude, depthKm) → boolean`. Usate da Task 3 (EventList) e Task 4 (home-client).

- [ ] **Step 1: Write failing test**

In `packages/core/test/shakemap.test.ts`, aggiungi in fondo (dopo il blocco `isShakemapContours`):

```ts
import { estimateEpicentralMMI, isFelt } from '../src/shakemap'

describe('estimateEpicentralMMI', () => {
	it('Mw 6.1 a 259 km → MMI ≈ 4.5 (borderline, percepito)', () => {
		const mmi = estimateEpicentralMMI(6.1, 259)
		expect(mmi).toBeCloseTo(4.46, 0)
		expect(mmi).toBeGreaterThan(3.0)
	})

	it('Md 4.7 a 2.5 km → MMI ≈ 7.9 (molto percepito)', () => {
		const mmi = estimateEpicentralMMI(4.7, 2.5)
		expect(mmi).toBeCloseTo(7.92, 0)
		expect(mmi).toBeGreaterThan(3.0)
	})

	it('Mw 3.0 a 100 km → MMI ≈ 1.9 (non percepito)', () => {
		const mmi = estimateEpicentralMMI(3.0, 100)
		expect(mmi).toBeCloseTo(1.89, 1)
		expect(mmi).toBeLessThan(3.0)
	})

	it('profondità <= 0 → tratta come R=1 (evita log10(0))', () => {
		const mmi = estimateEpicentralMMI(2.0, 0)
		expect(mmi).toBeCloseTo(3.23 + 1.18 * 2.0 - 2.44 * Math.log10(1), 5)
	})

	it('magnitudo zero → MMI bassissimo', () => {
		const mmi = estimateEpicentralMMI(0, 10)
		expect(mmi).toBeLessThan(2)
	})
})

describe('isFelt', () => {
	it('M >= 3 a bassa profondità → true', () => {
		expect(isFelt(3.5, 5)).toBe(true)
	})

	it('M >= 6 a grande profondità → true (MMI ~4.5)', () => {
		expect(isFelt(6.1, 259)).toBe(true)
	})

	it('M < 2.5 a profondità normale → false', () => {
		expect(isFelt(2.0, 10)).toBe(false)
	})

	it('M >= 3 ma profondissimo → false (MMI sotto soglia)', () => {
		// M=3.0 a 200 km → MMI ≈ 3.23+3.54-5.61 ≈ 1.16
		expect(isFelt(3.0, 200)).toBe(false)
	})

	it('profondità <= 0 → R=1, nessun NaN', () => {
		expect(isFelt(3.5, -1)).toBe(true) // MMI ≈ 5.6
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter core test -- shakemap`
Expected: FAIL — `estimateEpicentralMMI is not exported`.

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/shakemap.ts`, aggiungi in fondo (dopo `isShakemapContours`):

```ts
/** Stima MMI epicentrale (D=0) — Atkinson & Wald 2007, coefficienti approssimati.
 *  R = max(depthKm, 1): evita log10(0) per profondità invalide. */
export function estimateEpicentralMMI(magnitude: number, depthKm: number): number {
	const R = Math.max(depthKm, 1)
	return 3.23 + 1.18 * magnitude - 2.44 * Math.log10(R)
}

/** Soglia di percepibilità: MMI ≥ III. */
export function isFelt(magnitude: number, depthKm: number): boolean {
	return estimateEpicentralMMI(magnitude, depthKm) >= 3.0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter core test -- shakemap`
Expected: PASS (tutti i test, inclusi i nuovi).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shakemap.ts packages/core/test/shakemap.test.ts
git commit -m "feat(core): aggiunge estimateEpicentralMMI e isFelt (IPE Atkinson-Wald 2007)"
```

---

### Task 2: Toggle "Tutti / Percepiti" in AreaPreset

**Files:**
- Modify: `apps/web/components/shell/area-preset.tsx`

**Interfaces:**
- Nuove prop: `feltFilter: 'all' | 'felt'`, `onFeltFilterChange: (value: 'all' | 'felt') => void`
- Consuma: `TabbedControl` (già importato).
- Produce: nuova riga con `Tutti | Percepiti` a sinistra dei bottoni finestra temporale.

- [ ] **Step 1: Update interface and component**

In `apps/web/components/shell/area-preset.tsx`, modifica:

```tsx
import { AREA_PRESETS, TIME_WINDOWS, type TimeWindow } from '@quakewatch/core'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { TabbedControl } from '@/components/ui/tabbed-control'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const WINDOW_LABEL: Record<TimeWindow, string> = {
	'24h': '24H',
	'7d': '7G',
	'30d': '30G',
	'90d': '90G',
}

const WINDOW_DESCRIPTION: Record<TimeWindow, string> = {
	'24h': 'Ultime 24 ore',
	'7d': 'Ultimi 7 giorni',
	'30d': 'Ultimi 30 giorni',
	'90d': 'Ultimi 90 giorni',
}

export interface AreaPresetProps {
	area: string
	window: TimeWindow
	feltFilter: 'all' | 'felt'
	onChange: (area: string, window: TimeWindow) => void
	onFeltFilterChange: (value: 'all' | 'felt') => void
}

/**
 * Zone su TabbedControl (aspetto TabsList/TabsTrigger, riga piena); seconda riga:
 * filtro percepito a sinistra + orizzonti temporali a destra con label contestuale.
 */
export function AreaPreset({ area, window, feltFilter, onChange, onFeltFilterChange }: AreaPresetProps) {
	return (
		<div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2">
			<TabbedControl
				aria-label="Zona"
				value={area}
				options={AREA_PRESETS.map((a) => ({ value: a.id, label: a.label }))}
				onChange={(next) => onChange(next, window)}
				className="flex w-full"
				triggerClassName="text-[10px] tracking-wide uppercase"
			/>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<TabbedControl
						aria-label="Filtro percepito"
						value={feltFilter}
						options={[
							{ value: 'all', label: 'Tutti' },
							{
								value: 'felt',
								label: (
									<Tooltip>
										<TooltipTrigger asChild>
											<span>Percepiti</span>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											Stima basata su modello IPE internazionale
										</TooltipContent>
									</Tooltip>
								),
							},
						]}
						onChange={onFeltFilterChange}
						className="flex"
						triggerClassName="text-[10px] tracking-wide uppercase"
					/>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-[10px] text-muted-foreground">{WINDOW_DESCRIPTION[window]}</span>
					<ButtonGroup aria-label="Finestra temporale">
						{TIME_WINDOWS.map((w) => (
							<Button
								key={w}
								type="button"
								variant="outline"
								size="xs"
								aria-pressed={window === w}
								onClick={() => onChange(area, w)}
								className={cn(
									'font-mono text-[10px]',
									window === w ? 'bg-muted text-foreground' : 'text-muted-foreground'
								)}
								data-numeric
							>
								{WINDOW_LABEL[w]}
							</Button>
						))}
					</ButtonGroup>
				</div>
			</div>
		</div>
	)
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: typecheck PASS (AreaPreset ha nuove prop; home-client.tsx avrà errori finché Task 4 non atterra, ma non blocca — le prop sono ancora opzionali? No, sono required. Il typecheck fallirà sul call site in home-client, che verrà fixato in Task 4. Per ora: aspettarsi FAIL su home-client.tsx, tutto il resto OK).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/shell/area-preset.tsx
git commit -m "feat(web): aggiunge toggle Tutti/Percepiti in AreaPreset"
```

> **Nota:** il typecheck fallirà su `home-client.tsx` finché Task 4 non atterra. È atteso: la prop è required e il call site non la passa ancora. L'errore si risolve con Task 4.

---

### Task 3: EventList — filtro + attenuazione

**Files:**
- Modify: `apps/web/components/shell/event-list.tsx`
- Create: `apps/web/test/event-list.test.tsx`

**Interfaces:**
- Nuove prop: `feltFilter: 'all' | 'felt'`, `isFelt(event: Earthquake): boolean`
- Comportamento:
  - `feltFilter === 'felt'` → mostra solo eventi con `isFelt(event)`; stato vuoto "Nessun evento percepito" (dot-grid).
  - `feltFilter === 'all'` → mostra tutti; righe non percepite con `opacity-60` sull'intero `<button>`.

- [ ] **Step 1: Write failing test**

Create `apps/web/test/event-list.test.tsx`:

```ts
// @vitest-environment happy-dom
import type { Earthquake } from '@quakewatch/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EventList } from '../components/shell/event-list'

const NOW = 1754310000000 // epoch ms fissi per test deterministici

function makeEvent(overrides: Partial<Earthquake> = {}): Earthquake {
	return {
		eventId: '1',
		time: '2026-08-04T12:00:00.000Z',
		latitude: 40.8,
		longitude: 14.1,
		depthKm: 10,
		magnitude: 3.5,
		magnitudeType: 'Md',
		locationName: 'Campi Flegrei',
		...overrides,
	}
}

describe('EventList felt filter', () => {
	it("feltFilter='all': mostra tutti + attenuazione su eventi non percepiti", () => {
		const events = [
			makeEvent({ eventId: '1', magnitude: 3.5, depthKm: 5 }), // percepito
			makeEvent({ eventId: '2', magnitude: 2.0, depthKm: 10 }), // non percepito (MMI ~1.2)
		]
		render(
			<EventList
				events={events}
				selectedId={null}
				onSelect={() => {}}
				nowMs={NOW}
				feltFilter="all"
				isFelt={(e) => e.magnitude >= 3 || (e.magnitude >= 2.5 && e.depthKm <= 5)}
			/>
		)
		// Entrambi visibili
		expect(screen.getByText('3.5')).toBeInTheDocument()
		expect(screen.getByText('2.0')).toBeInTheDocument()
		// L'evento non percepito ha opacity-60
		const nonFeltBtn = screen.getByText('2.0').closest('button')
		expect(nonFeltBtn?.className).toMatch(/opacity-60/)
		// L'evento percepito NO
		const feltBtn = screen.getByText('3.5').closest('button')
		expect(feltBtn?.className).not.toMatch(/opacity-60/)
	})

	it("feltFilter='felt': mostra solo eventi percepiti", () => {
		const events = [
			makeEvent({ eventId: '1', magnitude: 3.5, depthKm: 5 }), // percepito
			makeEvent({ eventId: '2', magnitude: 2.0, depthKm: 10 }), // non percepito
		]
		render(
			<EventList
				events={events}
				selectedId={null}
				onSelect={() => {}}
				nowMs={NOW}
				feltFilter="felt"
				isFelt={(e) => e.magnitude >= 3 || (e.magnitude >= 2.5 && e.depthKm <= 5)}
			/>
		)
		expect(screen.getByText('3.5')).toBeInTheDocument()
		expect(screen.queryByText('2.0')).not.toBeInTheDocument()
	})

	it("feltFilter='felt': stato vuoto quando nessun evento percepito", () => {
		const events = [
			makeEvent({ eventId: '1', magnitude: 2.0, depthKm: 10 }),
		]
		render(
			<EventList
				events={events}
				selectedId={null}
				onSelect={() => {}}
				nowMs={NOW}
				feltFilter="felt"
				isFelt={() => false}
			/>
		)
		expect(screen.getByText('Nessun evento percepito')).toBeInTheDocument()
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- event-list`
Expected: FAIL — `Property 'feltFilter' is missing in type` (le nuove prop non esistono ancora nell'interfaccia).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/components/shell/event-list.tsx`, modifica:

```tsx
import type { Earthquake } from '@quakewatch/core'
import { useEffect, useRef } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { relativeTime } from '@/lib/rel-time'
import { cn } from '@/lib/utils'

export interface EventListProps {
	events: Earthquake[]
	selectedId: string | null
	onSelect: (eventId: string) => void
	/** Epoch ms dell'orologio condiviso (T8); null finché non montato (niente Date.now() in SSR). */
	nowMs: number | null
	/** Id dell'evento selezionato prima dell'ultimo "indietro": ripristina il focus lì (a11y). */
	restoreFocusId?: string | null
	/** Filtro percepito: 'all' mostra tutti, 'felt' solo quelli sopra soglia MMI. */
	feltFilter?: 'all' | 'felt'
	/** Predicato di percepibilità (iniettato, EventList non importa la formula). */
	isFelt?: (event: Earthquake) => boolean
}

export function EventList({ events, selectedId, onSelect, nowMs, restoreFocusId, feltFilter, isFelt }: EventListProps) {
	const sorted = events.toSorted((a, b) => b.time.localeCompare(a.time))
	const mostRecentId = sorted[0]?.eventId ?? null

	const filtered =
		feltFilter === 'felt' && isFelt
			? sorted.filter(isFelt)
			: sorted

	const listRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!restoreFocusId) return
		listRef.current
			?.querySelector<HTMLButtonElement>(`[data-event-id="${restoreFocusId}"]`)
			?.focus()
	}, [restoreFocusId])

	if (filtered.length === 0) {
		return (
			<div className="dot-grid flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-center text-xs text-muted-foreground">
				{feltFilter === 'felt' ? 'Nessun evento percepito' : 'Nessun evento'}
			</div>
		)
	}

	return (
		<ScrollArea className="min-h-0 flex-1 rounded-xl border border-border bg-card overflow-clip">
			<div ref={listRef} className="flex flex-col gap-1 p-1.5">
				{filtered.map((event) => {
					const isSelected = event.eventId === selectedId
					const isAccent = isSelected || event.eventId === mostRecentId
					const isNotFelt = feltFilter === 'all' && isFelt && !isFelt(event)
					return (
						<button
							key={event.eventId}
							type="button"
							data-event-id={event.eventId}
							aria-current={isSelected ? 'true' : undefined}
							title={new Date(event.time).toLocaleString('it-IT', {
								dateStyle: 'full',
								timeStyle: 'medium',
								timeZone: 'Europe/Rome',
							})}
							onClick={() => onSelect(event.eventId)}
							className={cn(
								'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted',
								isSelected && 'bg-muted',
								isNotFelt && 'opacity-60'
							)}
						>
							<span
								className={cn(
									'w-10 shrink-0 font-mono text-[15px]',
									isAccent ? 'text-primary' : 'text-foreground'
								)}
								data-numeric
							>
								{event.magnitude.toFixed(1)}
							</span>
							<span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
								{event.locationName}
							</span>
							<span className="shrink-0 text-[10px] text-muted-foreground" data-numeric>
								{nowMs !== null ? relativeTime(event.time, nowMs) : ''}
							</span>
							<span
								className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70"
								data-numeric
							>
								{event.depthKm.toFixed(1)} km
							</span>
						</button>
					)
				})}
			</div>
		</ScrollArea>
	)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- event-list`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/shell/event-list.tsx apps/web/test/event-list.test.tsx
git commit -m "feat(web): aggiunge filtro percepito e attenuazione opacità in EventList"
```

---

### Task 4: Wiring in `home-client.tsx`

**Files:**
- Modify: `apps/web/app/home-client.tsx`

**Interfaces:**
- Consuma: `isFelt` da `@quakewatch/core`, `usePersistentPref` da `@/hooks/use-persistent-pref`, nuove prop di `AreaPreset` e `EventList`.
- Produce: preferenza `feltFilter` persistita; `visibleEvents` filtrato; prop iniettate ai componenti figli.

- [ ] **Step 1: Write the changes**

In `apps/web/app/home-client.tsx`:

Aggiungi `isFelt` all'import da `@quakewatch/core`:
```ts
import { useEventsQuery, WINDOW_CONFIG, type TimeWindow, isFelt } from '@quakewatch/core'
```

Dopo la riga `const [variant] = usePersistentPref<Variant>('variant', 'default')`, aggiungi:
```ts
// Preferenza filtro percepito (localStorage), stesso pattern di variant.
const [feltFilter, setFeltFilter] = usePersistentPref<'all' | 'felt'>('feltFilter', 'all')
```

Sostituisci il calcolo `visibleEvents`:
```ts
// Snapshot per lista/riepilogo/più-forti (la mappa NON usa questo: filtra via expression):
// 1) filtro timeline (t), 2) filtro percepito (feltFilter).
const visibleEvents = useMemo(() => {
	let filtered = tMs !== null ? events.filter((e) => new Date(e.time).getTime() <= tMs) : events
	if (feltFilter === 'felt') filtered = filtered.filter(isFelt)
	return filtered
}, [events, tMs, feltFilter])
```

Sostituisci il call site di `<AreaPreset>`:
```tsx
<AreaPreset
	area={state.area}
	window={state.window}
	feltFilter={feltFilter}
	onChange={handleAreaWindowChange}
	onFeltFilterChange={setFeltFilter}
/>
```

Sostituisci il call site di `<EventList>` nel `listContent` (sia la versione normale che la condizione `else`):
```tsx
<EventList
	events={visibleEvents}
	selectedId={state.event}
	onSelect={handleSelectEvent}
	nowMs={nowMs}
	restoreFocusId={lastClearedIdRef.current}
	feltFilter={feltFilter}
	isFelt={(e) => isFelt(e.magnitude, e.depthKm)}
/>
```

- [ ] **Step 2: Typecheck + lint + full test**

Run:
```bash
pnpm --filter web typecheck
pnpm lint
pnpm --filter web test
```

Expected: typecheck PASS, lint 0 warnings, tutti i test PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/home-client.tsx
git commit -m "feat(web): wiring filtro percepito in home-client (preferenza + visibleEvents + prop drilling)"
```

---

### Task 5: Verifica manuale e build

**Files:** nessuno (verifica).

- [ ] **Step 1: Full test monorepo**

Run:
```bash
pnpm test
pnpm typecheck
pnpm lint
```
Expected: tutto PASS.

- [ ] **Step 2: Build di produzione**

Run:
```bash
pnpm --filter web build
```
Expected: build PASS, nessun errore.

- [ ] **Step 3: Verifica manuale (dev server)**

Run: `pnpm dev:web`, apri `http://localhost:3000`.

Verifica:
1. **Toggle "Tutti / Percepiti"** — di default su "Tutti". Switcha a "Percepiti": la lista si riduce, gli eventi sotto soglia scompaiono.
2. **Attenuazione** — torna su "Tutti": le righe di eventi sotto soglia MMI appaiono con `opacity-60` (grigie/trasparenti).
3. **Stato vuoto "Percepiti"** — seleziona una finestra/area dove tutti gli eventi sono sotto soglia (es. 90d area remota con soli M<2): appare "Nessun evento percepito" con dot-grid.
4. **Persistenza preferenza** — imposta "Percepiti", reload: il toggle resta su "Percepiti" (localStorage).
5. **Tooltip** — hover su "Percepiti": appare "Stima basata su modello IPE internazionale".
6. **Summary / Strongest** — con "Percepiti" attivo, i riepiloghi mostrano solo gli eventi percepiti (condividono `visibleEvents`).
7. **URL invariato** — l'URL non contiene `feltFilter` (è una preferenza, non una view).

- [ ] **Step 4: Commit finale (se fixup)**

Se la verifica manuale ha richiesto fix, committalii:
```bash
git add -A
git commit -m "fix(web): filtro percepito — fixup post-verifica"
```

Altrimenti nessun commit (Task 4 ha già committato il codice).

---

## Riepilogo modifiche

| File | Task | Modifica |
| :-- | :-- | :-- |
| `packages/core/src/shakemap.ts` | 1 | + `estimateEpicentralMMI`, `isFelt` |
| `packages/core/test/shakemap.test.ts` | 1 | + test IPE e soglia |
| `apps/web/components/shell/area-preset.tsx` | 2 | + prop `feltFilter`/`onFeltFilterChange`, + `TabbedControl` "Tutti/Percepiti" |
| `apps/web/components/shell/event-list.tsx` | 3 | + prop `feltFilter`/`isFelt`, + filtro, + opacità condizionale |
| `apps/web/test/event-list.test.tsx` | 3 | + test filtro e opacità |
| `apps/web/app/home-client.tsx` | 4 | + `usePersistentPref('feltFilter')`, + `isFelt` import, wiring |

5 file modificati, 1 file creato, zero nuove dipendenze.
