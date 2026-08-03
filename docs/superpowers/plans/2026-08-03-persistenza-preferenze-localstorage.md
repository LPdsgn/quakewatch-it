# Persistenza preferenze in localStorage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostare `variant` da URL a localStorage e introdurre `usePersistentPref<T>(key, default)` per preferenze sincronizzate cross-component e cross-tab, ready per future preferenze (basemap/stations/expert).

**Architecture:** Store esterno in `apps/web/lib/prefs.ts` (readPref/writePref pure + listener registry per-key + cache per useSyncExternalStore + cross-tab via storage event). Hook `usePersistentPref` via `useSyncExternalStore` (React 19 built-in): SSR-safe (serverSnapshot=default → no hydration mismatch), same-tab sync via listener registry, cross-tab via storage event. `variant` rimosso da `AppState`/`url-state.ts`; `header-menu` + `home-client` consumano `usePersistentPref`.

> **Nota deviazione:** la preferenza utente era "PrefProvider" (context provider). Progettandolo ho verificato che `useSyncExternalStore` raggiunge lo stesso obiettivo (sync cross-component, cross-tab, SSR-safe, no prop drilling) senza un componente provider — meno codice e più idiomatico (è il pattern con cui React 18+ binda store esterni). Scale ugualmente a basemap/stations/expert (ognuna è una key). Se si preferisce il provider letterale, vedere la nota finale.

**Tech Stack:** React 19 `useSyncExternalStore`, Vitest, `@testing-library/react` + `happy-dom` (per test hook), TS strict, oxlint/oxfmt.

## Global Constraints

- localStorage only, **no cookie** (ePrivacy strictly-necessary exemption, nessun consenso/banner).
- SSR-safe: server render + hydration = `default`; update al valore persistito post-mount (no hydration mismatch).
- View state (`window`/`area`/`event`/`t`) **resta in URL**. Theme resta su next-themes (non toccare).
- **Drop `?variant=` URL override** (YAGNI per preferenza di layout; basemap aggiungerà override solo se servirà shareable).
- `T` deve essere JSON-serializzabile; la cache interna garantisce stabilità referenziale anche per oggetti.
- TS strict, `oxlint --max-warnings=0`, `oxfmt`, `vitest run`.

---

### Task 1: Store prefs (pure I/O + listener registry + cache)

**Files:**
- Create: `apps/web/lib/prefs.ts`
- Test: `apps/web/test/prefs.test.ts`

**Interfaces:**
- Produces: `readPref<T>(key, fallback, storage?) → T`, `writePref<T>(key, value, storage?) → void`, `snapshot<T>(key, fallback) → T`, `subscribe(key, cb) → () => void`, `PrefStorage`. Usati da Task 2 (hook).

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/prefs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { readPref, writePref, subscribe, type PrefStorage } from '../lib/prefs'

function makeStorage(): PrefStorage {
	const map = new Map<string, string>()
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			map.set(k, v)
		},
		removeItem: (k) => {
			map.delete(k)
		},
	}
}

describe('readPref', () => {
	it('fallback quando storage null (SSR)', () => {
		expect(readPref('k1', 'def', null)).toBe('def')
	})
	it('fallback quando chiave assente', () => {
		expect(readPref('k2', 'def', makeStorage())).toBe('def')
	})
	it('legge valore JSON valido', () => {
		const s = makeStorage()
		s.setItem('k3', '"val"')
		expect(readPref('k3', 'def', s)).toBe('val')
	})
	it('fallback su JSON malformato', () => {
		const s = makeStorage()
		s.setItem('k4', '{not json')
		expect(readPref('k4', 'def', s)).toBe('def')
	})
	it('legge oggetti complessi', () => {
		const s = makeStorage()
		s.setItem('k5', JSON.stringify({ a: 1 }))
		expect(readPref('k5', null, s)).toEqual({ a: 1 })
	})
})

describe('writePref', () => {
	it('no-op quando storage null (SSR)', () => {
		expect(() => writePref('k6', 'v', null)).not.toThrow()
	})
	it('serializza e scrive', () => {
		const s = makeStorage()
		writePref('k7', { a: 1 }, s)
		expect(s.getItem('k7')).toBe('{"a":1}')
	})
	it('roundtrip write→read', () => {
		const s = makeStorage()
		writePref('k8', 'val', s)
		expect(readPref('k8', 'def', s)).toBe('val')
	})
})

