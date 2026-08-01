# Fondamenta: monorepo, packages/core, proxy eventi — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Data layer completo di QuakeWatch: monorepo pnpm, `packages/core` (tipi, parser FDSN text/QuakeML, dedup, revisioni, finestre canoniche) sviluppato in TDD, e proxy Next.js `/api/events` con cache CDN.

**Architecture:** Monorepo pnpm workspaces. `packages/core` è TS puro senza build step (consumato come sorgente via `transpilePackages`). `apps/web` è un Next.js App Router minimale che in questo piano espone solo i Route Handler proxy verso l'API FDSN INGV. Piano 1 di 3 (seguono: shell UI con tokens/mappa/sidebar; timeline/expert/resilienza).

**Tech Stack:** pnpm ≥ 10, Node ≥ 20, TypeScript strict, Vitest, fast-xml-parser, Zod, Next.js 15 (create-next-app), oxlint.

**Spec di riferimento:** `docs/superpowers/specs/2026-08-01-quakewatch-web-v1-design.md`

## Global Constraints

- TypeScript `strict: true` ovunque; nessun `any` non giustificato
- Proxy: solo semantica HTTP standard, **nessuna API proprietaria Vercel** (portabilità Cloudflare)
- Header cache esatto: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- Finestre: `24h` e `7d` tutte le magnitudo; `30d` e `90d` con `minmagnitude=2` (applicato dal proxy)
- Chiave di dedup: `eventId`; gli orari dell'API INGV sono **UTC senza suffisso Z** → normalizzare sempre a ISO con `Z`
- Profondità: formato text in **km**, QuakeML in **metri** (convertire /1000)
- L'API FDSN risponde **204 No Content** quando non ci sono eventi → trattare come lista vuota, non come errore
- Fixture di test prese da **risposte reali** dell'API INGV (mai inventate a mano)
- Env validate con Zod; lint con oxlint
- Commit frequenti, messaggi in italiano, **mai** trailer `Co-Authored-By`
- Base URL INGV: `https://webservices.ingv.it`

## Struttura file finale

```
package.json                      — root workspace, scripts lint/test
pnpm-workspace.yaml
tsconfig.base.json                — strict, condiviso
packages/core/
  package.json                    — @quakewatch/core, main: src/index.ts
  tsconfig.json
  vitest.config.ts
  src/index.ts                    — re-export pubblici
  src/types.ts                    — Earthquake, EventDetail, revisioni
  src/windows.ts                  — TIME_WINDOWS, WINDOW_CONFIG, canonicalWindowRange
  src/areas.ts                    — AREA_PRESETS (bbox)
  src/parse-text.ts               — parseEventsText
  src/dedup.ts                    — mergeEvents
  src/parse-quakeml.ts            — parseQuakemlEvent
  src/revisions.ts                — revisionStatus
  src/fdsn-client.ts              — buildEventsUrl, buildEventDetailUrl
  test/*.test.ts                  — un file di test per modulo
  test/fixtures/                  — risposte reali INGV (text + QuakeML)
apps/web/
  (scaffold create-next-app)
  next.config.ts                  — transpilePackages
  lib/env.ts                      — Zod env
  app/api/events/route.ts         — GET lista eventi per finestra/area
  app/api/events/[eventId]/route.ts — GET dettaglio con revisioni
  test/api-events.test.ts
  test/api-event-detail.test.ts
```

---

