import { describe, expect, it } from 'vitest'

import { parseAppState, serializeAppState } from '../lib/url-state'

describe('parseAppState', () => {
	it('vuoto → default', () => {
		expect(parseAppState(new URLSearchParams())).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
			variant: 'default',
		})
	})
	it('valori validi passano', () => {
		expect(parseAppState(new URLSearchParams('window=7d&area=campi-flegrei&event=123'))).toEqual({
			window: '7d',
			area: 'campi-flegrei',
			event: '123',
			variant: 'default',
		})
	})
	it('window/area invalidi → default; event non numerico → null', () => {
		expect(parseAppState(new URLSearchParams('window=1y&area=atlantide&event=x'))).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
			variant: 'default',
		})
	})
	it('variant=detail-float → passa', () => {
		expect(parseAppState(new URLSearchParams('variant=detail-float'))).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
			variant: 'detail-float',
		})
	})
	it('variant invalido → default', () => {
		expect(parseAppState(new URLSearchParams('variant=qualcosa-altro'))).toEqual({
			window: '24h',
			area: 'italia',
			event: null,
			variant: 'default',
		})
	})
})

describe('serializeAppState', () => {
	it('omette i default (URL pulito)', () => {
		expect(
			serializeAppState({ window: '24h', area: 'italia', event: null, variant: 'default' })
		).toBe('')
	})
	it('serializza solo il non-default, ordine stabile', () => {
		expect(
			serializeAppState({ window: '90d', area: 'etna', event: '42', variant: 'default' })
		).toBe('window=90d&area=etna&event=42')
	})
	it('variant non-default in coda, ordine stabile', () => {
		expect(
			serializeAppState({ window: '24h', area: 'italia', event: null, variant: 'detail-float' })
		).toBe('variant=detail-float')
	})
	it('roundtrip', () => {
		const s = {
			window: '7d' as const,
			area: 'campi-flegrei',
			event: '9',
			variant: 'detail-float' as const,
		}
		expect(parseAppState(new URLSearchParams(serializeAppState(s)))).toEqual(s)
	})
})
