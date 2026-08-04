# Filtro Percepito vs Assoluto — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un toggle "Tutti | Percepiti" nell'AreaPreset che filtra la lista eventi per percepibilità stimata via formula IPE (zero fetch aggiuntive), con attenuazione visiva degli eventi non percepibili.

**Architecture:** Due funzioni pure in `packages/core/src/shakemap.ts` (`estimateEpicentralMMI`, `isFelt`), toggle in `AreaPreset` via `TabbedControl` + `usePersistentPref('feltFilter')`, filtro + opacità condizionale in `EventList`, wiring in `home-client.tsx`.

**Tech Stack:** TypeScript, React, Vitest, TanStack Query, shadcn/ui (TabbedControl, Tooltip)

## Global Constraints

- Zero fetch aggiuntive: la formula IPE usa solo `magnitude` e `depthKm` già disponibili
- La preferenza `feltFilter` va in localStorage (`usePersistentPref`), non nell'URL
- Soglia di percepibilità: MMI ≥ III (funzione `isFelt`)
- Disclaimer "Stima basata su modello IPE internazionale" via tooltip su "Percepiti"
- Comportamento lista vuota con filtro attivo: messaggio "Nessun evento percepito"
- File `Earthquake` type NON modificato: `isFelt` è calcolato inline, non memorizzato

---

### Task 1: Funzioni IPE in `packages/core/src/shakemap.ts` + test

**Files:**
- Modify: `packages/core/src/shakemap.ts`
- Modify: `packages/core/test/shakemap.test.ts`

**Interfaces:**
- Produces: `estimateEpicentralMMI(magnitude: number, depthKm: number): number`
- Produces: `isFelt(magnitude: number, depthKm: number): boolean`

- [ ] **Step 1: Scrivi i test per `estimateEpicentralMMI` e `isFelt`**

In `packages/core/test/shakemap.test.ts`, aggiungi dopo la describe esistente:

```typescript
import { estimateEpicentralMMI, isFelt } from '../src/shakemap'

describe('estimateEpicentralMMI', () => {
  it('Mw 6.1 a 259 km → MMI ≈ 4.4 (borderline)', () => {
    const mmi = estimateEpicentralMMI(6.1, 259)
    expect(mmi).toBeCloseTo(4.4, 0)
  })

  it('Md 4.7 a 2.5 km → MMI ≈ 7.9 (molto percepibile)', () => {
    const mmi = estimateEpicentralMMI(4.7, 2.5)
    expect(mmi).toBeCloseTo(7.9, 0)
  })

  it('profondità < 1 km → clamped a R=1 (evita log(0))', () => {
    const mmi = estimateEpicentralMMI(3.0, 0.3)
    expect(mmi).toBeGreaterThan(0)
    expect(Number.isFinite(mmi)).toBe(true)
  })

  it('Mw 2.0 a 10 km → MMI ≈ 3.1', () => {
    const mmi = estimateEpicentralMMI(2.0, 10)
    expect(mmi).toBeCloseTo(3.1, 0)
  })
})

describe('isFelt', () => {
  it('Mw 6.1 a 259 km → percepito', () => {
    expect(isFelt(6.1, 259)).toBe(true)
  })

  it('Mw 2.0 a 10 km → percepito (MMI ≈ 3.1, soglia III)', () => {
    expect(isFelt(2.0, 10)).toBe(true)
  })

  it('Mw 2.0 a 50 km → NON percepito', () => {
    expect(isFelt(2.0, 50)).toBe(false)
  })

  it('Mw 1.0 a 5 km → NON percepito', () => {
    expect(isFelt(1.0, 5)).toBe(false)
  })
})
```

- [ ] **Step 2: Esegui i test — devono fallire**

```bash
pnpm --filter @quakewatch/core test -- shakemap
```
Expected: FAIL — `estimateEpicentralMMI is not exported`

- [ ] **Step 3: Implementa le funzioni**

In `packages/core/src/shakemap.ts`, aggiungi in fondo al file:

```typescript
/** Stima MMI epicentrale (D=0) — Atkinson & Wald 2007, coefficienti approssimati. */
export function estimateEpicentralMMI(magnitude: number, depthKm: number): number {
  const R = Math.max(depthKm, 1)
  return 3.23 + 1.18 * magnitude - 2.44 * Math.log10(R)
}

/** Soglia di percepibilità: MMI ≥ III. */
export function isFelt(magnitude: number, depthKm: number): boolean {
  return estimateEpicentralMMI(magnitude, depthKm) >= 3.0
}
```

- [ ] **Step 4: Esegui i test — devono passare**

