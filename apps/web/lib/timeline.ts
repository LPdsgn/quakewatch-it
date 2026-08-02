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
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Rome',
			hour: '2-digit',
			hour12: false,
		}).format(noonUtc)
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

	const maxMagPerBin: (number | null)[] = bins.map(() => null)
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
		if (m != null) bins[i]!.maxClassId = magnitudeClassOf(m).id
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
