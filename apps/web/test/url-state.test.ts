import { describe, expect, it } from 'vitest'

import { parseAppState, serializeAppState } from '../lib/url-state'

describe('parseAppState', () => {
	it('vuoto → default', () => {
		expect(parseAppState(new URLSearchParams())).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
			t: null,
		})
	})
	it('valori validi passano', () => {
		expect(parseAppState(new URLSearchParams('window=7d&area=campi-flegrei&event=123'))).toEqual({
			window: '7d',
			area: 'campi-flegrei',
			event: '123',
			t: null,
		})
	})
	it('window/area invalidi → default; event non numerico → null', () => {
		expect(parseAppState(new URLSearchParams('window=1y&area=atlantide&event=x'))).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
			t: null,
		})
	})
	it('t numerico → epoch secondi', () => {
		expect(parseAppState(new URLSearchParams('t=1754130000')).t).toBe(1754130000)
	})

	it('t non numerico o assente → null', () => {
		expect(parseAppState(new URLSearchParams('t=abc')).t).toBeNull()
		expect(parseAppState(new URLSearchParams('t=-5')).t).toBeNull()
		expect(parseAppState(new URLSearchParams('')).t).toBeNull()
	})
})

describe('serializeAppState', () => {
	it('omette i default (URL pulito)', () => {
		expect(
			serializeAppState({
				window: '24h',
				area: 'italia',
				event: null,
				t: null,
			})
		).toBe('')
	})
	it('serializza solo il non-default, ordine stabile', () => {
		expect(
			serializeAppState({
				window: '90d',
				area: 'etna',
				event: '42',
				t: null,
			})
		).toBe('window=90d&area=etna&event=42')
	})
	it('roundtrip', () => {
		const s = {
			window: '7d' as const,
			area: 'campi-flegrei',
			event: '9',
			t: null,
		}
		expect(parseAppState(new URLSearchParams(serializeAppState(s)))).toEqual(s)
	})
	it('serializza t in coda, omesso se null', () => {
		const base = { window: '24h', area: 'italia', event: null } as const
		expect(serializeAppState({ ...base, t: 1754130000 })).toBe('t=1754130000')
		expect(serializeAppState({ ...base, t: null })).toBe('')
		expect(serializeAppState({ ...base, window: '7d', t: 1754130000 })).toBe(
			'window=7d&t=1754130000'
		)
	})
})