describe('subscribe + notify', () => {
	it('subscriber notificato su writePref stessa chiave', () => {
		const s = makeStorage()
		let calls = 0
		const unsub = subscribe('k9', () => {
			calls++
		})
		writePref('k9', 'v', s)
		expect(calls).toBe(1)
		unsub()
	})
	it('subscriber NON notificato su altra chiave', () => {
		const s = makeStorage()
		let calls = 0
		subscribe('k10', () => {
			calls++
		})
		writePref('other10', 'v', s)
		expect(calls).toBe(0)
	})
	it('unsubscribe ferma le notifiche', () => {
		const s = makeStorage()
		let calls = 0
		const unsub = subscribe('k11', () => {
			calls++
		})
		unsub()
		writePref('k11', 'v', s)
		expect(calls).toBe(0)
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test`
Expected: FAIL — `Cannot find module '../lib/prefs'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/prefs.ts`:

```ts
/** Storage iniettabile per testabilità (vitest node env senza DOM). */
export interface PrefStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

function getStorage(): PrefStorage | null {
	return typeof window !== 'undefined' ? window.localStorage : null
}

/** Legge e parse-JSON una preferenza; fallback su assenza/errore/SSR. Pure, no cache. */
export function readPref<T>(key: string, fallback: T, storage: PrefStorage | null = getStorage()): T {
	if (storage === null) return fallback
	const raw = storage.getItem(key)
	if (raw === null) return fallback
	try {
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}

const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

function notify(key: string): void {
	cache.delete(key)
	listeners.get(key)?.forEach((cb) => cb())
}

/** Scrive (JSON) + invalida cache + notifica i subscriber. No-op in SSR. */
export function writePref<T>(key: string, value: T, storage: PrefStorage | null = getStorage()): void {
	if (storage === null) return
	storage.setItem(key, JSON.stringify(value))
	notify(key)
}

/** Snapshot cached per useSyncExternalStore (referenza stabile tra notifiche). */
export function snapshot<T>(key: string, fallback: T): T {
	if (cache.has(key)) return cache.get(key) as T
	const value = readPref(key, fallback)
	cache.set(key, value)
	return value
}

/** Sottoscrizione per-key per useSyncExternalStore. */
export function subscribe(key: string, cb: () => void): () => void {
	let set = listeners.get(key)
	if (!set) {
		set = new Set()
		listeners.set(key, set)
	}
	set.add(cb)
	return () => {
		set!.delete(cb)
		if (set!.size === 0) listeners.delete(key)
	}
}

// Cross-tab: storage event fires in OTHER tabs → invalidate cache + notify.
if (typeof window !== 'undefined') {
	window.addEventListener('storage', (e: StorageEvent) => {
		if (e.key) notify(e.key)
	})
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test`
Expected: PASS (tutti i test prefs).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/prefs.ts apps/web/test/prefs.test.ts
git commit -m "feat(web): add prefs store (localStorage I/O + listener registry + cache)"
```

---

### Task 2: Hook `usePersistentPref` via useSyncExternalStore

**Files:**
- Create: `apps/web/hooks/use-persistent-pref.ts`
- Test: `apps/web/test/use-persistent-pref.test.ts`
- Modify: `apps/web/package.json` (add `@testing-library/react`, `happy-dom` devDeps)

**Interfaces:**
- Consumes: `subscribe`, `snapshot`, `writePref` da Task 1.
- Produces: `usePersistentPref<T>(key, defaultValue) → [T, (value: T) => void]`. Usato da Task 3 (header-menu, home-client).

- [ ] **Step 1: Add test devDeps**

Run:
```bash
pnpm --filter web add -D @testing-library/react@^16 happy-dom@^12
```
Expected: pacchetti installati in `apps/web` (stesse versioni di `packages/core` per coerenza monorepo).

- [ ] **Step 2: Write failing test**

Create `apps/web/test/use-persistent-pref.test.ts`:

```ts
// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePersistentPref } from '../hooks/use-persistent-pref'

describe('usePersistentPref', () => {
	beforeEach(() => {
		window.localStorage.clear()
	})

	it('default quando localStorage vuoto', () => {
		const { result } = renderHook(() => usePersistentPref('v1', 'default'))
		expect(result.current[0]).toBe('default')
	})

	it('legge valore persistito', () => {
		window.localStorage.setItem('v2', JSON.stringify('detail-float'))
		const { result } = renderHook(() => usePersistentPref('v2', 'default'))
		expect(result.current[0]).toBe('detail-float')
	})

	it('set aggiorna valore + scrive localStorage', () => {
		const { result } = renderHook(() => usePersistentPref('v3', 'default'))
		act(() => result.current[1]('detail-float'))
		expect(result.current[0]).toBe('detail-float')
		expect(window.localStorage.getItem('v3')).toBe(JSON.stringify('detail-float'))
	})

	it('due consumer stessa chiave restano sincronizzati (cross-component)', () => {
		const a = renderHook(() => usePersistentPref('sync', 'def'))
		const b = renderHook(() => usePersistentPref('sync', 'def'))
		expect(a.result.current[0]).toBe('def')
		expect(b.result.current[0]).toBe('def')
		act(() => a.result.current[1]('changed'))
		expect(a.result.current[0]).toBe('changed')
		expect(b.result.current[0]).toBe('changed')
	})
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test`
Expected: FAIL — `Cannot find module '../hooks/use-persistent-pref'`.

- [ ] **Step 4: Write minimal implementation**

Create `apps/web/hooks/use-persistent-pref.ts`:

```ts
'use client'

import { useCallback, useSyncExternalStore } from 'react'

import { snapshot, subscribe, writePref } from '@/lib/prefs'

/**
 * Preferenza persistita in localStorage, sincronizzata cross-component
 * (same-tab via listener registry) e cross-tab (storage event). SSR-safe:
 * useSyncExternalStore usa `defaultValue` come server snapshot → nessun
 * hydration mismatch, update post-mount al valore persistito.
 *
 * T deve essere JSON-serializzabile; la cache interna (snapshot) garantisce
 * stabilità referenziale anche per oggetti. Pattern next-themes, senza
 * provider component.
 */
export function usePersistentPref<T>(key: string, defaultValue: T): [T, (value: T) => void] {
	const value = useSyncExternalStore(
		(cb) => subscribe(key, cb),
		() => snapshot(key, defaultValue),
		() => defaultValue,
	)
	const set = useCallback((value: T) => writePref(key, value), [key])
	return [value, set]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test`
Expected: PASS (tutti i test use-persistent-pref + prefs).

- [ ] **Step 6: Commit**

```bash
git add apps/web/hooks/use-persistent-pref.ts apps/web/test/use-persistent-pref.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add usePersistentPref hook via useSyncExternalStore"
```

---

### Task 3: Move `variant` from URL to localStorage

**Files:**
- Modify: `apps/web/lib/url-state.ts` (remove `variant` from `AppState`/`parseAppState`/`serializeAppState`; keep `export type Variant`)
- Modify: `apps/web/test/url-state.test.ts` (remove `variant` da expected objects + test specifici)
- Modify: `apps/web/components/shell/header-menu.tsx` (`useVariantControl` → `usePersistentPref`)
- Modify: `apps/web/app/home-client.tsx` (legge `variant` da `usePersistentPref`, sostituisce `state.variant`)

**Interfaces:**
- Consumes: `usePersistentPref` da Task 2.
- Produce: `variant` non più in URL; `AppState` senza `variant`; `Variant` type ancora esportato da `url-state.ts`.

- [ ] **Step 1: Update url-state tests (remove variant)**

In `apps/web/test/url-state.test.ts`, modifica ogni expected object rimuovendo il campo `variant` e rimuovi i test specifici di variant. Sostituisci i blocchi:

Nei `parseAppState` test, gli expected diventano (senza `variant`):
```ts
it('vuoto → default', () => {
	expect(parseAppState(new URLSearchParams())).toEqual({
		window: '24h',
		area: 'italia',
		event: null,
		t: null,
	})
})
it('valori validi passano', () => {
	expect(parseAppState(new URLSearchParams('window=7d&area=campi-flegrei&event=123'))).toEqual({
		window: '7d',
		area: 'campi-flegrei',
		event: '123',
		t: null,
	})
})
it('window/area invalidi → default; event non numerico → null', () => {
	expect(parseAppState(new URLSearchParams('window=1y&area=atlantide&event=x'))).toEqual({
		window: '24h',
		area: 'italia',
		event: null,
		t: null,
	})
})
```

Rimuovi i test `it('variant=detail-float → passa', ...)` e `it('variant invalido → default', ...)`.

Nei `serializeAppState` test, rimuovi `variant` dai base objects:
```ts
it('omette i default (URL pulito)', () => {
	expect(
		serializeAppState({
			window: '24h',
			area: 'italia',
			event: null,
			t: null,
		})
	).toBe('')
})
it('serializza solo il non-default, ordine stabile', () => {
	expect(
		serializeAppState({
			window: '90d',
			area: 'etna',
			event: '42',
			t: null,
		})
	).toBe('window=90d&area=etna&event=42')
})
```

Rimuovi il test `it('variant non-default in coda, ordine stabile', ...)`.

Nel roundtrip test e nei `t` test, rimuovi `variant` dal base object:
```ts
it('roundtrip', () => {
	const s = {
		window: '7d' as const,
		area: 'campi-flegrei',
		event: '9',
		t: null,
	}
	expect(parseAppState(new URLSearchParams(serializeAppState(s)))).toEqual(s)
})
it('serializza t in coda, omesso se null', () => {
	const base = { window: '24h', area: 'italia', event: null } as const
	expect(serializeAppState({ ...base, t: 1754130000 })).toBe('t=1754130000')
	expect(serializeAppState({ ...base, t: null })).toBe('')
	expect(serializeAppState({ ...base, window: '7d', t: 1754130000 })).toBe(
		'window=7d&t=1754130000'
	)
})
```

- [ ] **Step 2: Run url-state tests to verify they fail**

Run: `pnpm --filter web test -- url-state`
Expected: FAIL — `Expected: {...} Received: {..., variant: 'default'}` (variant ancora in impl).

- [ ] **Step 3: Remove variant from url-state.ts**

In `apps/web/lib/url-state.ts`:

Rimuovi `variant` dall'`AppState` interface:
```ts
export interface AppState {
	window: TimeWindow
	area: string
	event: string | null
	/** Cursore timeline, epoch secondi; null = live (Piano 4). */
	t: number | null
}
```

In `parseAppState`, rimuovi il blocco variant e il campo dal return:
```ts
export function parseAppState(params: URLSearchParams): AppState {
	const windowParam = params.get('window')
	const window =
		windowParam && TIME_WINDOWS.includes(windowParam as TimeWindow)
			? (windowParam as TimeWindow)
			: '24h'

	const areaParam = params.get('area')
	const area = areaParam && findAreaPreset(areaParam) ? areaParam : 'italia'

	const eventParam = params.get('event')
	const event = eventParam && /^\d+$/.test(eventParam) ? eventParam : null

	const tParam = params.get('t')
	const t = tParam && /^\d+$/.test(tParam) ? Number(tParam) : null

	return { window, area, event, t }
}
```

In `serializeAppState`, rimuovi il blocco variant:
```ts
export function serializeAppState(state: AppState): string {
	const params = new URLSearchParams()

	if (state.window !== '24h') {
		params.append('window', state.window)
	}
	if (state.area !== 'italia') {
		params.append('area', state.area)
	}
	if (state.event !== null) {
		params.append('event', state.event)
	}
	if (state.t !== null) {
		params.append('t', String(state.t))
	}

	return params.toString()
}
```

Mantieni `export type Variant = 'default' | 'detail-float'` (usato da header-menu + home-client).

- [ ] **Step 4: Run url-state tests to verify they pass**

Run: `pnpm --filter web test -- url-state`
Expected: PASS.

- [ ] **Step 5: Refactor header-menu.tsx (useVariantControl → usePersistentPref)**

In `apps/web/components/shell/header-menu.tsx`:

Aggiungi import:
```ts
import { usePersistentPref } from '@/hooks/use-persistent-pref'
```

Sostituisci il corpo di `useVariantControl` (rimuove la dipendenza da URL/router):
```ts
/**
 * Il controllo variante legge/scrive la preferenza da localStorage (non più URL):
 * è una preferenza, non una view (AGENTS.md — Scelte chiuse). Sync cross-component
 * via usePersistentPref (header-menu + home-client condividono la stessa key).
 */
function useVariantControl() {
	const [variant, setVariant] = usePersistentPref<Variant>('variant', 'default')
	return { variant, setVariant }
}
```

Rimuovi gli import ormai inutilizzati (`usePathname`, `useRouter`, `useSearchParams` da `next/navigation`, `parseAppState`, `serializeAppState` da `@/lib/url-state`) se non usati altrove nel file. Verifica con typecheck.

- [ ] **Step 6: Refactor home-client.tsx (variant da usePersistentPref)**

In `apps/web/app/home-client.tsx`:

Aggiungi import:
```ts
import { usePersistentPref } from '@/hooks/use-persistent-pref'
```

Aggiungi `type Variant` all'import da `@/lib/url-state`:
```ts
import { parseAppState, serializeAppState, type Variant } from '@/lib/url-state'
```

Dopo `const state = parseAppState(searchParams)` (e dopo `const events = useMemo(...)`), aggiungi:
```ts
// variant è una preferenza (localStorage), non più view state in URL (AGENTS.md).
const [variant] = usePersistentPref<Variant>('variant', 'default')
```

Sostituisci le due occorrenze di `state.variant` con `variant`:

Riga del `sidebarSlot`:
```ts
const sidebarSlot = variant === 'detail-float' ? listContent : listSlot
```

Riga del render di `EventDetailFloat`:
```tsx
{variant === 'detail-float' && detailNode && (
	<EventDetailFloat>{detailNode}</EventDetailFloat>
)}
```

- [ ] **Step 7: Typecheck + lint + full test**

Run:
```bash
pnpm --filter web typecheck
pnpm lint
pnpm --filter web test
```
Expected: typecheck PASS, lint 0 warnings, tutti i test PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/url-state.ts apps/web/test/url-state.test.ts apps/web/components/shell/header-menu.tsx apps/web/app/home-client.tsx
git commit -m "refactor(web): move variant from URL to localStorage preference"
```

---

### Task 4: Verifica manuale e build

**Files:** nessuno (verifica).

- [ ] **Step 1: Build di produzione**

Run:
```bash
pnpm --filter web build
```
Expected: build PASS, nessun errore.

- [ ] **Step 2: Verifica manuale (dev server)**

Run: `pnpm dev:web`, apri `http://localhost:3000`.

Verifica:
1. **Toggle variant** — apri header menu, switcha "A · sidebar" ↔ "B · float": il layout cambia (dettaglio evento in sidebar vs float su mappa) senza reload.
2. **Persistenza** — imposta "B · float", reload pagina: il layout resta "float" (preferenza letta da localStorage).
3. **Cross-tab** — apri una seconda tab sulla stessa URL, switcha variant nella tab 1: la tab 2 si aggiorna (storage event).
4. **URL pulito** — l'URL non contiene più `?variant=`. Navigando window/area/event/t l'URL resta shareable senza leakare la preferenza.
5. **SSR** — disabilita JS (o view-source): il server render mostra variant=default (nessun hydration mismatch in console).

- [ ] **Step 3: Verifica finale tooling**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm test
```
Expected: tutto PASS (monorepo intero).

- [ ] **Step 4: Commit finale (se fixup)**

Se la verifica manuale ha richiesto fix, committalii:
```bash
git add -A
git commit -m "fix(web): persistenza variant — fixup post-verifica"
```

Altrimenti nessun commit (Task 3 ha già committato il codice).

---

## Note

- **Perché non un PrefProvider component (come da scelta utente):** `useSyncExternalStore` (React 19) raggiunge lo stesso obiettivo (sync cross-component same-tab + cross-tab + SSR-safe) senza un componente provider. Risparmia il boilerplate del context + provider in `providers.tsx`. Scale alle future preferenze (basemap/stations/expert) — ognuna è una key. Se si vuole comunque il provider letterale: creare `PrefProvider` in `apps/web/app/providers.tsx` con `useState` version-counter + `useEffect` storage event, e `usePref` che legge `readPref` + re-render sul version bump. ~40 righe, più propenso a re-render non necessari (bump globale vs subscription per-key).

- **Esecuzione posticipata:** la voce future-plan dice "implementare con la prima feature che lo richiede (basemap)". Questo piano è pronto da eseguire quando basemap atterra (o ora, se si vuole chiudere il debito `variant`-in-URL prima). `variant`-alone dà poco valore utente, ma il pattern `usePersistentPref` costruito qui è la base per basemap/stations/expert.

- **Aggiornare future-plan.md dopo l'esecuzione:** marcare la voce "Persistenza stato UI" come `Stato: implementato` con riferimento a questo piano.
