import { describe, expect, it } from 'vitest'

import { readPref, writePref, subscribe, type PrefStorage } from '../lib/prefs'

function makeStorage(): PrefStorage {
	const map = new Map<string, string>()
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			map.set(k, v)
		},
		removeItem: (k) => {
			map.delete(k)
		},
	}
}

describe('readPref', () => {
	it('fallback quando storage null (SSR)', () => {
		expect(readPref('k1', 'def', null)).toBe('def')
	})
	it('fallback quando chiave assente', () => {
		expect(readPref('k2', 'def', makeStorage())).toBe('def')
	})
	it('legge valore JSON valido', () => {
		const s = makeStorage()
		s.setItem('k3', '"val"')
		expect(readPref('k3', 'def', s)).toBe('val')
	})
	it('fallback su JSON malformato', () => {
		const s = makeStorage()
		s.setItem('k4', '{not json')
		expect(readPref('k4', 'def', s)).toBe('def')
	})
	it('legge oggetti complessi', () => {
		const s = makeStorage()
		s.setItem('k5', JSON.stringify({ a: 1 }))
		expect(readPref('k5', null, s)).toEqual({ a: 1 })
	})
})

describe('writePref', () => {
	it('no-op quando storage null (SSR)', () => {
		expect(() => writePref('k6', 'v', null)).not.toThrow()
	})
	it('serializza e scrive', () => {
		const s = makeStorage()
		writePref('k7', { a: 1 }, s)
		expect(s.getItem('k7')).toBe('{"a":1}')
	})
	it('roundtrip write→read', () => {
		const s = makeStorage()
		writePref('k8', 'val', s)
		expect(readPref('k8', 'def', s)).toBe('val')
	})
})

describe('subscribe + notify', () => {
	it('subscriber notificato su writePref stessa chiave', () => {
		const s = makeStorage()
		let calls = 0
		const unsub = subscribe('k9', () => {
			calls++
		})
		writePref('k9', 'v', s)
		expect(calls).toBe(1)
		unsub()
	})
	it('subscriber NON notificato su altra chiave', () => {
		const s = makeStorage()
		let calls = 0
		subscribe('k10', () => {
			calls++
		})
		writePref('other10', 'v', s)
		expect(calls).toBe(0)
	})
	it('unsubscribe ferma le notifiche', () => {
		const s = makeStorage()
		let calls = 0
		const unsub = subscribe('k11', () => {
			calls++
		})
		unsub()
		writePref('k11', 'v', s)
		expect(calls).toBe(0)
	})
})

describe('feltFilter preference', () => {
	it('feltFilter default "all"', () => {
		const s = makeStorage()
		expect(readPref('feltFilter', 'all', s)).toBe('all')
	})

	it('feltFilter roundtrip write→read', () => {
		const s = makeStorage()
		writePref('feltFilter', 'felt', s)
		expect(readPref('feltFilter', 'all', s)).toBe('felt')
	})
})
