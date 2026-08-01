import { describe, expect, it } from 'vitest'

import { mergeEvents } from '../src/dedup'
import type { Earthquake } from '../src/types'

const eq = (id: string, time: string, magnitude = 2): Earthquake => ({
	eventId: id,
	time,
	latitude: 42,
	longitude: 13,
	depthKm: 10,
	magnitude,
	magnitudeType: 'ML',
	locationName: 'Test',
})

describe('mergeEvents', () => {
	it('unisce liste senza duplicati per eventId', () => {
		const merged = mergeEvents(
			[eq('a', '2026-08-01T10:00:00Z')],
			[eq('b', '2026-08-01T11:00:00Z')]
		)
		expect(merged.map((e) => e.eventId)).toEqual(['b', 'a'])
	})

	it('a parità di eventId vince il record incoming (revisione più fresca)', () => {
		const merged = mergeEvents(
			[eq('a', '2026-08-01T10:00:00Z', 2.0)],
			[eq('a', '2026-08-01T10:00:00Z', 2.4)]
		)
		expect(merged).toHaveLength(1)
		expect(merged[0]?.magnitude).toBe(2.4)
	})

	it('ordina per time decrescente (più recente prima)', () => {
		const merged = mergeEvents(
			[eq('vecchio', '2026-08-01T08:00:00Z'), eq('nuovo', '2026-08-01T12:00:00Z')],
			[eq('medio', '2026-08-01T10:00:00Z')]
		)
		expect(merged.map((e) => e.eventId)).toEqual(['nuovo', 'medio', 'vecchio'])
	})

	it('liste vuote → lista vuota', () => {
		expect(mergeEvents([], [])).toEqual([])
	})
})
