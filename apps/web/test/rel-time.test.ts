import { describe, expect, it } from 'vitest'

import { relativeTime } from '../lib/rel-time'

const now = new Date('2026-08-02T10:00:00Z').getTime()

describe('relativeTime', () => {
	it('secondi fa', () => {
		expect(relativeTime('2026-08-02T09:59:45Z', now)).toBe('15 secondi fa')
	})
	it('minuti fa', () => {
		expect(relativeTime('2026-08-02T09:55:00Z', now)).toBe('5 minuti fa')
	})
	it('ore fa', () => {
		expect(relativeTime('2026-08-02T08:00:00Z', now)).toBe('2 ore fa')
	})
	it('giorni fa', () => {
		expect(relativeTime('2026-07-30T10:00:00Z', now)).toBe('3 giorni fa')
	})
	it('adesso (scarto sotto il secondo)', () => {
		expect(relativeTime('2026-08-02T10:00:00Z', now)).toBe('ora')
	})
})
