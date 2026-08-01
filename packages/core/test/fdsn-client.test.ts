import { describe, expect, it } from 'vitest'

import { findAreaPreset } from '../src/areas'
import { buildEventDetailUrl, buildEventsUrl } from '../src/fdsn-client'

const BASE = 'https://webservices.ingv.it'
const now = new Date('2026-08-01T10:23:45Z')
const italia = findAreaPreset('italia')!

describe('buildEventsUrl', () => {
	it('costruisce la query canonica per la finestra 24h', () => {
		const url = buildEventsUrl(BASE, '24h', italia, now)
		expect(url.origin + url.pathname).toBe(`${BASE}/fdsnws/event/1/query`)
		const p = url.searchParams
		expect(p.get('format')).toBe('text')
		expect(p.get('orderby')).toBe('time')
		expect(p.get('starttime')).toBe('2026-07-31T10:23:00')
		expect(p.get('endtime')).toBe('2026-08-01T10:23:00')
		expect(p.get('minlatitude')).toBe('35')
		expect(p.get('maxlatitude')).toBe('47.5')
		expect(p.get('minlongitude')).toBe('6')
		expect(p.get('maxlongitude')).toBe('19')
		expect(p.get('minmagnitude')).toBeNull() // 24h: tutte le magnitudo
	})

	it('applica minmagnitude=2 alle finestre lunghe', () => {
		expect(buildEventsUrl(BASE, '30d', italia, now).searchParams.get('minmagnitude')).toBe('2')
		expect(buildEventsUrl(BASE, '90d', italia, now).searchParams.get('minmagnitude')).toBe('2')
	})

	it('stesso minuto → stessa URL (chiave di cache condivisa)', () => {
		const a = buildEventsUrl(BASE, '7d', italia, new Date('2026-08-01T10:23:05Z'))
		const b = buildEventsUrl(BASE, '7d', italia, new Date('2026-08-01T10:23:55Z'))
		expect(a.toString()).toBe(b.toString())
	})
})

describe('buildEventDetailUrl', () => {
	it('richiede QuakeML con tutte le revisioni', () => {
		const url = buildEventDetailUrl(BASE, '44125672')
		const p = url.searchParams
		expect(p.get('eventid')).toBe('44125672')
		expect(p.get('includeallorigins')).toBe('true')
		expect(p.get('includeallmagnitudes')).toBe('true')
	})
})
