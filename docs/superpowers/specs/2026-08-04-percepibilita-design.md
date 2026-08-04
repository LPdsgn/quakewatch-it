# Filtro Percepito vs Assoluto — Design

Data: 2026-08-04 · Stato: approvato a sezioni in brainstorming

Aggiunge un filtro "Tutti / Percepiti" che permette di mostrare solo i terremoti probabilmente percepibili, distinguendoli da quelli solo strumentali. La percepibilità è stimata con la formula IPE Atkinson-Wald 2007 a partire da magnitudo e profondità — dati già disponibili per ogni evento senza fetch aggiuntive.

## 1. Funzione IPE in `packages/core`

File: `packages/core/src/shakemap.ts`

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

Due funzioni pure, zero dipendenze. Esportate via `packages/core/src/index.ts`.

## 2. Toggle nell'AreaPreset

File: `apps/web/components/shell/area-preset.tsx`

Nuove prop:
- `feltFilter: 'all' | 'felt'`
- `onFeltFilterChange: (value: 'all' | 'felt') => void`

Nella seconda riga del pane, a sinistra del controllo finestre temporali, un `TabbedControl` a due opzioni (`Tutti` / `Percepiti`). Aspetto coerente con il `TabbedControl` delle aree nella riga sopra.

Layout aggiornato del pane:

```
┌──────────────────────────────────────────┐
│ Tutta Italia | Campi Flegrei | Etna      │
│                                          │
│ Tutti | Percepiti    90G  30G  7G  24H  │
└──────────────────────────────────────────┘
```

Un tooltip sull'opzione "Percepiti" con il testo: *"Stima basata su modello IPE internazionale"*.

## 3. EventList: filtro + attenuazione

File: `apps/web/components/shell/event-list.tsx`

Nuove prop:
- `feltFilter: 'all' | 'felt'`
- `isFelt(event: Earthquake): boolean` — iniettata, `EventList` non importa la formula

Comportamento:
- **`feltFilter === 'felt'`**: mostra solo gli eventi dove `isFelt(event) === true`. Se nessun evento supera la soglia, mostra il messaggio "Nessun evento percepito" (dot-grid, stesso stile dello stato vuoto attuale).
- **`feltFilter === 'all'`**: mostra tutti. Le righe di eventi non percepibili hanno `opacity-60` sull'intero `<button>`.

## 4. Wiring in home-client.tsx

File: `apps/web/app/home-client.tsx`

- Legge `feltFilter` via `usePersistentPref<'all' | 'felt'>('feltFilter', 'all')`
- Passa `feltFilter` e `onFeltFilterChange` ad `AreaPreset`
- Calcola `visibleEvents` con il filtro percepito applicato (oltre al filtro timeline esistente)
- Passa `feltFilter` e `isFelt` (da `@quakewatch/core`) a `EventList`

`Summary` e `Strongest` vedono già `visibleEvents` filtrato — nessuna modifica aggiuntiva.

## 5. File toccati

| File | Modifica |
| :-- | :-- |
| `packages/core/src/shakemap.ts` | + `estimateEpicentralMMI`, `isFelt` |
| `packages/core/src/index.ts` | + export delle due funzioni |
| `apps/web/components/shell/area-preset.tsx` | + prop `feltFilter`/`onFeltFilterChange`, + `TabbedControl` |
| `apps/web/components/shell/event-list.tsx` | + prop `feltFilter`/`isFelt`, + filtro, + opacità |
| `apps/web/app/home-client.tsx` | + `usePersistentPref`, + wiring |

Nessuna nuova dipendenza, nessun nuovo file. Zero fetch aggiuntive.

## 6. Test

- `estimateEpicentralMMI` e `isFelt`: test unitari in `packages/core` con casi noti (Mw 6.1 a 259 km → non percepito; Md 4.7 a 2.5 km → percepito)
- `EventList`: test con `feltFilter='felt'` (filtraggio) e `'all'` (opacità condizionale)
- `prefs.test.ts`: roundtrip `feltFilter` in localStorage
