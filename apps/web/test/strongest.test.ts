import type { Earthquake } from '@quakewatch/core'
import { describe, expect, it } from 'vitest'

import { topByMagnitude } from '../lib/strongest'

function eq(overrides: Partial<Earthquake> & Pick<Earthquake, 'eventId'>): Earthquake {
	return {
		time: '2026-08-02T10:00:00Z',
		latitude: 40.8,
		longitude: 14.1,
		depthKm: 2,
		magnitude: 1,
		magnitudeType: 'Md',
		locationName: 'Campi Flegrei',
		...overrides,
	}
}

describe('topByMagnitude', () => {
	it('ordina per magnitudo decrescente', () => {
		const events = [
			eq({ eventId: 'a', magnitude: 1.2 }),
			eq({ eventId: 'b', magnitude: 3.4 }),
			eq({ eventId: 'c', magnitude: 2.1 }),
		]
		expect(topByMagnitude(events).map((e) => e.eventId)).toEqual(['b', 'c', 'a'])
	})

	it('a parità di magnitudo, il più recente prima', () => {
		const events = [
			eq({ eventId: 'older', magnitude: 2, time: '2026-08-02T08:00:00Z' }),
			eq({ eventId: 'newer', magnitude: 2, time: '2026-08-02T09:00:00Z' }),
		]
		expect(topByMagnitude(events).map((e) => e.eventId)).toEqual(['newer', 'older'])
	})

	it('limita ai primi 4', () => {
		const events = Array.from({ length: 6 }, (_, i) => eq({ eventId: `e${i}`, magnitude: i }))
		expect(topByMagnitude(events)).toHaveLength(4)
	})

	it('array vuoto → array vuoto', () => {
		expect(topByMagnitude([])).toEqual([])
	})
})
