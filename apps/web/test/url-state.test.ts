import { describe, expect, it } from 'vitest'

import { parseAppState, serializeAppState } from '../lib/url-state'

describe('parseAppState', () => {
	it('vuoto → default', () => {
		expect(parseAppState(new URLSearchParams())).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
		})
	})
	it('valori validi passano', () => {
		expect(parseAppState(new URLSearchParams('window=7d&area=campi-flegrei&event=123'))).toEqual({
			window: '7d',
			area: 'campi-flegrei',
			event: '123',
		})
	})
	it('window/area invalidi → default; event non numerico → null', () => {
		expect(parseAppState(new URLSearchParams('window=1y&area=atlantide&event=x'))).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
		})
	})
})

describe('serializeAppState', () => {
	it('omette i default (URL pulito)', () => {
		expect(serializeAppState({ window: '24h', area: 'italia', event: null })).toBe('')
	})
	it('serializza solo il non-default, ordine stabile', () => {
		expect(serializeAppState({ window: '90d', area: 'etna', event: '42' })).toBe(
			'window=90d&area=etna&event=42'
		)
	})
	it('roundtrip', () => {
		const s = { window: '7d' as const, area: 'campi-flegrei', event: '9' }
		expect(parseAppState(new URLSearchParams(serializeAppState(s)))).toEqual(s)
	})
})
