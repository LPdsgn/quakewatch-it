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
 * Il probe di mezzogiorno UTC individua la data civile Roma (DST-stabile), ma
 * l'offset che vale a mezzogiorno può differire da quello che vale a mezzanotte
 * dello stesso giorno nei due giorni annuali di cambio ora (switch alle 02:00
 * locali). Si genera quindi un candidato dal probe e lo si corregge ±1h finché
 * non formatta come le 00 della stessa data civile.
 */
export function romeDayStartMs(ms: number): number {
	const fmtRomeDate = (t: number) =>
		new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(t)
	const fmtRomeHour = (t: number) =>
		Number(
			new Intl.DateTimeFormat('en-GB', {
				timeZone: 'Europe/Rome',
				hour: '2-digit',
				hour12: false,
			}).format(t)
		)

	const dateStr = fmtRomeDate(ms)
	const [y, mo, d] = dateStr.split('-').map(Number) as [number, number, number]
	const noonUtc = Date.UTC(y, mo - 1, d, 12)
	const romeHour = fmtRomeHour(noonUtc)
	const candidate = Date.UTC(y, mo - 1, d) - (romeHour - 12) * 3_600_000

	for (const adjust of [0, 3_600_000, -3_600_000]) {
		const c = candidate + adjust
		if (fmtRomeDate(c) === dateStr && fmtRomeHour(c) === 0) return c
	}
	return candidate
}

function fixedStrideBins(windowStartMs: number, nowMs: number, size: number): TimelineBin[] {
	const anchor = Math.floor(windowStartMs / size) * size
	const bins: TimelineBin[] = []
	for (let start = anchor; start <= nowMs; start += size) {
		bins.push({ startMs: start, endMs: start + size, count: 0, maxClassId: null })
	}
	return bins
}

/**
 * Bin giornalieri ancorati alla mezzanotte civile Europe/Rome. Si itera coi confini
 * reali (romeDayStartMs) invece di uno stride fisso di 24h: nei giorni di cambio ora
 * il giorno civile dura 23h o 25h, uno stride fisso finirebbe per derivare rispetto
 * alla mezzanotte. Il salto di 26h atterra sempre nel giorno civile successivo (mai
 * <24h reali) qualunque sia la durata del giorno corrente.
 */
function dailyBins(windowStartMs: number, nowMs: number): TimelineBin[] {
	const boundaries = [romeDayStartMs(windowStartMs)]
	while (boundaries[boundaries.length - 1]! <= nowMs) {
		boundaries.push(romeDayStartMs(boundaries[boundaries.length - 1]! + 26 * 3_600_000))
	}
	const bins: TimelineBin[] = []
	for (let i = 0; i < boundaries.length - 1; i++) {
		bins.push({ startMs: boundaries[i]!, endMs: boundaries[i + 1]!, count: 0, maxClassId: null })
	}
	return bins
}

export function binEvents(events: Earthquake[], window: TimeWindow, nowMs: number): TimelineBin[] {
	const size = BIN_SIZE_MS[window]
	const windowStartMs = nowMs - WINDOW_CONFIG[window].durationMs
	const bins =
		window === '90d'
			? dailyBins(windowStartMs, nowMs)
			: fixedStrideBins(windowStartMs, nowMs, size)

	const maxMagPerBin: (number | null)[] = bins.map(() => null)
	for (const e of events) {
		const t = Date.parse(e.time)
		if (t < windowStartMs || t > nowMs) continue
		// finestre non giornaliere: bin di taglia fissa → indice diretto; 90d: confini
		// variabili (23h/24h/25h) → ricerca lineare, trascurabile su ~90 bin.
		const i =
			window === '90d'
				? bins.findIndex((b) => t >= b.startMs && t < b.endMs)
				: Math.floor((t - bins[0]!.startMs) / size)
		const bin = bins[i]
		if (!bin) continue
		bin.count += 1
		if (maxMagPerBin[i] == null || e.magnitude > maxMagPerBin[i]!) maxMagPerBin[i] = e.magnitude
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
