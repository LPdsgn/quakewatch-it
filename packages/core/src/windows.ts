export const TIME_WINDOWS = ['24h', '7d', '30d', '90d'] as const
export type TimeWindow = (typeof TIME_WINDOWS)[number]

const HOUR = 3_600_000
const DAY = 24 * HOUR

export const WINDOW_CONFIG: Record<
  TimeWindow,
  { durationMs: number; minMagnitude: number | null }
> = {
  '24h': { durationMs: DAY, minMagnitude: null },
  '7d': { durationMs: 7 * DAY, minMagnitude: null },
  '30d': { durationMs: 30 * DAY, minMagnitude: 2 },
  '90d': { durationMs: 90 * DAY, minMagnitude: 2 },
}

/** Formato orario FDSN: ISO senza millisecondi né suffisso Z. */
export function toFdsnTime(d: Date): string {
  return d.toISOString().slice(0, 19)
}

/** Gli orari INGV sono UTC senza Z, con eventuali microsecondi. Normalizza a ISO con Z e max ms. */
export function normalizeUtcTime(raw: string): string {
  const noZ = raw.endsWith('Z') ? raw.slice(0, -1) : raw
  const truncated = noZ.replace(/(\.\d{3})\d+$/, '$1')
  return `${truncated}Z`
}

/**
 * Range temporale canonico per una finestra: endtime quantizzato al minuto,
 * così tutti i client nello stesso minuto producono la stessa query (cache CDN condivisa).
 */
export function canonicalWindowRange(
  window: TimeWindow,
  now: Date
): { starttime: string; endtime: string } {
  const MINUTE = 60_000
  const end = Math.floor(now.getTime() / MINUTE) * MINUTE
  const start = end - WINDOW_CONFIG[window].durationMs
  return {
    starttime: toFdsnTime(new Date(start)),
    endtime: toFdsnTime(new Date(end)),
  }
}