```bash
pnpm --filter @quakewatch/core test -- shakemap
```
Expected: PASS (6 nuovi test + 4 esistenti)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shakemap.ts packages/core/test/shakemap.test.ts
git commit -m "feat(core): aggiunge estimateEpicentralMMI e isFelt (IPE Atkinson-Wald)"
```

---

### Task 2: Export da `packages/core/src/index.ts`

**Files:**
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `estimateEpicentralMMI`, `isFelt` da `./shakemap`
- Produces: (nessuna nuova interfaccia — sono già esportate via barrel)

- [ ] **Step 1: Esporta le funzioni**

In `packages/core/src/index.ts`, la riga `export * from './shakemap'` già esporta tutto da shakemap.ts. Verifica che copra le nuove funzioni:

```typescript
export * from './shakemap'
```

Questa riga esiste già — nessuna modifica necessaria. L'export `*` include automaticamente `estimateEpicentralMMI` e `isFelt`.

- [ ] **Step 2: Verifica che l'export funzioni**

```bash
pnpm --filter @quakewatch/core test -- shakemap
```
Expected: PASS (i test importano da `../src/shakemap` direttamente, ma l'export barrel è comunque attivo)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "chore(core): verifica export barrel per estimateEpicentralMMI/isFelt"
```

---

### Task 3: Toggle "Tutti | Percepiti" in `AreaPreset` + test

**Files:**
- Modify: `apps/web/components/shell/area-preset.tsx`
- Modify: `apps/web/test/prefs.test.ts`

**Interfaces:**
- Consumes: `TabbedControl` da `@/components/ui/tabbed-control` (già usato)
- Produces: nuove prop opzionali `feltFilter?: 'all' | 'felt'`, `onFeltFilterChange?: (v: 'all' | 'felt') => void`

- [ ] **Step 1: Aggiungi test per il roundtrip `feltFilter` in localStorage**

In `apps/web/test/prefs.test.ts`, aggiungi:

```typescript
describe('feltFilter preference', () => {
  it('feltFilter default "all"', () => {
    const s = makeStorage()
    expect(readPref('feltFilter', 'all', s)).toBe('all')
  })

  it('feltFilter roundtrip write→read', () => {
    const s = makeStorage()
    writePref('feltFilter', 'felt', s)
    expect(readPref('feltFilter', 'all', s)).toBe('felt')
  })
})
```

- [ ] **Step 2: Esegui i test — devono passare**

```bash
pnpm --filter web test -- prefs
```
Expected: PASS (2 nuovi test + 11 esistenti)

- [ ] **Step 3: Modifica `AreaPreset`**

In `apps/web/components/shell/area-preset.tsx`, aggiungi:

```typescript
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
```

Modifica l'interfaccia:

```typescript
export interface AreaPresetProps {
  area: string
  window: TimeWindow
  onChange: (area: string, window: TimeWindow) => void
  feltFilter?: 'all' | 'felt'
  onFeltFilterChange?: (value: 'all' | 'felt') => void
}
```

Nel corpo del componente, destruttura con default:

```typescript
export function AreaPreset({
  area, window, onChange,
  feltFilter = 'all',
  onFeltFilterChange = () => {},
}: AreaPresetProps) {
```

Nella seconda riga del componente (quella con `flex items-center justify-end gap-2`), sostituisci con:

```typescript
<div className="flex items-center justify-between gap-2">
  <TabbedControl
    aria-label="Filtro percepibilità"
    value={feltFilter}
    options={[
      { value: 'all', label: 'Tutti' },
      {
        value: 'felt',
        label: (
          <Tooltip>
            <TooltipTrigger as="span" className="cursor-default">
              Percepiti
            </TooltipTrigger>
            <TooltipContent>
              Stima basata su modello IPE internazionale
            </TooltipContent>
          </Tooltip>
        ),
      },
    ]}
    onChange={(next) => onFeltFilterChange(next as 'all' | 'felt')}
    className="flex w-auto"
    triggerClassName="text-[10px] tracking-wide"
  />
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-muted-foreground">{WINDOW_DESCRIPTION[window]}</span>
    <ButtonGroup aria-label="Finestra temporale">
      {/* ... invariato ... */}
    </ButtonGroup>
  </div>
</div>
```

- [ ] **Step 4: Verifica che compili (retrocompatibile)**

