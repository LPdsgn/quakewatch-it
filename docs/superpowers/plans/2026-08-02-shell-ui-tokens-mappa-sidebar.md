# Piano 2 — Shell UI: tokens, theming, mappa, sidebar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shell navigabile con dati INGV live: `packages/tokens` (SoT dark+light), theming completo (font locali, shadcn, next-themes), mappa MapLibre monocroma con epicentri, sidebar a panes (riepilogo, preset, lista, dettaglio con revisioni), stato in URL, mobile bottom sheet.

**Architecture:** I token vivono in `packages/tokens` (TS puro) e generano `theme.css` (CSS vars, `.theme-dark`/`.theme-light`) e lo stile MapLibre per entrambi i temi — un solo SoT per UI e mappa (spec §3). `apps/web` consuma: Tailwind v4 fa solo mapping, shadcn si aggancia al layer semantico, react-map-gl riceve lo stile generato. Dati via hook TanStack Query in `packages/core` (polling 60s sulla finestra live). Geometria della shell validata dal prototipo (verdetto in `apps/web/app/prototype-shell/NOTES.md`): sidebar 360px, mappa fluida, slot timeline 72px.

**Tech Stack:** packages/core esistente, packages/tokens nuovo, Next.js 16, Tailwind v4, shadcn/ui, next-themes, @tanstack/react-query v5, react-map-gl 8 + maplibre-gl **^5** (pin obbligatorio, v6 rotta — AGENTS.md), next/font/local (Inter Variable + JetBrains Mono VF, già in `apps/web/assets/fonts/`), anime.js v4 (solo se un'animazione lo richiede davvero in questo piano; il pulse si fa in CSS).

**Spec di riferimento:** `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md` (§2 layout, §3 token) · Debito ereditato: coda di `docs/superpowers/plans/2026-08-01-fondamenta-core-proxy.md`

## Global Constraints

- TypeScript `strict: true` ovunque; `noUncheckedIndexedAccess` attivo anche in apps/web (Task 1)
- **Un solo accento**: il rosso è riservato a evento selezionato/più recente, cursore/LIVE. Mai per errori (che usano `--error`, rosso smorzato distinto). "Attention is salt": una sola cosa loud per schermo
- Dark default (identità Nothing), light completo dalla v1; init da `prefers-color-scheme`, toggle manuale; classi `.theme-dark`/`.theme-light`
- Tutti i numeri (magnitudo, profondità, coordinate, orari) in `--font-mono` con `font-feature-settings: 'tnum' 1, 'zero' 1`
- Attribuzione **"INGV — Osservatorio Nazionale Terremoti"** sempre visibile; riga "Dati preliminari soggetti a revisione. Questa app non è un sistema di allerta." nel footer sidebar; copy strumentale, mai "allerta/allarme/pericolo"
- Orari API in UTC → UI in ora locale italiana; UTC esplicito nel dettaglio
- `maplibre-gl` resta `^5`; stile mappa SEMPRE generato dai token, mai hardcoded nei componenti; confini con filtro `maritime=0`; terra più chiara dell'acqua in dark (è il contrasto che disegna la costa)
- Niente API proprietarie Vercel; `lang="it"`; TDD dove c'è logica (generator, hook, url-state); verifica visiva nel browser per ogni task UI (375/768/1024/1440)
- Pre-commit hook attivo (mai `--no-verify`); commit in italiano; **mai** trailer `Co-Authored-By`
- Fine piano: `pnpm test && pnpm lint && pnpm lint:types && pnpm typecheck && pnpm format:check && pnpm --filter web build` tutti verdi

## Struttura file finale (nuovi/modificati)

```
packages/tokens/
  package.json, tsconfig.json, vitest.config.ts
  src/index.ts
  src/palette.ts            — scale grezze (neutre dark/light, primary rossa, status)
  src/semantic.ts           — THEMES: mapping semantico per theme-dark/theme-light
  src/generate-css.ts       — generateThemeCss(): string
  src/generate-map-style.ts — buildMapStyle(theme): StyleSpecification
  scripts/build-css.ts      — scrive apps/web/app/theme.css (generato, header "NON EDITARE")
  test/*.test.ts
packages/core/
  src/hooks.ts              — useEventsQuery, useEventDetailQuery (+ tipi risposta proxy)
  test/hooks.test.tsx
apps/web/
  app/layout.tsx            — font locali, next-themes, metadata QuakeWatch, lang it
  app/theme.css             — GENERATO da packages/tokens
  app/globals.css           — import tailwind + theme.css, @theme inline mapping, base
  app/page.tsx              — shell (grid) + composizione panes
  app/providers.tsx         — QueryClientProvider + ThemeProvider
  components.json           — shadcn
  components/ui/*           — shadcn generati
  components/shell/{header,summary,area-preset,event-list,event-detail,side-footer,timeline-slot}.tsx
  components/quake-map.tsx
  lib/url-state.ts          — parse/serialize di ?window&area&event
  test/url-state.test.ts
```

---

### Task 1: Riconciliazione infra (debito Piano 1 — obbligatorio prima della UI)

**Files:**
- Modify: `apps/web/tsconfig.json`, `apps/web/package.json`, `packages/core/package.json`, `package.json` (root), `oxfmt.config.ts`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
- Delete: `apps/web/README.md`, `apps/web/public/*.svg` (boilerplate), contenuto template di `app/page.tsx`

**Interfaces:**
- Produces: `pnpm typecheck` (root, ricorsivo) verde; strict completo in web; base pulita per i task successivi

- [ ] **Step 1: tsconfig di web estende la base**

`apps/web/tsconfig.json`: aggiungi `"extends": "../../tsconfig.base.json"` in testa e rimuovi le opzioni duplicate dalla base (`strict`, `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`); conserva le opzioni Next-specifiche (jsx, plugins, paths, module/moduleResolution se diverse, allowJs, incremental, noEmit, lib, target ES2017 può salire a ES2022 dalla base — verifica che Next non si lamenti).

- [ ] **Step 2: script typecheck ovunque**

- root `package.json`: `"typecheck": "pnpm -r typecheck"`
- `packages/core/package.json`: `"typecheck": "tsc --noEmit"` + devDependency `@types/node@^22`
- `apps/web/package.json`: `"typecheck": "tsc --noEmit"`, `@types/node` → `^22`, `typescript` → `^5.7.0`
- `packages/tokens` lo aggiungerà il Task 2 già conforme

- [ ] **Step 3: pulizia boilerplate**

- Elimina `apps/web/README.md`, `apps/web/public/{next.svg,vercel.svg,file.svg,globe.svg,window.svg}` (verifica con `ls` cosa c'è davvero)
- `app/layout.tsx`: `lang="it"`, metadata `title: 'QuakeWatch'`, `description: 'Monitoraggio sismico dell'Italia su dati INGV — Osservatorio Nazionale Terremoti. Dati preliminari soggetti a revisione.'` (il Task 4 lo riscrive comunque: qui basta togliere "Create Next App" e lang en)
- `app/page.tsx`: sostituisci il template con un placeholder minimo (`<main>QuakeWatch</main>`) — il Task 8 costruisce la shell vera

- [ ] **Step 4: allinea il commento di oxfmt.config.ts alla config reale**

Il commento parla di 80col/2spazi/no-semi ma la config è `printWidth: 100`, tab. Riscrivi il commento perché descriva i valori REALI correnti (leggili dal file).

- [ ] **Step 5: verifica e commit**

Run: `pnpm install && pnpm typecheck && pnpm test && pnpm lint`
Expected: tutto verde (0 errori typecheck in core e web)

```bash
git add -A && git commit -m "Riconciliazione infra: typecheck wired, strict pieno in web, boilerplate rimosso"
```

---

### Task 2: packages/tokens — palette, semantica, generator CSS

**Files:**
- Create: `packages/tokens/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/palette.ts`, `src/semantic.ts`, `src/generate-css.ts`, `scripts/build-css.ts`
- Test: `packages/tokens/test/generate-css.test.ts`

**Interfaces:**
- Produces: `ThemeName = 'theme-dark' | 'theme-light'`; `SEMANTIC_TOKENS: Record<ThemeName, Record<string, string>>` (nomi var CSS senza `--`); `generateThemeCss(): string`; script `pnpm --filter @quakewatch/tokens build:css` che scrive `apps/web/app/theme.css`
- Il Task 3 aggiunge il generator mappa nello stesso package; il Task 4 consuma `theme.css`

- [ ] **Step 1: skeleton package (come core, Task 1 del Piano 1)**

`packages/tokens/package.json`:

```json
{
	"name": "@quakewatch/tokens",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"main": "./src/index.ts",
	"types": "./src/index.ts",
	"scripts": {
		"test": "vitest run",
		"typecheck": "tsc --noEmit",
		"build:css": "node --experimental-strip-types scripts/build-css.ts"
	},
	"devDependencies": {
		"@types/node": "^22",
		"typescript": "^5.7.0",
		"vitest": "^3.0.0"
	}
}
```

(`node --experimental-strip-types` esegue TS direttamente su Node 22; se la flag desse problemi, ripiego consentito: `pnpm --filter @quakewatch/tokens exec vitest run scripts/` no — usa `npx tsx scripts/build-css.ts` aggiungendo `tsx` come devDep e annota la deviazione.)

`tsconfig.json` e `vitest.config.ts` identici per struttura a packages/core.

- [ ] **Step 2: test che falliscono**

`packages/tokens/test/generate-css.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SEMANTIC_TOKENS, THEME_NAMES, generateThemeCss } from '../src/index'

describe('SEMANTIC_TOKENS', () => {
	it('dark e light espongono esattamente gli stessi nomi (nessun token orfano)', () => {
		const dark = Object.keys(SEMANTIC_TOKENS['theme-dark']).sort()
		const light = Object.keys(SEMANTIC_TOKENS['theme-light']).sort()
		expect(dark).toEqual(light)
		expect(dark.length).toBeGreaterThanOrEqual(20)
	})

	it('include il layer semantico shadcn-compatibile e le var sidebar (spec §3)', () => {
		const required = [
			'background', 'foreground', 'card', 'card-foreground', 'popover',
			'popover-foreground', 'primary', 'primary-foreground', 'secondary',
			'secondary-foreground', 'muted', 'muted-foreground', 'accent',
			'accent-foreground', 'border', 'input', 'outline', 'error',
			'error-foreground', 'warning', 'warning-foreground', 'success',
			'success-foreground', 'sidebar-background', 'sidebar-border', 'radius',
		]
		for (const name of required) {
			expect(SEMANTIC_TOKENS['theme-dark'], name).toHaveProperty([name])
		}
	})

	it('primary è rosso in entrambi i temi ed error è distinto da primary', () => {
		for (const t of THEME_NAMES) {
			expect(SEMANTIC_TOKENS[t].primary).not.toEqual(SEMANTIC_TOKENS[t].error)
		}
	})
})

describe('generateThemeCss', () => {
	it('emette :root/.theme-dark e .theme-light con le var prefissate', () => {
		const css = generateThemeCss()
		expect(css).toContain(':root,\n.theme-dark {')
		expect(css).toContain('.theme-light {')
		expect(css).toContain('--background:')
		expect(css).toContain('--sidebar-background:')
		expect(css).toContain('NON EDITARE')
	})
})
```

- [ ] **Step 3: verifica FAIL** — `pnpm --filter @quakewatch/tokens test` → Cannot find module

- [ ] **Step 4: implementa**

`src/palette.ts` — scale grezze, struttura modello luigipdt.dev senza verde (HSL come stringhe):

```ts
/** Scale neutre: dark-900 (fondo) → dark-500 (bordi); light speculare. */
export const NEUTRAL_DARK = {
	900: 'hsl(0 0% 4%)', // sfondo app (quasi-OLED)
	850: 'hsl(0 0% 5.5%)', // ground sidebar
	800: 'hsl(0 0% 7.5%)', // card/pane
	700: 'hsl(0 0% 11%)', // popover
	600: 'hsl(0 0% 16%)', // muted
	500: 'hsl(0 0% 22%)', // border/input
} as const

export const NEUTRAL_LIGHT = {
	900: 'hsl(0 0% 96%)',
	850: 'hsl(0 0% 93%)',
	800: 'hsl(0 0% 89%)',
	700: 'hsl(0 0% 84%)',
	600: 'hsl(0 0% 77%)',
	500: 'hsl(0 0% 68%)',
} as const

/** Primary: il rosso Nothing (~355). Identico nei due temi (spec §3). */
export const RED = {
	500: 'hsl(355 85% 55%)',
	400: 'hsl(355 90% 63%)',
	600: 'hsl(355 80% 46%)',
} as const

/** Status: error è un rosso SMORZATO e distinto dal primary (vincolo spec). */
export const STATUS = {
	error: 'hsl(0 55% 42%)',
	warning: 'hsl(45 90% 50%)',
	success: 'hsl(150 40% 42%)',
	info: 'hsl(205 60% 55%)',
} as const

export const TEXT_DARK = { primary: 'hsl(0 0% 93%)', secondary: 'hsl(0 0% 54%)' } as const
export const TEXT_LIGHT = { primary: 'hsl(0 0% 7%)', secondary: 'hsl(0 0% 38%)' } as const
```

I valori esatti sono un punto di partenza calibrato sul prototipo approvato — l'implementatore NON li ridiscute in questo task; si raffinano guardando l'app (task successivi) modificando SOLO questo file.

`src/semantic.ts` — mapping per tema (chiavi = nomi var senza `--`):

```ts
import { NEUTRAL_DARK, NEUTRAL_LIGHT, RED, STATUS, TEXT_DARK, TEXT_LIGHT } from './palette'

export const THEME_NAMES = ['theme-dark', 'theme-light'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

function build(n: typeof NEUTRAL_DARK | typeof NEUTRAL_LIGHT, text: typeof TEXT_DARK) {
	return {
		background: n[900],
		foreground: text.primary,
		card: n[800],
		'card-foreground': text.primary,
		popover: n[700],
		'popover-foreground': text.primary,
		primary: RED[500],
		'primary-foreground': 'hsl(0 0% 100%)',
		secondary: n[700],
		'secondary-foreground': text.primary,
		muted: n[600],
		'muted-foreground': text.secondary,
		accent: n[600],
		'accent-foreground': text.primary,
		border: n[500],
		input: n[500],
		outline: RED[500],
		error: STATUS.error,
		'error-foreground': 'hsl(0 0% 100%)',
		warning: STATUS.warning,
		'warning-foreground': 'hsl(45 100% 15%)',
		success: STATUS.success,
		'success-foreground': 'hsl(0 0% 100%)',
		info: STATUS.info,
		'info-foreground': 'hsl(205 80% 12%)',
		'sidebar-background': n[850],
		'sidebar-border': n[500],
		radius: '0.75rem',
	}
}

export const SEMANTIC_TOKENS: Record<ThemeName, Record<string, string>> = {
	'theme-dark': build(NEUTRAL_DARK, TEXT_DARK),
	'theme-light': build(NEUTRAL_LIGHT, TEXT_LIGHT),
}
```

`src/generate-css.ts`:

```ts
import { SEMANTIC_TOKENS } from './semantic'

const vars = (t: Record<string, string>) =>
	Object.entries(t)
		.map(([k, v]) => `\t--${k}: ${v};`)
		.join('\n')

/** Emette il CSS dei temi. theme-dark è anche :root (dark default, spec §3). */
export function generateThemeCss(): string {
	return [
		'/* GENERATO da packages/tokens — NON EDITARE. `pnpm --filter @quakewatch/tokens build:css` */',
		`:root,\n.theme-dark {\n${vars(SEMANTIC_TOKENS['theme-dark'])}\n}`,
		`.theme-light {\n${vars(SEMANTIC_TOKENS['theme-light'])}\n}`,
		'',
	].join('\n\n')
}
```

`scripts/build-css.ts`:

```ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generateThemeCss } from '../src/generate-css.ts'

const out = fileURLToPath(new URL('../../../apps/web/app/theme.css', import.meta.url))
writeFileSync(out, generateThemeCss())
console.log(`scritto ${out}`)
```

`src/index.ts`: re-export di palette, semantic, generate-css (e dal Task 3 anche generate-map-style).

- [ ] **Step 5: verifica PASS + genera + commit**

Run: `pnpm install && pnpm --filter @quakewatch/tokens test && pnpm --filter @quakewatch/tokens build:css && pnpm --filter @quakewatch/tokens typecheck`
Expected: test verdi; `apps/web/app/theme.css` scritto con entrambi i temi.

```bash
git add packages/tokens apps/web/app/theme.css pnpm-lock.yaml
git commit -m "tokens: palette e semantica dark/light con generator theme.css"
```

---

### Task 3: packages/tokens — generator stile MapLibre

**Files:**
- Create: `packages/tokens/src/generate-map-style.ts`
- Test: `packages/tokens/test/generate-map-style.test.ts`
- Modify: `packages/tokens/src/index.ts`, `packages/tokens/src/palette.ts` (aggiunge MAP)

**Interfaces:**
- Consumes: `ThemeName` (Task 2)
- Produces: `buildMapStyle(theme: ThemeName): object` — style spec MapLibre v8 completo (source OpenFreeMap + layers background/water/boundary). Il Task 10 lo passa a `<Map mapStyle=...>`. NON dipende da maplibre-gl (ritorna un oggetto tipizzato localmente: il package resta senza dipendenze runtime)

- [ ] **Step 1: test che falliscono**

`packages/tokens/test/generate-map-style.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildMapStyle } from '../src/index'

describe('buildMapStyle', () => {
	it('style v8 con source openfreemap e i 4 layer base', () => {
		const s = buildMapStyle('theme-dark')
		expect(s.version).toBe(8)
		expect(s.sources.openfreemap).toEqual({
			type: 'vector',
			url: 'https://tiles.openfreemap.org/planet',
		})
		expect(s.layers.map((l) => l.id)).toEqual([
			'background', 'water', 'boundary-country', 'boundary-region',
		])
	})

	it('dark: terra più chiara dell\'acqua (regola prototipo); light diverso da dark', () => {
		const dark = buildMapStyle('theme-dark')
		const light = buildMapStyle('theme-light')
		expect(dark.layers[0]).not.toEqual(light.layers[0])
		// la lightness della terra deve superare quella dell'acqua in dark
		const land = String(dark.layers[0]?.paint?.['background-color'])
		const water = String(dark.layers[1]?.paint?.['fill-color'])
		expect(land).not.toEqual(water)
	})

	it('i confini nazionali filtrano maritime=0 (niente cerchi in mare)', () => {
		const s = buildMapStyle('theme-dark')
		const country = s.layers.find((l) => l.id === 'boundary-country')
		expect(JSON.stringify(country?.filter)).toContain('maritime')
	})
})
```

- [ ] **Step 2: verifica FAIL**

- [ ] **Step 3: implementa**

In `src/palette.ts` aggiungi i colori mappa per tema (terra > acqua in dark; in light l'inverso classico carta):

```ts
export const MAP_DARK = {
	land: 'hsl(0 0% 8.5%)',
	water: 'hsl(0 0% 4%)',
	boundaryCountry: 'rgba(255,255,255,0.28)',
	boundaryRegion: 'rgba(255,255,255,0.10)',
} as const

export const MAP_LIGHT = {
	land: 'hsl(0 0% 94%)',
	water: 'hsl(0 0% 85%)',
	boundaryCountry: 'rgba(0,0,0,0.35)',
	boundaryRegion: 'rgba(0,0,0,0.12)',
} as const
```

`src/generate-map-style.ts` — replica la struttura validata dal prototipo (tipi minimi locali, niente dipendenza da maplibre-gl):

```ts
import { MAP_DARK, MAP_LIGHT } from './palette'
import type { ThemeName } from './semantic'

interface MapLayer {
	id: string
	type: string
	source?: string
	'source-layer'?: string
	filter?: unknown[]
	paint?: Record<string, unknown>
}

export interface MapStyle {
	version: 8
	sources: Record<string, { type: string; url: string }>
	layers: MapLayer[]
}

export function buildMapStyle(theme: ThemeName): MapStyle {
	const c = theme === 'theme-dark' ? MAP_DARK : MAP_LIGHT
	return {
		version: 8,
		sources: {
			openfreemap: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
		},
		layers: [
			{ id: 'background', type: 'background', paint: { 'background-color': c.land } },
			{
				id: 'water',
				type: 'fill',
				source: 'openfreemap',
				'source-layer': 'water',
				paint: { 'fill-color': c.water },
			},
			{
				id: 'boundary-country',
				type: 'line',
				source: 'openfreemap',
				'source-layer': 'boundary',
				filter: ['all', ['==', ['get', 'admin_level'], 2], ['==', ['get', 'maritime'], 0]],
				paint: { 'line-color': c.boundaryCountry, 'line-width': 1 },
			},
			{
				id: 'boundary-region',
				type: 'line',
				source: 'openfreemap',
				'source-layer': 'boundary',
				filter: ['all', ['==', ['get', 'admin_level'], 4], ['==', ['get', 'maritime'], 0]],
				paint: { 'line-color': c.boundaryRegion, 'line-width': 1 },
			},
		],
	}
}
```

- [ ] **Step 4: verifica PASS + commit**

```bash
git add packages/tokens && git commit -m "tokens: generator stile MapLibre dark/light dai token"
```

---

### Task 4: Theming apps/web — font locali, next-themes, globals

**Files:**
- Modify: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`
- Create: `apps/web/app/providers.tsx`
- Deps: `pnpm --filter web add next-themes @tanstack/react-query`

**Interfaces:**
- Produces: `--font-sans` (Inter) e `--font-mono` (JetBrains) su `<html>`; classi tema via next-themes (`theme-dark`/`theme-light`, default system, dark come fallback); `<Providers>` che monta ThemeProvider + QueryClientProvider (il client TanStack serve dal Task 6). Il Task 8 costruisce la pagina dentro questo layout.

- [ ] **Step 1: layout con font e tema**

`apps/web/app/layout.tsx` (pattern font copiato da parla — solo la parte font):

```tsx
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'

const sans = localFont({
	src: [
		{ path: '../assets/fonts/InterVariable.woff2', weight: '100 900', style: 'normal' },
		{ path: '../assets/fonts/InterVariable-Italic.woff2', weight: '100 900', style: 'italic' },
	],
	variable: '--font-sans',
	display: 'swap',
	fallback: ['system-ui', 'sans-serif'],
})

const mono = localFont({
	src: [{ path: '../assets/fonts/JetBrains-Mono-VF.woff2', weight: '100 800', style: 'normal' }],
	variable: '--font-mono',
	display: 'swap',
	fallback: ['ui-monospace', 'Consolas', 'monospace'],
})

export const metadata: Metadata = {
	title: { default: 'QuakeWatch', template: '%s · QuakeWatch' },
	description:
		'Monitoraggio sismico dell\'Italia su dati INGV — Osservatorio Nazionale Terremoti. Dati preliminari soggetti a revisione.',
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="it" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
```

`apps/web/app/providers.tsx`:

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(() => new QueryClient())
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			value={{ dark: 'theme-dark', light: 'theme-light' }}
			enableSystem
			disableTransitionOnChange
		>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</ThemeProvider>
	)
}
```

- [ ] **Step 2: globals.css — Tailwind fa solo mapping**

`apps/web/app/globals.css` (sostituisce il contenuto scaffold):

```css
@import 'tailwindcss';
@import './theme.css';

@custom-variant dark (&:where(.theme-dark, .theme-dark *));

@theme inline {
	--font-sans: var(--font-sans);
	--font-mono: var(--font-mono);
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-accent: var(--accent);
	--color-accent-foreground: var(--accent-foreground);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-outline: var(--outline);
	--color-error: var(--error);
	--color-error-foreground: var(--error-foreground);
	--color-warning: var(--warning);
	--color-warning-foreground: var(--warning-foreground);
	--color-success: var(--success);
	--color-success-foreground: var(--success-foreground);
	--color-sidebar: var(--sidebar-background);
	--color-sidebar-border: var(--sidebar-border);
	--radius-lg: var(--radius);
	--radius-md: calc(var(--radius) - 0.125rem);
	--radius-sm: calc(var(--radius) - 0.25rem);
}

body {
	background: var(--background);
	color: var(--foreground);
	font-family: var(--font-sans);
}

/* Tutti i dati numerici: tabular + zero barrato (spec §3) */
.font-mono,
[data-numeric] {
	font-feature-settings: 'tnum' 1, 'zero' 1;
}
```

- [ ] **Step 3: verifica**

Run: `pnpm --filter web dev` → la pagina placeholder renderizza col fondo `--background` dark; cambiando il tema di sistema (o forzando la classe `.theme-light` da devtools) i colori commutano. `pnpm typecheck && pnpm --filter web build` verdi.

- [ ] **Step 4: commit** — `git add -A && git commit -m "web: theming con token generati, font locali Inter/JetBrains, next-themes"`

---

### Task 5: shadcn init sui nostri token

**Files:**
- Create: `apps/web/components.json`, `apps/web/components/ui/*` (button, tabs, scroll-area, badge, tooltip, skeleton, sonner, drawer), `apps/web/lib/utils.ts` (cn)
- Modify: `apps/web/app/globals.css` (solo se l'init lo richiede — mantenere il nostro mapping, NON far sovrascrivere theme.css)

**Interfaces:**
- Produces: componenti shadcn utilizzabili che leggono ESCLUSIVAMENTE le nostre CSS var (nessuna palette shadcn parallela). Consumati dai Task 8-12.

- [ ] **Step 1:** `pnpm dlx shadcn@latest init` in apps/web (tailwind v4, css variables, base neutral; se chiede il percorso CSS: `app/globals.css`). ATTENZIONE: se l'init inietta un blocco `:root {}` di variabili proprie in globals.css, sostituisci i valori con riferimenti alle nostre var o elimina il blocco — la SoT resta packages/tokens. Documenta nel report cosa ha generato e cosa hai tolto.
- [ ] **Step 2:** `pnpm dlx shadcn@latest add button tabs scroll-area badge tooltip skeleton sonner drawer`
- [ ] **Step 3:** verifica: una pagina temporanea o il placeholder di page.tsx con un `<Button>` e un `<Badge>` renderizzati coi nostri colori (primary rosso). `pnpm typecheck && pnpm lint` verdi. Rimuovi la prova.
- [ ] **Step 4: commit** — `git add -A && git commit -m "web: shadcn init agganciato ai token (button, tabs, scroll-area, badge, tooltip, skeleton, sonner, drawer)"`

---

### Task 6: packages/core — hook TanStack Query

**Files:**
- Create: `packages/core/src/hooks.ts`
- Test: `packages/core/test/hooks.test.tsx`
- Modify: `packages/core/src/index.ts`, `packages/core/package.json` (peerDependencies react + @tanstack/react-query; devDependencies per i test: `@tanstack/react-query`, `react`, `@testing-library/react`, `happy-dom`), `packages/core/vitest.config.ts` (environment happy-dom per i test .tsx)

**Interfaces:**
- Consumes: tipi `Earthquake`, `EventDetail`, `RevisionStatus`, `TimeWindow` (Piano 1)
- Produces:
  - `EventsResponse { events: Earthquake[]; fetchedAt: string }`
  - `EventDetailResponse { detail: EventDetail; revisionStatus: RevisionStatus; hasRevisions: boolean }`
  - `useEventsQuery(window: TimeWindow, areaId: string)` — chiama `/api/events?window=&area=`; `refetchInterval: 60_000` SOLO se `window === '24h'` (modalità live, spec §1), altrimenti nessun polling; `staleTime: 30_000`
  - `useEventDetailQuery(eventId: string | null)` — chiama `/api/events/{id}`, `enabled: eventId !== null`
- Consumati dai Task 8-11

- [ ] **Step 1: test che falliscono** (TDD sui comportamenti chiave, fetch stubbato)

`packages/core/test/hooks.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEventDetailQuery, useEventsQuery } from '../src/hooks'

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
		{children}
	</QueryClientProvider>
)

afterEach(() => vi.unstubAllGlobals())

const eventsBody = { events: [], fetchedAt: '2026-08-02T10:00:00Z' }

describe('useEventsQuery', () => {
	it('chiama il proxy con window e area e ritorna la risposta', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(eventsBody), { status: 200 }),
		)
		vi.stubGlobal('fetch', fetchMock)
		const { result } = renderHook(() => useEventsQuery('7d', 'campi-flegrei'), { wrapper })
		await waitFor(() => expect(result.current.isSuccess).toBe(true))
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/events?window=7d&area=campi-flegrei')
		expect(result.current.data?.fetchedAt).toBe(eventsBody.fetchedAt)
	})

	it('errore HTTP → isError (niente throw silenzioso)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 502 })))
		const { result } = renderHook(() => useEventsQuery('24h', 'italia'), { wrapper })
		await waitFor(() => expect(result.current.isError).toBe(true))
	})
})

describe('useEventDetailQuery', () => {
	it('eventId null → query disabilitata (nessuna fetch)', () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		const { result } = renderHook(() => useEventDetailQuery(null), { wrapper })
		expect(result.current.fetchStatus).toBe('idle')
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
```

- [ ] **Step 2: verifica FAIL** (aggiungi prima le devDeps, `environment: 'happy-dom'` nel vitest.config e `"jsx": "react-jsx"` nel tsconfig di core — senza, typecheck e collection falliscono per l'ambiente e non per il modulo)

- [ ] **Step 3: implementa**

`packages/core/src/hooks.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import type { Earthquake, EventDetail } from './types'
import type { RevisionStatus } from './revisions'
import type { TimeWindow } from './windows'

export interface EventsResponse {
	events: Earthquake[]
	fetchedAt: string
}

export interface EventDetailResponse {
	detail: EventDetail
	revisionStatus: RevisionStatus
	hasRevisions: boolean
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`proxy ${res.status}`)
	return res.json() as Promise<T>
}

/** Lista eventi. Solo la finestra 24h è "live": polling 60s allineato alla cache INGV. */
export function useEventsQuery(window: TimeWindow, areaId: string) {
	return useQuery({
		queryKey: ['events', window, areaId],
		queryFn: () => fetchJson<EventsResponse>(`/api/events?window=${window}&area=${areaId}`),
		refetchInterval: window === '24h' ? 60_000 : false,
		staleTime: 30_000,
	})
}

export function useEventDetailQuery(eventId: string | null) {
	return useQuery({
		queryKey: ['event-detail', eventId],
		queryFn: () => fetchJson<EventDetailResponse>(`/api/events/${eventId}`),
		enabled: eventId !== null,
	})
}
```

In `index.ts`: `export * from './hooks'`. Peer deps in package.json: `"peerDependencies": { "react": ">=19", "@tanstack/react-query": ">=5" }`.

Nota: gli import dei moduli non-hook di core (usati dai route handler) NON devono pagare `use client` — hooks.ts è un file separato, l'export barrel va bene perché i route handler importano funzioni pure e Next tree-shake-a; se `pnpm --filter web build` si lamentasse del barrel, spezza l'export (`@quakewatch/core/hooks`) e documenta.

- [ ] **Step 4: verifica PASS** — `pnpm --filter @quakewatch/core test && pnpm typecheck`
- [ ] **Step 5: commit** — `git add -A && git commit -m "core: hook TanStack Query per eventi (polling live 24h) e dettaglio"`

---

### Task 7: Stato URL

**Files:**
- Create: `apps/web/lib/url-state.ts`
- Test: `apps/web/test/url-state.test.ts`

**Interfaces:**
- Produces: `AppState { window: TimeWindow; area: string; event: string | null }`; `parseAppState(params: URLSearchParams): AppState` (invalidi → default `24h`/`italia`/null, area validata con `findAreaPreset`); `serializeAppState(state: AppState): string` (query string SENZA i valori default → URL puliti; ordine chiavi stabile window,area,event). Il Task 8 li collega a `useSearchParams`/`router.replace`.

- [ ] **Step 1: test che falliscono**

`apps/web/test/url-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseAppState, serializeAppState } from '../lib/url-state'

describe('parseAppState', () => {
	it('vuoto → default', () => {
		expect(parseAppState(new URLSearchParams())).toEqual({
			window: '24h', area: 'italia', event: null,
		})
	})
	it('valori validi passano', () => {
		expect(parseAppState(new URLSearchParams('window=7d&area=campi-flegrei&event=123'))).toEqual({
			window: '7d', area: 'campi-flegrei', event: '123',
		})
	})
	it('window/area invalidi → default; event non numerico → null', () => {
		expect(parseAppState(new URLSearchParams('window=1y&area=atlantide&event=x'))).toEqual({
			window: '24h', area: 'italia', event: null,
		})
	})
})

describe('serializeAppState', () => {
	it('omette i default (URL pulito)', () => {
		expect(serializeAppState({ window: '24h', area: 'italia', event: null })).toBe('')
	})
	it('serializza solo il non-default, ordine stabile', () => {
		expect(serializeAppState({ window: '90d', area: 'etna', event: '42' })).toBe(
			'window=90d&area=etna&event=42',
		)
	})
	it('roundtrip', () => {
		const s = { window: '7d' as const, area: 'campi-flegrei', event: '9' }
		expect(parseAppState(new URLSearchParams(serializeAppState(s)))).toEqual(s)
	})
})
```

- [ ] **Step 2: verifica FAIL**
- [ ] **Step 3: implementa** (funzioni pure; usa `TIME_WINDOWS`/`findAreaPreset` da core; `/^\d+$/` per event)
- [ ] **Step 4: verifica PASS + commit** — `git add -A && git commit -m "web: stato applicativo in URL (window, area, event) con default puliti"`

---

### Task 8: Shell reale — layout, header, riepilogo, preset, footer

**Files:**
- Create: `apps/web/components/shell/{header,summary,area-preset,side-footer,timeline-slot}.tsx`, `apps/web/app/home-client.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `useEventsQuery` (T6), `parseAppState`/`serializeAppState` (T7), `AREA_PRESETS` (core), componenti shadcn (T5)
- Produces: home funzionante con dati live e geometria del prototipo; `home-client.tsx` possiede lo stato (URL) e passa props tipizzate ai panes: `<Summary events={Earthquake[]} isLoading={boolean} />`, `<AreaPreset area={string} window={TimeWindow} onChange={(area, window) => void} />`, `<TimelineSlot />`. La lista (T9), la mappa (T10) e il dettaglio (T11) si innestano qui.

- [ ] **Step implementazione** — requisiti (geometria dal prototipo approvato, componenti dal design system):

- `page.tsx` server component minimale che monta `<HomeClient />` (Suspense boundary per `useSearchParams`)
- `home-client.tsx`: legge lo stato da URL (T7) con `useSearchParams`, lo scrive con `router.replace('?' + serializeAppState(...), { scroll: false })`; grid `360px 1fr` / rows `1fr 72px`, aree `sidebar map / sidebar timeline`; sotto `md` la sidebar sparisce (il T12 porta il bottom sheet — fino ad allora mobile = solo mappa, accettabile in corso di piano)
- Header pane: wordmark `QUAKEWATCH` (tracking-widest, 12px), dot LIVE rosso SOLO quando `window === '24h'` (altrimenti dot neutro), orologio `agg. HH:MM:SS` client-only (lezione prototipo: mai `Date.now()` in render SSR — stato inizializzato a `null` in un `useEffect`), **toggle tema manuale** (icona sole/luna, `setTheme` di next-themes, `aria-label` esplicito — requisito spec §3: init da sistema + toggle)
- Riepilogo pane: numero eventi, magnitudo max, profondità media — numeri grandi `--font-mono` con `data-numeric`, label 10px uppercase `--muted-foreground`; skeleton shadcn in loading
- Preset pane: segmented control (Tabs shadcn o bottoni custom sui token — scelta all'implementatore, motivarla) con `AREA_PRESETS` da core + toggle finestra `24H | 7G | 30G | 90G` mono
- Footer: `INGV — Osservatorio Nazionale Terremoti` + riga `Dati preliminari soggetti a revisione. Questa app non è un sistema di allerta.` — sempre visibile, mai troncato
- TimelineSlot: pane dot-grid con label mono `TIMELINE` — placeholder dichiarato per il Piano 3
- Empty state (0 eventi): pane dot-grid con copy neutro (`Nessun evento M≥2 negli ultimi 30 giorni` a seconda della finestra — soglia solo per 30d/90d)

- [ ] **Step verifica:** visiva nel browser (1440, 1024, 768) coi 3 preset e le 4 finestre; test esistenti + typecheck + lint verdi. **Commit:** `web: shell con header, riepilogo, preset e footer su dati live`

---

### Task 9: Lista eventi + selezione

**Files:**
- Create: `apps/web/components/shell/event-list.tsx`
- Modify: `apps/web/app/home-client.tsx`

**Interfaces:**
- Consumes: `Earthquake`, stato URL (event selezionato = `state.event`)
- Produces: `<EventList events sorted desc, selectedId, onSelect(eventId) />`; selezione scritta in URL (T7). Il T10 la sincronizza con la mappa, il T11 apre il dettaglio.

- [ ] **Step implementazione** — requisiti:

- ScrollArea shadcn, righe: magnitudo (mono 15px, `text-primary` SOLO per riga selezionata o evento più recente — disciplina accento), località (13px, truncate), tempo relativo (mono 11px, aggiornato con l'orologio del T8), profondità `X.X km` (mono 11px)
- **Deviazione documentata dalla spec §2:** nessun badge PRELIMINARE/RIVISTO nelle righe — lo stato revisioni esiste solo nel dettaglio QuakeML (un fetch per evento: insostenibile per la lista). Il badge vive nel dettaglio (T11). Aggiornare la spec con una riga in coda al task.
- Keyboard: righe focusabili (`button`), Enter seleziona; `aria-current` sulla selezionata
- Ora locale italiana nel `title` della riga (tooltip nativo)

- [ ] **Step verifica:** visiva (selezione, scroll con 79+ eventi Campi Flegrei 7g, empty state), typecheck/lint. **Commit:** `web: lista eventi con selezione in URL`

---

### Task 10: Mappa con epicentri

**Files:**
- Create: `apps/web/components/quake-map.tsx`
- Modify: `apps/web/app/home-client.tsx`, `apps/web/package.json` (già presenti react-map-gl e maplibre-gl ^5 dal prototipo — verifica)

**Interfaces:**
- Consumes: `buildMapStyle` (T3, tema da `useTheme` di next-themes — `resolvedTheme` mappato a `ThemeName`), eventi + selectedId + onSelect dal T8/T9
- Produces: `<QuakeMap events selectedId onSelect(eventId) />` — mappa theme-aware con layer epicentri

- [ ] **Step implementazione** — requisiti (anatomia validata dal prototipo, skin dai token):

- `mapStyle={useMemo(() => buildMapStyle(theme), [theme])}`; centro Italia `[12.5, 42.3]` zoom 5.3; `maxBounds` ragionevoli sull'Italia allargata (evita pan verso l'Atlantico)
- Layer circle GeoJSON: raggio `3 + magnitude * 2.2`; colore: selezionato → `RED[500]` dai token (passato via proprietà feature, MAI hardcoded hex), altri → neutro con opacity decrescente per età (1 → 0.35 oltre 12h); stroke scuro sottile
- Pulse sull'evento più recente in finestra 24h: secondo layer circle con raggio animato via `requestAnimationFrame` su feature-state (sobrio: 1 pulsazione ~2.4s, niente in `prefers-reduced-motion` — controlla `matchMedia`)
- Click su epicentro → `onSelect(eventId)` (usa `interactiveLayerIds`); selezione da lista → `flyTo` (zoom 8, `duration` dai token motion se definiti, altrimenti 800ms)
- Il GeoJSON si ricalcola SOLO su cambio eventi/selezione (useMemo) — non a ogni tick dell'orologio (lezione prototipo: niente churn di `setData`)
- Attribution control MapLibre visibile (obbligo licenza tile) — non sovrapporre il TimelineSlot

- [ ] **Step verifica:** visiva su entrambi i temi (dark E light — lo stile cambia con `resolvedTheme`), click marker↔lista sincronizzati, pulse solo su 24h, reduced-motion rispettato (emula da devtools). **Commit:** `web: mappa MapLibre theme-aware con epicentri e selezione sincronizzata`

---

### Task 11: Pannello dettaglio evento con revisioni

**Files:**
- Create: `apps/web/components/shell/event-detail.tsx`
- Modify: `apps/web/app/home-client.tsx`

**Interfaces:**
- Consumes: `useEventDetailQuery(state.event)` (T6), stato URL
- Produces: pannello che scorre sopra la lista quando `event !== null` (nella stessa colonna sidebar), back button che azzera `event` nell'URL

- [ ] **Step implementazione** — requisiti:

- Layout: stessa geometria pane; back (`←` + `Indietro`), poi: magnitudo grande mono con tipo (`Md 2.2`), badge `PRELIMINARE` (border neutro) o `RIVISTO` (border `--success`), località, tempo (locale italiana + riga UTC esplicita), coordinate mono, profondità
- Storico revisioni (se `hasRevisions`): lista origin/magnitudes con i valori precedenti in `line-through` + `--muted-foreground`, il preferito evidenziato — dati già forniti dal proxy (T12 Piano 1)
- Link `Scheda INGV ↗` a `https://terremoti.ingv.it/event/{eventId}` (`rel="noopener noreferrer" target="_blank"`)
- Stati: skeleton in loading; errore/404 con copy neutro e back funzionante (mai bloccare l'utente nel pannello)
- La riga di disclaimer dati preliminari resta visibile (footer sidebar non coperto)

- [ ] **Step verifica:** visiva con l'evento 46608102 (4 origins reali) e con un evento recentissimo (probabilmente 1 origin); deep-link diretto `/?event=46608102` apre il dettaglio al load. **Commit:** `web: dettaglio evento con storico revisioni e stato preliminare/rivisto`

---

### Task 12: Mobile — bottom sheet

**Files:**
- Create: `apps/web/components/shell/mobile-sheet.tsx`
- Modify: `apps/web/app/home-client.tsx`

**Interfaces:**
- Consumes: Drawer shadcn (vaul), tutti i panes esistenti (riusati identici dentro il sheet)
- Produces: sotto `md`: mappa full-screen + chips riepilogo in alto + Drawer con snap points `[0.18, 0.5, 0.94]` (peek: riepilogo+ultimo evento; metà: lista; full: dettaglio quando selezionato)

- [ ] **Step implementazione** — requisiti:

- Breakpoint: `md` (768px) — sopra: layout T8 invariato; sotto: sidebar nascosta, sheet montato
- I panes sono GLI STESSI componenti (nessuna versione mobile duplicata) ricomposti nel sheet
- Attribuzione INGV visibile anche mobile: resta l'attribution control della mappa + footer nel sheet
- Safe areas iOS: `viewportFit: 'cover'` già nel layout; padding con `env(safe-area-inset-bottom)` sul sheet
- TimelineSlot: su mobile una strip compatta sopra il sheet o omessa con commento — decisione visiva dell'implementatore, motivata nel report

- [ ] **Step verifica:** visiva 375×812 e 390×844 (emulazione devtools): snap points, selezione evento → sheet full col dettaglio, mappa navigabile col sheet in peek. **Commit:** `web: layout mobile con bottom sheet a snap point`

---

### Task 13: Eliminazione prototipo + verifica finale del piano

**Files:**
- Delete: `apps/web/app/prototype-shell/` (tutto: la shell reale lo sostituisce; il verdetto è già registrato nei NOTES committati nella storia e in questo piano)

- [ ] **Step 1:** `git rm -r apps/web/app/prototype-shell`
- [ ] **Step 2: suite completa**

Run: `pnpm test && pnpm lint && pnpm lint:types && pnpm typecheck && pnpm format:check && pnpm --filter web build`
Expected: tutto verde, build pulita

- [ ] **Step 3: verifica visiva finale** (playbook studio): 375/768/1024/1440, entrambi i temi, i 3 preset, le 4 finestre, selezione lista↔mappa, dettaglio con revisioni, deep-link `/?window=7d&area=campi-flegrei&event=<id>`
- [ ] **Step 4: vincoli non negoziabili** — checklist esplicita nel report: attribuzione INGV visibile (desktop E mobile), disclaimer presente, `lang="it"`, nessun lessico da allerta nel copy, badge revisioni nel dettaglio
- [ ] **Step 5: commit** — `git add -A && git commit -m "Shell Piano 2 completa; prototipo eliminato"`

---

## Aggiornamento pre-esecuzione (2026-08-02, vincolante)

L'utente ha già eseguito `shadcn init` (components.json: style **base-nova** → engine **Base UI**, iconLibrary lucide, css `app/globals.css`, alias `@/components`, `@/lib/utils`). Conseguenze sui task:

- **Task 2**: `SEMANTIC_TOKENS` emette ANCHE gli alias attesi da shadcn: `destructive` (= error), `destructive-foreground`, `ring` (= outline) e il set completo `sidebar-*` del tema base-nova (`sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`). Le `chart-1..5` (se referenziate dal CSS shadcn) ricevono valori neutri provvisori — la scala dataviz vera è Piano 3. Aggiorna il test dei token di conseguenza.
- **Task 4**: il `globals.css` dell'init si CUSTOMIZZA, non si sostituisce in blocco: mantieni gli import generati (`tw-animate-css`, `shadcn/tailwind.css`) e il blocco `@theme inline`, ma (1) `@custom-variant dark` deve puntare a `.theme-dark` (spec §3), (2) `--font-geist-mono` → il nostro `--font-mono`, (3) i VALORI delle var vengono solo da `theme.css` generato (elimina eventuali blocchi `:root`/`.dark` con valori hardcoded dell'init), (4) niente palette parallela.
- **Task 5**: l'init è GIÀ fatto — il task diventa: aggiungere i componenti richiesti (verificando i nomi nel registry base-nova), verificare che leggano i nostri token e customizzare dove serve. Il controller carica la skill `shadcn` e distilla le istruzioni rilevanti nel brief.
- **Engine Base UI**: i componenti base-nova non usano Radix — non "correggere" gli import verso Radix.

## Decisioni chiuse in stesura (non ridiscutere nei task)

- next-themes per lo switch tema (attribute class + value mapping `theme-dark`/`theme-light`)
- TanStack Query v5; polling solo su finestra 24h
- Tile: OpenFreeMap `planet` (validato dal prototipo); `maplibre-gl@^5` (AGENTS.md)
- Badge revisioni solo nel dettaglio (deviazione motivata da spec §2 — aggiornare la spec al T9)
- Spacing fluido/postcss-utopia NON in questo piano (la shell usa misure fisse validate; si introduce quando una superficie lo richiede — YAGNI, invariante studio 5)
- Tweakpane, timeline, `/evento/[id]`, `/info`, stati di resilienza avanzati → Piano 3

## Fuori scope (→ Piano 3)

Timeline + scrubber + istogramma, expert mode Tweakpane, pagine `/evento/[eventId]` SEO e `/info`, banner "dati non aggiornati"/offline detection, toast Sonner sugli errori di polling (Sonner è installato ma il wiring degli stati di resilienza è Piano 3), test-gap ereditati non toccati dai moduli di questo piano.