### Task 1: Monorepo pnpm + skeleton packages/core

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/test/smoke.test.ts`

**Interfaces:**
- Produces: workspace `@quakewatch/core` importabile; comando `pnpm --filter @quakewatch/core test`

- [ ] **Step 1: File di root del monorepo**

`package.json`:

```json
{
  "name": "quakewatch-it",
  "private": true,
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "test": "pnpm -r test",
    "lint": "oxlint ."
  },
  "devDependencies": {
    "oxlint": "^1.0.0",
    "typescript": "^5.7.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: Skeleton packages/core**

`packages/core/package.json`:

```json
{
  "name": "@quakewatch/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "test": "vitest run" },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

`packages/core/src/index.ts`:

```ts
export const CORE_VERSION = '0.0.0';
```

`packages/core/test/smoke.test.ts`:

```ts
import { expect, it } from 'vitest';
import { CORE_VERSION } from '../src/index';

it('il package core è importabile', () => {
  expect(CORE_VERSION).toBe('0.0.0');
});
```

- [ ] **Step 3: Installa e verifica**

Run: `pnpm install && pnpm --filter @quakewatch/core test`
Expected: 1 test PASS

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages/core pnpm-lock.yaml
git commit -m "Monorepo pnpm + skeleton packages/core con vitest"
```

---

### Task 2: Tipi base e finestre temporali canoniche

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/windows.ts`
- Test: `packages/core/test/windows.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `Earthquake` (tipo), `TIME_WINDOWS`, `TimeWindow`, `WINDOW_CONFIG`, `canonicalWindowRange(window: TimeWindow, now: Date): { starttime: string; endtime: string }`, `toFdsnTime(d: Date): string`, `normalizeUtcTime(raw: string): string`

- [ ] **Step 1: Scrivi i test che falliscono**

`packages/core/test/windows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  TIME_WINDOWS, WINDOW_CONFIG, canonicalWindowRange, normalizeUtcTime, toFdsnTime,
} from '../src/windows';

describe('toFdsnTime', () => {
  it('formatta ISO UTC senza millisecondi né Z (formato FDSN)', () => {
    expect(toFdsnTime(new Date('2026-08-01T10:23:45.678Z'))).toBe('2026-08-01T10:23:45');
  });
});

describe('normalizeUtcTime', () => {
  it('aggiunge Z a orari INGV senza suffisso', () => {
    expect(normalizeUtcTime('2026-08-01T10:23:45')).toBe('2026-08-01T10:23:45Z');
  });
  it('tronca i microsecondi a millisecondi', () => {
    expect(normalizeUtcTime('2026-08-01T10:23:45.123456')).toBe('2026-08-01T10:23:45.123Z');
  });
  it('non duplica la Z se già presente', () => {
    expect(normalizeUtcTime('2026-08-01T10:23:45Z')).toBe('2026-08-01T10:23:45Z');
  });
});

describe('canonicalWindowRange', () => {
  const now = new Date('2026-08-01T10:23:45.678Z');

  it('quantizza endtime al minuto (query canoniche → cache CDN condivisa)', () => {
    const { endtime } = canonicalWindowRange('24h', now);
    expect(endtime).toBe('2026-08-01T10:23:00');
  });

  it('starttime = endtime - durata finestra', () => {
    const { starttime } = canonicalWindowRange('24h', now);
    expect(starttime).toBe('2026-07-31T10:23:00');
  });

  it('due chiamate nello stesso minuto producono lo stesso range', () => {
    const a = canonicalWindowRange('7d', new Date('2026-08-01T10:23:01Z'));
    const b = canonicalWindowRange('7d', new Date('2026-08-01T10:23:59Z'));
    expect(a).toEqual(b);
  });

  it('config: 24h/7d senza soglia, 30d/90d con minMagnitude 2', () => {
    expect(TIME_WINDOWS).toEqual(['24h', '7d', '30d', '90d']);
    expect(WINDOW_CONFIG['24h'].minMagnitude).toBeNull();
    expect(WINDOW_CONFIG['7d'].minMagnitude).toBeNull();
    expect(WINDOW_CONFIG['30d'].minMagnitude).toBe(2);
    expect(WINDOW_CONFIG['90d'].minMagnitude).toBe(2);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter @quakewatch/core test`
Expected: FAIL — `Cannot find module '../src/windows'`

- [ ] **Step 3: Implementa tipi e finestre**

`packages/core/src/types.ts`:

```ts
/** Evento sismico normalizzato dal formato FDSN text. Orari sempre ISO 8601 UTC con Z. */
export interface Earthquake {
  eventId: string;
  time: string;
  latitude: number;
  longitude: number;
  /** Profondità in km (il formato text la fornisce già in km). */
  depthKm: number;
  magnitude: number;
  /** ML, Mw, Md, ... */
  magnitudeType: string;
  locationName: string;
}
```

`packages/core/src/windows.ts`:

```ts
export const TIME_WINDOWS = ['24h', '7d', '30d', '90d'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const WINDOW_CONFIG: Record<TimeWindow, { durationMs: number; minMagnitude: number | null }> = {
  '24h': { durationMs: DAY, minMagnitude: null },
  '7d': { durationMs: 7 * DAY, minMagnitude: null },
  '30d': { durationMs: 30 * DAY, minMagnitude: 2 },
  '90d': { durationMs: 90 * DAY, minMagnitude: 2 },
};

/** Formato orario FDSN: ISO senza millisecondi né suffisso Z. */
export function toFdsnTime(d: Date): string {
  return d.toISOString().slice(0, 19);
}

/** Gli orari INGV sono UTC senza Z, con eventuali microsecondi. Normalizza a ISO con Z e max ms. */
export function normalizeUtcTime(raw: string): string {
  const noZ = raw.endsWith('Z') ? raw.slice(0, -1) : raw;
  const truncated = noZ.replace(/(\.\d{3})\d+$/, '$1');
  return `${truncated}Z`;
}

/**
 * Range temporale canonico per una finestra: endtime quantizzato al minuto,
 * così tutti i client nello stesso minuto producono la stessa query (cache CDN condivisa).
 */
export function canonicalWindowRange(window: TimeWindow, now: Date): { starttime: string; endtime: string } {
  const MINUTE = 60_000;
  const end = Math.floor(now.getTime() / MINUTE) * MINUTE;
  const start = end - WINDOW_CONFIG[window].durationMs;
  return { starttime: toFdsnTime(new Date(start)), endtime: toFdsnTime(new Date(end)) };
}
```

`packages/core/src/index.ts` (sostituisci il contenuto):

```ts
export * from './types';
export * from './windows';
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter @quakewatch/core test`
Expected: PASS (tutti)

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "core: tipi Earthquake e finestre temporali canoniche"
```

---

### Task 3: Aree preset

**Files:**
- Create: `packages/core/src/areas.ts`
- Test: `packages/core/test/areas.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `AreaPreset { id: string; label: string; bbox: BoundingBox }`, `BoundingBox { minLat, maxLat, minLon, maxLon }`, `AREA_PRESETS: readonly AreaPreset[]`, `findAreaPreset(id: string): AreaPreset | undefined`

- [ ] **Step 1: Scrivi i test che falliscono**

`packages/core/test/areas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AREA_PRESETS, findAreaPreset } from '../src/areas';

describe('AREA_PRESETS', () => {
  it('include almeno Tutta Italia e Campi Flegrei', () => {
    expect(findAreaPreset('italia')?.label).toBe('Tutta Italia');
    expect(findAreaPreset('campi-flegrei')?.label).toBe('Campi Flegrei');
  });

  it('ogni bbox è coerente (min < max)', () => {
    for (const a of AREA_PRESETS) {
      expect(a.bbox.minLat).toBeLessThan(a.bbox.maxLat);
      expect(a.bbox.minLon).toBeLessThan(a.bbox.maxLon);
    }
  });

  it('id sconosciuto → undefined', () => {
    expect(findAreaPreset('atlantide')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter @quakewatch/core test`
Expected: FAIL — `Cannot find module '../src/areas'`

- [ ] **Step 3: Implementa**

`packages/core/src/areas.ts`:

```ts
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface AreaPreset {
  id: string;
  label: string;
  bbox: BoundingBox;
}

/** Lista configurabile delle aree preset (spec §2). Bbox Campi Flegrei da docs/api-web-services.md. */
export const AREA_PRESETS: readonly AreaPreset[] = [
  { id: 'italia', label: 'Tutta Italia', bbox: { minLat: 35.0, maxLat: 47.5, minLon: 6.0, maxLon: 19.0 } },
  { id: 'campi-flegrei', label: 'Campi Flegrei', bbox: { minLat: 40.75, maxLat: 40.9, minLon: 13.95, maxLon: 14.3 } },
  { id: 'etna', label: 'Etna', bbox: { minLat: 37.6, maxLat: 37.9, minLon: 14.85, maxLon: 15.25 } },
];

export function findAreaPreset(id: string): AreaPreset | undefined {
  return AREA_PRESETS.find((a) => a.id === id);
}
```

In `packages/core/src/index.ts` aggiungi:

```ts
export * from './areas';
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter @quakewatch/core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "core: aree preset con bounding box"
```

---

### Task 4: Fixture reali dall'API INGV

**Files:**
- Create: `packages/core/test/fixtures/events-sample.txt`, `packages/core/test/fixtures/events-empty.txt`, `packages/core/test/fixtures/event-detail.quakeml.xml`, `packages/core/test/fixtures/README.md`

**Interfaces:**
- Produces: fixture usate dai test dei Task 5, 7, 8, 11, 12

- [ ] **Step 1: Scarica la fixture eventi (range storico fisso → deterministico)**

```bash
curl -sG 'https://webservices.ingv.it/fdsnws/event/1/query' \
  --data-urlencode 'format=text' \
  --data-urlencode 'starttime=2026-07-20T00:00:00' \
  --data-urlencode 'endtime=2026-07-21T00:00:00' \
  --data-urlencode 'minlatitude=35.0' --data-urlencode 'maxlatitude=47.5' \
  --data-urlencode 'minlongitude=6.0' --data-urlencode 'maxlongitude=19.0' \
  --data-urlencode 'minmagnitude=2' \
  --data-urlencode 'orderby=time' \
  -o packages/core/test/fixtures/events-sample.txt
```

Verifica: il file deve iniziare con la riga header `#EventID|Time|Latitude|...` e contenere almeno 3 righe evento. Se il giorno scelto ha meno di 3 eventi M≥2, allarga il range a 3 giorni e annota il range effettivo nel README delle fixture.

- [ ] **Step 2: Crea la fixture vuota**

`packages/core/test/fixtures/events-empty.txt` — file contenente **solo** la riga header copiata da `events-sample.txt` (prima riga).

- [ ] **Step 3: Scarica la fixture QuakeML di dettaglio**

Prendi il primo `EventID` da `events-sample.txt` (prima colonna della seconda riga), poi:

```bash
curl -sG 'https://webservices.ingv.it/fdsnws/event/1/query' \
  --data-urlencode 'eventid=<EVENTID>' \
  --data-urlencode 'includeallorigins=true' \
  --data-urlencode 'includeallmagnitudes=true' \
  -o packages/core/test/fixtures/event-detail.quakeml.xml
```

Verifica: il file è XML e contiene almeno un elemento `<origin` e un `<magnitude`. Se contiene un solo `<origin`, prova gli EventID successivi finché ne trovi uno con ≥2 origin (evento rivisto: serve per testare le revisioni). Annota l'EventID scelto nel README.

- [ ] **Step 4: Documenta le fixture**

`packages/core/test/fixtures/README.md`:

```markdown
# Fixture — risposte reali API INGV

Mai modificate a mano. Per rigenerarle vedi i comandi curl nel piano
`docs/superpowers/plans/2026-08-01-fondamenta-core-proxy.md`, Task 4.

- `events-sample.txt` — eventi Italia M≥2, range <RANGE-EFFETTIVO-UTC>
- `events-empty.txt` — solo header (caso lista vuota)
- `event-detail.quakeml.xml` — eventid=<EVENTID>, con tutte le origin/magnitude (revisioni)
```

(Sostituisci i segnaposto `<...>` con i valori effettivi usati.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/test/fixtures
git commit -m "core: fixture reali API INGV (text + QuakeML con revisioni)"
```

---

### Task 5: Parser formato text FDSN

**Files:**
- Create: `packages/core/src/parse-text.ts`
- Test: `packages/core/test/parse-text.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Earthquake`, `normalizeUtcTime` (Task 2); fixture (Task 4)
- Produces: `parseEventsText(text: string): Earthquake[]`

Formato di riga INGV (pipe-separated):
`#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName`

- [ ] **Step 1: Scrivi i test che falliscono**

`packages/core/test/parse-text.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEventsText } from '../src/parse-text';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

describe('parseEventsText', () => {
  it('parsa la fixture reale in Earthquake[] validi', () => {
    const events = parseEventsText(fixture('events-sample.txt'));
    expect(events.length).toBeGreaterThanOrEqual(3);
    for (const e of events) {
      expect(e.eventId).toMatch(/\S/);
      expect(e.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/);
      expect(e.latitude).toBeGreaterThan(30);
      expect(e.longitude).toBeGreaterThan(0);
      expect(Number.isFinite(e.depthKm)).toBe(true);
      expect(e.magnitude).toBeGreaterThanOrEqual(2);
      expect(e.magnitudeType.length).toBeGreaterThan(0);
      expect(e.locationName.length).toBeGreaterThan(0);
    }
  });

  it('fixture solo header → lista vuota', () => {
    expect(parseEventsText(fixture('events-empty.txt'))).toEqual([]);
  });

  it('stringa vuota → lista vuota', () => {
    expect(parseEventsText('')).toEqual([]);
  });

  it('riga malformata (campi mancanti) viene scartata senza lanciare', () => {
    const events = parseEventsText('12345|2026-08-01T10:00:00|42.1\n');
    expect(events).toEqual([]);
  });

  it('parsa una riga sintetica nota campo per campo', () => {
    const line =
      '44125672|2026-07-20T05:31:12.940000|40.8218|14.1392|2.5|SURVEY-INGV-OV||||Md|2.2|--|Campi Flegrei\n';
    const [e] = parseEventsText(line);
    expect(e).toEqual({
      eventId: '44125672',
      time: '2026-07-20T05:31:12.940Z',
      latitude: 40.8218,
      longitude: 14.1392,
      depthKm: 2.5,
      magnitude: 2.2,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    });
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter @quakewatch/core test`
Expected: FAIL — `Cannot find module '../src/parse-text'`

- [ ] **Step 3: Implementa**

`packages/core/src/parse-text.ts`:

```ts
import type { Earthquake } from './types';
import { normalizeUtcTime } from './windows';

/**
 * Parsa il formato FDSN text (pipe-separated) in Earthquake[].
 * Righe header (#...), vuote o malformate vengono scartate silenziosamente:
 * il feed è esterno, un record rotto non deve far cadere l'intera lista.
 */
export function parseEventsText(text: string): Earthquake[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .flatMap((line) => {
      const e = parseLine(line);
      return e ? [e] : [];
    });
}

function parseLine(line: string): Earthquake | null {
  const f = line.split('|');
  if (f.length < 13) return null;
  const eq: Earthquake = {
    eventId: f[0] ?? '',
    time: normalizeUtcTime(f[1] ?? ''),
    latitude: Number(f[2]),
    longitude: Number(f[3]),
    depthKm: Number(f[4]),
    magnitudeType: f[9] ?? '',
    magnitude: Number(f[10]),
    locationName: f[12] ?? '',
  };
  if (
    eq.eventId === '' ||
    Number.isNaN(eq.latitude) ||
    Number.isNaN(eq.longitude) ||
    Number.isNaN(eq.depthKm) ||
    Number.isNaN(eq.magnitude)
  ) {
    return null;
  }
  return eq;
}
```

In `packages/core/src/index.ts` aggiungi:

```ts
export * from './parse-text';
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter @quakewatch/core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "core: parser formato FDSN text con scarto righe malformate"
```

---

### Task 6: Dedup e merge per eventId

**Files:**
- Create: `packages/core/src/dedup.ts`
- Test: `packages/core/test/dedup.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Earthquake` (Task 2)
- Produces: `mergeEvents(existing: Earthquake[], incoming: Earthquake[]): Earthquake[]` — dedup per `eventId`, il record incoming vince (è più fresco: può contenere magnitudo/localizzazione riviste), output ordinato per `time` decrescente

- [ ] **Step 1: Scrivi i test che falliscono**

`packages/core/test/dedup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeEvents } from '../src/dedup';
import type { Earthquake } from '../src/types';

const eq = (id: string, time: string, magnitude = 2): Earthquake => ({
  eventId: id, time, latitude: 42, longitude: 13, depthKm: 10,
  magnitude, magnitudeType: 'ML', locationName: 'Test',
});

describe('mergeEvents', () => {
  it('unisce liste senza duplicati per eventId', () => {
    const merged = mergeEvents(
      [eq('a', '2026-08-01T10:00:00Z')],
      [eq('b', '2026-08-01T11:00:00Z')],
    );
    expect(merged.map((e) => e.eventId)).toEqual(['b', 'a']);
  });

  it('a parità di eventId vince il record incoming (revisione più fresca)', () => {
    const merged = mergeEvents(
      [eq('a', '2026-08-01T10:00:00Z', 2.0)],
      [eq('a', '2026-08-01T10:00:00Z', 2.4)],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.magnitude).toBe(2.4);
  });

  it('ordina per time decrescente (più recente prima)', () => {
    const merged = mergeEvents(
      [eq('vecchio', '2026-08-01T08:00:00Z'), eq('nuovo', '2026-08-01T12:00:00Z')],
      [eq('medio', '2026-08-01T10:00:00Z')],
    );
    expect(merged.map((e) => e.eventId)).toEqual(['nuovo', 'medio', 'vecchio']);
  });

  it('liste vuote → lista vuota', () => {
    expect(mergeEvents([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter @quakewatch/core test`
Expected: FAIL — `Cannot find module '../src/dedup'`

- [ ] **Step 3: Implementa**

`packages/core/src/dedup.ts`:

```ts
import type { Earthquake } from './types';

/**
 * Unione con dedup per eventId (finestra di polling sovrapposta, spec §1).
 * Il record incoming sostituisce l'esistente: le risposte più fresche
 * possono contenere parametri rivisti. Output: time decrescente.
 */
export function mergeEvents(existing: Earthquake[], incoming: Earthquake[]): Earthquake[] {
  const byId = new Map(existing.map((e) => [e.eventId, e]));
  for (const e of incoming) byId.set(e.eventId, e);
  return [...byId.values()].sort((a, b) => b.time.localeCompare(a.time));
}
```

In `packages/core/src/index.ts` aggiungi:

```ts
export * from './dedup';
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter @quakewatch/core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "core: merge eventi con dedup per eventId"
```

---

### Task 7: Parser QuakeML per il dettaglio evento

**Files:**
- Create: `packages/core/src/parse-quakeml.ts`
- Test: `packages/core/test/parse-quakeml.test.ts`
- Modify: `packages/core/src/types.ts`, `packages/core/src/index.ts`, `packages/core/package.json` (dipendenza fast-xml-parser)

**Interfaces:**
- Consumes: `normalizeUtcTime` (Task 2); fixture QuakeML (Task 4)
- Produces:
  - `OriginRevision { publicId: string; time: string; latitude: number; longitude: number; depthKm: number; evaluationMode: 'manual' | 'automatic' | null }`
  - `MagnitudeRevision { publicId: string; value: number; type: string }`
  - `EventDetail { eventId: string; locationName: string; preferredOrigin: OriginRevision; preferredMagnitude: MagnitudeRevision; origins: OriginRevision[]; magnitudes: MagnitudeRevision[] }`
  - `parseQuakemlEvent(xml: string): EventDetail | null`

- [ ] **Step 1: Aggiungi la dipendenza**

Run: `pnpm --filter @quakewatch/core add fast-xml-parser`

- [ ] **Step 2: Scrivi i test che falliscono**

`packages/core/test/parse-quakeml.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseQuakemlEvent } from '../src/parse-quakeml';

const xml = readFileSync(
  fileURLToPath(new URL('./fixtures/event-detail.quakeml.xml', import.meta.url)),
  'utf8',
);

describe('parseQuakemlEvent', () => {
  it('estrae il dettaglio con tutte le revisioni dalla fixture reale', () => {
    const d = parseQuakemlEvent(xml);
    expect(d).not.toBeNull();
    if (!d) return;
    expect(d.eventId).toMatch(/^\d+$/);
    expect(d.origins.length).toBeGreaterThanOrEqual(2); // fixture scelta con revisioni
    expect(d.magnitudes.length).toBeGreaterThanOrEqual(1);
    expect(d.origins.map((o) => o.publicId)).toContain(d.preferredOrigin.publicId);
    expect(d.magnitudes.map((m) => m.publicId)).toContain(d.preferredMagnitude.publicId);
    // profondità QuakeML in metri → convertita in km: per l'Italia sempre < 700 km
    expect(d.preferredOrigin.depthKm).toBeGreaterThan(0);
    expect(d.preferredOrigin.depthKm).toBeLessThan(700);
    expect(d.preferredOrigin.time).toMatch(/Z$/);
    expect(d.locationName.length).toBeGreaterThan(0);
  });

  it('XML non QuakeML → null', () => {
    expect(parseQuakemlEvent('<html></html>')).toBeNull();
  });

  it('stringa vuota → null', () => {
    expect(parseQuakemlEvent('')).toBeNull();
  });
});
```

- [ ] **Step 3: Verifica che falliscano**

Run: `pnpm --filter @quakewatch/core test`
Expected: FAIL — `Cannot find module '../src/parse-quakeml'`

- [ ] **Step 4: Implementa**

Aggiungi in `packages/core/src/types.ts`:

```ts
/** Una localizzazione dell'evento (l'API ne restituisce più d'una se rivisto). */
export interface OriginRevision {
  publicId: string;
  time: string;
  latitude: number;
  longitude: number;
  /** In km (QuakeML fornisce metri: conversione nel parser). */
  depthKm: number;
  evaluationMode: 'manual' | 'automatic' | null;
}

/** Una stima di magnitudo (più d'una se rivista). */
export interface MagnitudeRevision {
  publicId: string;
  value: number;
  type: string;
}

/** Dettaglio evento con storico revisioni (spec §2, dettaglio evento). */
export interface EventDetail {
  eventId: string;
  locationName: string;
  preferredOrigin: OriginRevision;
  preferredMagnitude: MagnitudeRevision;
  origins: OriginRevision[];
  magnitudes: MagnitudeRevision[];
}
```

`packages/core/src/parse-quakeml.ts`:

```ts
import { XMLParser } from 'fast-xml-parser';
import type { EventDetail, MagnitudeRevision, OriginRevision } from './types';
import { normalizeUtcTime } from './windows';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  isArray: (name) => name === 'event' || name === 'origin' || name === 'magnitude',
});

/** Estrae l'eventId numerico da un publicID INGV (es. "...?eventId=44125672"). */
function extractEventId(publicId: string): string {
  const m = /eventid=(\d+)/i.exec(publicId);
  return m?.[1] ?? publicId;
}

export function parseQuakemlEvent(xml: string): EventDetail | null {
  if (xml.trim() === '') return null;
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- struttura XML esterna, validata campo per campo
  const ev = (doc as any)?.quakeml?.eventParameters?.event?.[0];
  if (!ev) return null;

  const origins: OriginRevision[] = (ev.origin ?? []).map((o: any): OriginRevision => ({
    publicId: String(o['@_publicID'] ?? ''),
    time: normalizeUtcTime(String(o.time?.value ?? '')),
    latitude: Number(o.latitude?.value),
    longitude: Number(o.longitude?.value),
    depthKm: Number(o.depth?.value) / 1000,
    evaluationMode:
      o.evaluationMode === 'manual' || o.evaluationMode === 'automatic' ? o.evaluationMode : null,
  }));

  const magnitudes: MagnitudeRevision[] = (ev.magnitude ?? []).map((m: any): MagnitudeRevision => ({
    publicId: String(m['@_publicID'] ?? ''),
    value: Number(m.mag?.value),
    type: String(m.type ?? ''),
  }));

  if (origins.length === 0 || magnitudes.length === 0) return null;

  const preferredOrigin =
    origins.find((o) => o.publicId === ev.preferredOriginID) ?? origins[origins.length - 1]!;
  const preferredMagnitude =
    magnitudes.find((m) => m.publicId === ev.preferredMagnitudeID) ?? magnitudes[magnitudes.length - 1]!;

  return {
    eventId: extractEventId(String(ev['@_publicID'] ?? '')),
    locationName: String(ev.description?.text ?? ''),
    preferredOrigin,
    preferredMagnitude,
    origins,
    magnitudes,
  };
}
```

In `packages/core/src/index.ts` aggiungi:

```ts
export * from './parse-quakeml';
```

**Nota per l'implementatore:** la struttura reale del QuakeML INGV va verificata contro la fixture (nomi elemento dopo `removeNSPrefix`, presenza di `preferredOriginID`). Se un'asserzione fallisce, ispeziona la fixture e adatta il parser — non la fixture.

- [ ] **Step 5: Verifica che passino**

Run: `pnpm --filter @quakewatch/core test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "core: parser QuakeML con storico revisioni origin/magnitude"
```

---

### Task 8: Logica revisioni (preliminare/rivisto)

**Files:**
- Create: `packages/core/src/revisions.ts`
- Test: `packages/core/test/revisions.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `EventDetail`, `OriginRevision`, `MagnitudeRevision` (Task 7)
- Produces: `RevisionStatus = 'preliminare' | 'rivisto'`, `revisionStatus(detail: EventDetail): RevisionStatus`, `hasRevisions(detail: EventDetail): boolean`

- [ ] **Step 1: Scrivi i test che falliscono**

`packages/core/test/revisions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hasRevisions, revisionStatus } from '../src/revisions';
import type { EventDetail, MagnitudeRevision, OriginRevision } from '../src/types';

const origin = (id: string, mode: OriginRevision['evaluationMode']): OriginRevision => ({
  publicId: id, time: '2026-08-01T10:00:00Z', latitude: 42, longitude: 13,
  depthKm: 10, evaluationMode: mode,
});
const mag = (id: string, value: number): MagnitudeRevision => ({ publicId: id, value, type: 'ML' });

const detail = (origins: OriginRevision[], magnitudes: MagnitudeRevision[]): EventDetail => ({
  eventId: 'x', locationName: 'Test',
  preferredOrigin: origins[origins.length - 1]!,
  preferredMagnitude: magnitudes[magnitudes.length - 1]!,
  origins, magnitudes,
});

describe('revisionStatus', () => {
  it('origin preferita manuale → rivisto', () => {
    expect(revisionStatus(detail([origin('a', 'automatic'), origin('b', 'manual')], [mag('m', 2)])).toBe('rivisto');
  });

  it('origin preferita automatica → preliminare', () => {
    expect(revisionStatus(detail([origin('a', 'automatic')], [mag('m', 2)])).toBe('preliminare');
  });

  it('evaluationMode assente → preliminare (prudenza)', () => {
    expect(revisionStatus(detail([origin('a', null)], [mag('m', 2)])).toBe('preliminare');
  });
});

describe('hasRevisions', () => {
  it('true con più di una origin o magnitudo', () => {
    expect(hasRevisions(detail([origin('a', null), origin('b', null)], [mag('m', 2)]))).toBe(true);
    expect(hasRevisions(detail([origin('a', null)], [mag('m', 2), mag('n', 2.2)]))).toBe(true);
  });

  it('false con una sola origin e una sola magnitudo', () => {
    expect(hasRevisions(detail([origin('a', null)], [mag('m', 2)]))).toBe(false);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter @quakewatch/core test`
Expected: FAIL — `Cannot find module '../src/revisions'`

- [ ] **Step 3: Implementa**

`packages/core/src/revisions.ts`:

```ts
import type { EventDetail } from './types';

export type RevisionStatus = 'preliminare' | 'rivisto';

/**
 * Un evento è "rivisto" solo se la localizzazione preferita è stata
 * valutata manualmente da un sismologo. In ogni altro caso (automatica
 * o non dichiarata) resta "preliminare": mai sovrastimare l'affidabilità.
 */
export function revisionStatus(detail: EventDetail): RevisionStatus {
  return detail.preferredOrigin.evaluationMode === 'manual' ? 'rivisto' : 'preliminare';
}

/** True se l'evento ha uno storico di revisioni da mostrare (spec §2, dettaglio). */
export function hasRevisions(detail: EventDetail): boolean {
  return detail.origins.length > 1 || detail.magnitudes.length > 1;
}
```

In `packages/core/src/index.ts` aggiungi:

```ts
export * from './revisions';
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter @quakewatch/core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "core: stato revisioni preliminare/rivisto da evaluationMode"
```

---

### Task 9: URL builder FDSN

**Files:**
- Create: `packages/core/src/fdsn-client.ts`
- Test: `packages/core/test/fdsn-client.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `TimeWindow`, `WINDOW_CONFIG`, `canonicalWindowRange` (Task 2); `AreaPreset` (Task 3)
- Produces: `buildEventsUrl(baseUrl: string, window: TimeWindow, area: AreaPreset, now: Date): URL`, `buildEventDetailUrl(baseUrl: string, eventId: string): URL`

- [ ] **Step 1: Scrivi i test che falliscono**

`packages/core/test/fdsn-client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findAreaPreset } from '../src/areas';
import { buildEventDetailUrl, buildEventsUrl } from '../src/fdsn-client';

const BASE = 'https://webservices.ingv.it';
const now = new Date('2026-08-01T10:23:45Z');
const italia = findAreaPreset('italia')!;

describe('buildEventsUrl', () => {
  it('costruisce la query canonica per la finestra 24h', () => {
    const url = buildEventsUrl(BASE, '24h', italia, now);
    expect(url.origin + url.pathname).toBe(`${BASE}/fdsnws/event/1/query`);
    const p = url.searchParams;
    expect(p.get('format')).toBe('text');
    expect(p.get('orderby')).toBe('time');
    expect(p.get('starttime')).toBe('2026-07-31T10:23:00');
    expect(p.get('endtime')).toBe('2026-08-01T10:23:00');
    expect(p.get('minlatitude')).toBe('35');
    expect(p.get('maxlatitude')).toBe('47.5');
    expect(p.get('minlongitude')).toBe('6');
    expect(p.get('maxlongitude')).toBe('19');
    expect(p.get('minmagnitude')).toBeNull(); // 24h: tutte le magnitudo
  });

  it('applica minmagnitude=2 alle finestre lunghe', () => {
    expect(buildEventsUrl(BASE, '30d', italia, now).searchParams.get('minmagnitude')).toBe('2');
    expect(buildEventsUrl(BASE, '90d', italia, now).searchParams.get('minmagnitude')).toBe('2');
  });

  it('stesso minuto → stessa URL (chiave di cache condivisa)', () => {
    const a = buildEventsUrl(BASE, '7d', italia, new Date('2026-08-01T10:23:05Z'));
    const b = buildEventsUrl(BASE, '7d', italia, new Date('2026-08-01T10:23:55Z'));
    expect(a.toString()).toBe(b.toString());
  });
});

describe('buildEventDetailUrl', () => {
  it('richiede QuakeML con tutte le revisioni', () => {
    const url = buildEventDetailUrl(BASE, '44125672');
    const p = url.searchParams;
    expect(p.get('eventid')).toBe('44125672');
    expect(p.get('includeallorigins')).toBe('true');
    expect(p.get('includeallmagnitudes')).toBe('true');
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter @quakewatch/core test`
Expected: FAIL — `Cannot find module '../src/fdsn-client'`

- [ ] **Step 3: Implementa**

`packages/core/src/fdsn-client.ts`:

```ts
import type { AreaPreset } from './areas';
import type { TimeWindow } from './windows';
import { WINDOW_CONFIG, canonicalWindowRange } from './windows';

const EVENT_PATH = '/fdsnws/event/1/query';

/** URL canonica per la lista eventi di una finestra/area (stessa URL nello stesso minuto). */
export function buildEventsUrl(baseUrl: string, window: TimeWindow, area: AreaPreset, now: Date): URL {
  const url = new URL(EVENT_PATH, baseUrl);
  const { starttime, endtime } = canonicalWindowRange(window, now);
  url.searchParams.set('format', 'text');
  url.searchParams.set('orderby', 'time');
  url.searchParams.set('starttime', starttime);
  url.searchParams.set('endtime', endtime);
  url.searchParams.set('minlatitude', String(area.bbox.minLat));
  url.searchParams.set('maxlatitude', String(area.bbox.maxLat));
  url.searchParams.set('minlongitude', String(area.bbox.minLon));
  url.searchParams.set('maxlongitude', String(area.bbox.maxLon));
  const { minMagnitude } = WINDOW_CONFIG[window];
  if (minMagnitude !== null) url.searchParams.set('minmagnitude', String(minMagnitude));
  return url;
}

/** URL del dettaglio evento in QuakeML con l'intero storico revisioni. */
export function buildEventDetailUrl(baseUrl: string, eventId: string): URL {
  const url = new URL(EVENT_PATH, baseUrl);
  url.searchParams.set('eventid', eventId);
  url.searchParams.set('includeallorigins', 'true');
  url.searchParams.set('includeallmagnitudes', 'true');
  return url;
}
```

In `packages/core/src/index.ts` aggiungi:

```ts
export * from './fdsn-client';
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter @quakewatch/core test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "core: URL builder FDSN con query canoniche"
```

---

### Task 10: Scaffold apps/web + validazione env

**Files:**
- Create: `apps/web/` (scaffold create-next-app), `apps/web/lib/env.ts`, `apps/web/vitest.config.ts`, `apps/web/test/env.test.ts`
- Modify: `apps/web/next.config.ts`, `apps/web/package.json`

**Interfaces:**
- Consumes: workspace `@quakewatch/core` (Task 1–9)
- Produces: `env` object `{ INGV_BASE_URL: string }` da `apps/web/lib/env.ts`; app Next.js avviabile con `pnpm --filter web dev`

- [ ] **Step 1: Scaffold Next.js**

```bash
pnpm create next-app@latest apps/web --typescript --app --tailwind --no-eslint --no-src-dir --import-alias "@/*" --turbopack --yes
```

Poi in `apps/web/package.json`: imposta `"name": "web"`, rimuovi eventuali campi `eslint`, e aggiungi le dipendenze workspace e di test:

```bash
pnpm --filter web add '@quakewatch/core@workspace:*' 'zod@^3'
pnpm --filter web add -D vitest
```

(Tailwind incluso ora per non rifare lo scaffold nel Piano 2 — in questo piano non si tocca la UI.)

- [ ] **Step 2: Configura transpile del core e script test**

`apps/web/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@quakewatch/core'],
};

export default nextConfig;
```

In `apps/web/package.json` aggiungi lo script:

```json
"test": "vitest run"
```

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 3: Scrivi il test env che fallisce**

`apps/web/test/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { env } from '../lib/env';

describe('env', () => {
  it('INGV_BASE_URL ha un default valido', () => {
    expect(env.INGV_BASE_URL).toBe('https://webservices.ingv.it');
  });
});
```

Run: `pnpm --filter web test`
Expected: FAIL — `Cannot find module '../lib/env'`

- [ ] **Step 4: Implementa la validazione env**

`apps/web/lib/env.ts`:

```ts
import { z } from 'zod';

const schema = z.object({
  INGV_BASE_URL: z.string().url().default('https://webservices.ingv.it'),
});

/** Env validate al primo import: config rotta = crash all'avvio, non in produzione. */
export const env = schema.parse({
  INGV_BASE_URL: process.env.INGV_BASE_URL,
});
```

- [ ] **Step 5: Verifica test e avvio**

Run: `pnpm --filter web test`
Expected: PASS

Run: `pnpm --filter web dev` (poi interrompi)
Expected: server avviato senza errori su http://localhost:3000

- [ ] **Step 6: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "web: scaffold Next.js con core transpilato e env Zod"
```

---

### Task 11: Route handler GET /api/events

**Files:**
- Create: `apps/web/app/api/events/route.ts`
- Test: `apps/web/test/api-events.test.ts`

**Interfaces:**
- Consumes: `parseEventsText`, `buildEventsUrl`, `findAreaPreset`, `TIME_WINDOWS`, `TimeWindow` da `@quakewatch/core`; `env` (Task 10)
- Produces: `GET /api/events?window=24h|7d|30d|90d&area=<presetId>` → `200 { events: Earthquake[], fetchedAt: string }` con header cache; `400` su parametri invalidi; `502 { error }` su guasto upstream. Contratto consumato dal client TanStack Query nel Piano 2.

- [ ] **Step 1: Scrivi i test che falliscono**

`apps/web/test/api-events.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../app/api/events/route';

const fixtureText = readFileSync(
  fileURLToPath(new URL('../../../packages/core/test/fixtures/events-sample.txt', import.meta.url)),
  'utf8',
);

const req = (qs: string) => new Request(`http://localhost/api/events${qs}`);

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/events', () => {
  it('200: eventi parsati + header cache esatto (spec §1)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fixtureText, { status: 200 })));
    const res = await GET(req('?window=24h&area=italia'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    const body = await res.json();
    expect(body.events.length).toBeGreaterThanOrEqual(3);
    expect(body.events[0]).toHaveProperty('eventId');
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('default: window=24h, area=italia', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(fixtureText, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await GET(req(''));
    expect(res.status).toBe(200);
    const upstream = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(upstream.searchParams.get('minmagnitude')).toBeNull();
  });

  it('204 upstream (nessun evento) → 200 con lista vuota', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const res = await GET(req('?window=24h'));
    expect(res.status).toBe(200);
    expect((await res.json()).events).toEqual([]);
  });

  it('400 su window sconosciuta', async () => {
    const res = await GET(req('?window=1y'));
    expect(res.status).toBe(400);
  });

  it('400 su area sconosciuta', async () => {
    const res = await GET(req('?area=atlantide'));
    expect(res.status).toBe(400);
  });

  it('502 su errore upstream, senza header di cache pubblica', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    const res = await GET(req('?window=24h'));
    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('502 su fetch che lancia (rete giù)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const res = await GET(req('?window=24h'));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter web test`
Expected: FAIL — `Cannot find module '../app/api/events/route'`

- [ ] **Step 3: Implementa**

`apps/web/app/api/events/route.ts`:

```ts
import {
  TIME_WINDOWS, type TimeWindow, buildEventsUrl, findAreaPreset, parseEventsText,
} from '@quakewatch/core';
import { env } from '@/lib/env';

const CACHE_OK = 'public, s-maxage=60, stale-while-revalidate=300';

function isTimeWindow(v: string): v is TimeWindow {
  return (TIME_WINDOWS as readonly string[]).includes(v);
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const window = params.get('window') ?? '24h';
  const areaId = params.get('area') ?? 'italia';

  if (!isTimeWindow(window)) {
    return Response.json({ error: `window non valida: ${window}` }, { status: 400 });
  }
  const area = findAreaPreset(areaId);
  if (!area) {
    return Response.json({ error: `area non valida: ${areaId}` }, { status: 400 });
  }

  const upstream = buildEventsUrl(env.INGV_BASE_URL, window, area, new Date());
  let res: Response;
  try {
    res = await fetch(upstream);
  } catch {
    return Response.json(
      { error: 'INGV non raggiungibile' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // FDSN: 204 = nessun evento nel range, non è un errore
  if (res.status === 204) {
    return Response.json(
      { events: [], fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': CACHE_OK } },
    );
  }
  if (!res.ok) {
    return Response.json(
      { error: `INGV ha risposto ${res.status}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const events = parseEventsText(await res.text());
  return Response.json(
    { events, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter web test`
Expected: PASS (tutti)

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "web: proxy /api/events con query canoniche e cache CDN"
```

---

### Task 12: Route handler GET /api/events/[eventId]

**Files:**
- Create: `apps/web/app/api/events/[eventId]/route.ts`
- Test: `apps/web/test/api-event-detail.test.ts`

**Interfaces:**
- Consumes: `parseQuakemlEvent`, `buildEventDetailUrl`, `revisionStatus`, `hasRevisions` da `@quakewatch/core`; `env` (Task 10)
- Produces: `GET /api/events/:eventId` → `200 { detail: EventDetail, revisionStatus: 'preliminare'|'rivisto', hasRevisions: boolean }` con header cache; `400` su id non numerico; `404` se l'evento non esiste; `502` su guasto upstream. Contratto consumato dal pannello dettaglio nel Piano 2.

- [ ] **Step 1: Scrivi i test che falliscono**

`apps/web/test/api-event-detail.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../app/api/events/[eventId]/route';

const fixtureXml = readFileSync(
  fileURLToPath(new URL('../../../packages/core/test/fixtures/event-detail.quakeml.xml', import.meta.url)),
  'utf8',
);

const call = (eventId: string) =>
  GET(new Request(`http://localhost/api/events/${eventId}`), {
    params: Promise.resolve({ eventId }),
  });

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/events/[eventId]', () => {
  it('200: dettaglio con stato revisioni e header cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fixtureXml, { status: 200 })));
    const res = await call('44125672');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    const body = await res.json();
    expect(body.detail.origins.length).toBeGreaterThanOrEqual(2);
    expect(['preliminare', 'rivisto']).toContain(body.revisionStatus);
    expect(typeof body.hasRevisions).toBe('boolean');
  });

  it('400 su eventId non numerico', async () => {
    const res = await call('DROP-TABLE');
    expect(res.status).toBe(400);
  });

  it('404 se INGV non trova l’evento (204/404 upstream)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const res = await call('999999999');
    expect(res.status).toBe(404);
  });

  it('502 su errore upstream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    const res = await call('44125672');
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm --filter web test`
Expected: FAIL — `Cannot find module '../app/api/events/[eventId]/route'`

- [ ] **Step 3: Implementa**

`apps/web/app/api/events/[eventId]/route.ts`:

```ts
import {
  buildEventDetailUrl, hasRevisions, parseQuakemlEvent, revisionStatus,
} from '@quakewatch/core';
import { env } from '@/lib/env';

const CACHE_OK = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  const { eventId } = await params;
  if (!/^\d+$/.test(eventId)) {
    return Response.json({ error: 'eventId non valido' }, { status: 400 });
  }

  const upstream = buildEventDetailUrl(env.INGV_BASE_URL, eventId);
  let res: Response;
  try {
    res = await fetch(upstream);
  } catch {
    return Response.json(
      { error: 'INGV non raggiungibile' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (res.status === 204 || res.status === 404) {
    return Response.json({ error: 'evento non trovato' }, { status: 404 });
  }
  if (!res.ok) {
    return Response.json(
      { error: `INGV ha risposto ${res.status}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const detail = parseQuakemlEvent(await res.text());
  if (!detail) {
    return Response.json({ error: 'risposta INGV non interpretabile' }, { status: 502 });
  }

  return Response.json(
    { detail, revisionStatus: revisionStatus(detail), hasRevisions: hasRevisions(detail) },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}
```

- [ ] **Step 4: Verifica che passino**

Run: `pnpm --filter web test`
Expected: PASS (tutti)

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "web: proxy dettaglio evento con stato revisioni"
```

---

### Task 13: Verifica end-to-end contro l'API reale + lint

**Files:**
- Modify: nessuno (verifica); eventuali fix minori emersi

- [ ] **Step 1: Suite completa e lint**

Run: `pnpm test && pnpm lint`
Expected: tutti i test PASS, lint pulito (correggi eventuali segnalazioni oxlint prima di procedere)

- [ ] **Step 2: Avvia e interroga il proxy contro INGV reale**

```bash
pnpm --filter web dev &
sleep 5
curl -s 'http://localhost:3000/api/events?window=24h&area=italia' | head -c 600
curl -s 'http://localhost:3000/api/events?window=90d&area=campi-flegrei' | head -c 600
```

Expected: JSON con `events` (array, anche vuoto) e `fetchedAt`; nessun 5xx. Poi prendi un `eventId` dalla risposta e:

```bash
curl -s 'http://localhost:3000/api/events/<EVENTID>' | head -c 600
```

Expected: JSON con `detail`, `revisionStatus`, `hasRevisions`. Ferma il dev server.

- [ ] **Step 3: Verifica header di cache dal vivo**

```bash
curl -sI 'http://localhost:3000/api/events?window=24h' | grep -i cache-control
```

Expected: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

- [ ] **Step 4: Commit finale (se ci sono stati fix)**

```bash
git add -A
git commit -m "Fondamenta: verifica end-to-end proxy contro API INGV"
```

---

## Fuori scope di questo piano (→ Piani 2 e 3)

`packages/tokens` e theming, UI (mappa, sidebar, timeline, expert panel), pagine `/evento/[id]` e `/info`, polling client TanStack Query, deploy Vercel. Il contratto JSON dei due endpoint (`Interfaces` dei Task 11–12) è l'input del Piano 2.