```bash
pnpm --filter web typecheck
```
Expected: no errori (le nuove prop sono opzionali con default, home-client compila senza modificarle)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/shell/area-preset.tsx apps/web/test/prefs.test.ts
git commit -m "feat(web): aggiunge toggle Tutti/Percepiti nell'AreaPreset"
```

---

### Task 4: Attenuazione visiva in `EventList`

**Files:**
- Modify: `apps/web/components/shell/event-list.tsx`

**Interfaces:**
- Consumes: `Earthquake` da `@quakewatch/core`
- Nuova prop: `isFelt: (event: Earthquake) => boolean` (solo per opacità — il filtro è upstream in home-client)

L'`EventList` attuale riceve sempre eventi (lo stato vuoto è gestito da `home-client.tsx` con `visibleEvents.length === 0`). Il filtro percepito è già applicato in `home-client` su `visibleEvents`, quindi `EventList` riceve eventi già filtrati. Serve solo l'opacità condizionale.

- [ ] **Step 1: Modifica l'interfaccia e aggiungi opacità condizionale**

In `apps/web/components/shell/event-list.tsx`:

Aggiungi la nuova prop all'interfaccia:

```typescript
export interface EventListProps {
  events: Earthquake[]
  selectedId: string | null
  onSelect: (eventId: string) => void
  nowMs: number | null
  restoreFocusId?: string | null
  isFelt?: (event: Earthquake) => boolean
}
```

`isFelt` è opzionale: se non passata (retrocompatibile), nessuna attenuazione.

Nel rendering di ogni riga, aggiungi l'opacità condizionale sul `<button>`:

```typescript
const felt = isFelt ? isFelt(event) : true
```

E sul `<button>`:

```typescript
className={cn(
  'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted',
  isSelected && 'bg-muted',
  !felt && 'opacity-60'
)}
```

Nessuna logica di filtro, nessuno stato vuoto — restano in `home-client.tsx`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/shell/event-list.tsx
git commit -m "feat(web): aggiunge opacità eventi non percepibili in EventList"
```

---

### Task 5: Wiring in `home-client.tsx`

**Files:**
- Modify: `apps/web/app/home-client.tsx`

**Interfaces:**
- Consumes: `isFelt` da `@quakewatch/core`
- Consumes: `usePersistentPref` da `@/hooks/use-persistent-pref`
- Produce: (nessuna nuova interfaccia — wiring interno)

- [ ] **Step 1: Aggiungi import e preferenza**

In `apps/web/app/home-client.tsx`, dopo l'import di `usePersistentPref`:

```typescript
import { isFelt, WINDOW_CONFIG, type TimeWindow } from '@quakewatch/core'
```

Aggiungi la preferenza dopo `usePersistentPref<Variant>`:

```typescript
const [feltFilter, setFeltFilter] = usePersistentPref<'all' | 'felt'>('feltFilter', 'all')
```

- [ ] **Step 2: Filtra `visibleEvents` e varia `emptyLabel`**

Sostituisci il `useMemo` esistente di `visibleEvents`:

```typescript
const visibleEvents = useMemo(() => {
  const timeFiltered = tMs !== null ? events.filter((e) => new Date(e.time).getTime() <= tMs) : events
  return feltFilter === 'felt' ? timeFiltered.filter(isFelt) : timeFiltered
}, [events, tMs, feltFilter])
```

Sostituisci `emptyLabel` (dopo la dichiarazione di `WINDOW_TEXT`) con:

```typescript
const emptyLabel = feltFilter === 'felt'
  ? 'Nessun evento percepito'
  : threshold
    ? `Nessun evento M≥${threshold} ${WINDOW_TEXT[state.window]}`
    : `Nessun evento ${WINDOW_TEXT[state.window]}`
```

- [ ] **Step 3: Passa le nuove prop a `AreaPreset`**

```typescript
<AreaPreset
  area={state.area}
  window={state.window}
  onChange={handleAreaWindowChange}
  feltFilter={feltFilter}
  onFeltFilterChange={setFeltFilter}
/>
```

- [ ] **Step 4: Passa `isFelt` a `EventList`**

Cerca `<EventList` (usato una sola volta in `listContent`). Aggiungi:

```typescript
listContent = (
  <EventList
    events={visibleEvents}
    selectedId={state.event}
    onSelect={handleSelectEvent}
    nowMs={nowMs}
    restoreFocusId={lastClearedIdRef.current}
    isFelt={isFelt}
  />
)
```

- [ ] **Step 5: Verifica typecheck e build**

```bash
pnpm --filter web typecheck
```
Expected: nessun errore

```bash
pnpm --filter web build
```
Expected: build success

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/home-client.tsx
git commit -m "feat(web): wiring filtro percepito in home-client"
```

---

### Task 6: Verifica end-to-end

**Files:**
- Nessuna modifica — solo verifica

- [ ] **Step 1: Esegui tutti i test del monorepo**

```bash
pnpm -r test
```
Expected: tutti i test passano

- [ ] **Step 2: Avvia il dev server e verifica visivamente**

```bash
pnpm --filter web dev
```

Apri `http://localhost:3000` e verifica:
1. Il toggle "Tutti | Percepiti" appare nell'AreaPreset accanto alle finestre temporali
2. Cliccando "Percepiti" la lista si accorcia (solo eventi percepibili)
3. In modalità "Tutti", gli eventi non percepibili hanno `opacity-60`
4. Il tooltip su "Percepiti" mostra il disclaimer
5. La preferenza persiste tra refresh (localStorage)
6. Il conteggio in `Summary` riflette il dataset filtrato

- [ ] **Step 3: Commit finale (se serve)**

Se non ci sono modifiche, nessun commit aggiuntivo.

---
