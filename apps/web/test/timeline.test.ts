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
	({
		eventId: String(Math.abs(magnitude * 1000)),
		time,
		magnitude,
		latitude: 40.8,
		longitude: 14.1,
		depthKm: 2.5,
		locationName: 'Campi Flegrei',
	}) as Earthquake

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
	it('mezzanotte Roma nel giorno del cambio ora (primavera 2026)', () => {
		expect(romeDayStartMs(Date.parse('2026-03-29T12:00:00Z'))).toBe(
			Date.parse('2026-03-28T23:00:00Z')
		)
	})
	it('mezzanotte Roma nel giorno del cambio ora (autunno 2026)', () => {
		expect(romeDayStartMs(Date.parse('2026-10-25T12:00:00Z'))).toBe(
			Date.parse('2026-10-24T22:00:00Z')
		)
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
		const hit = bins.find(
			(b) =>
				b.startMs <= Date.parse('2026-08-02T11:05:00Z') &&
				Date.parse('2026-08-02T11:05:00Z') < b.endMs
		)!
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
	it('90d: bin giornalieri restano ancorati alla mezzanotte Roma attraverso il cambio ora', () => {
		const now = Date.parse('2026-04-15T12:00:00Z') // finestra 90g copre il 29 marzo
		const bins = binEvents([], '90d', now)
		for (const b of bins) expect(b.startMs).toBe(romeDayStartMs(b.startMs))
		// il giorno della transizione dura 23h
		const short = bins.find((b) => b.startMs === Date.parse('2026-03-28T23:00:00Z'))!
		expect(short.endMs - short.startMs).toBe(23 * 3_600_000)
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
