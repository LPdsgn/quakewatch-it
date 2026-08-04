// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePersistentPref } from '../hooks/use-persistent-pref'

describe('usePersistentPref', () => {
	beforeEach(() => {
		window.localStorage.clear()
	})

	it('default quando localStorage vuoto', () => {
		const { result } = renderHook(() => usePersistentPref('v1', 'default'))
		expect(result.current[0]).toBe('default')
	})

	it('legge valore persistito', () => {
		window.localStorage.setItem('v2', JSON.stringify('detail-float'))
		const { result } = renderHook(() => usePersistentPref('v2', 'default'))
		expect(result.current[0]).toBe('detail-float')
	})

	it('set aggiorna valore + scrive localStorage', () => {
		const { result } = renderHook(() => usePersistentPref('v3', 'default'))
		act(() => result.current[1]('detail-float'))
		expect(result.current[0]).toBe('detail-float')
		expect(window.localStorage.getItem('v3')).toBe(JSON.stringify('detail-float'))
	})

	it('due consumer stessa chiave restano sincronizzati (cross-component)', () => {
		const a = renderHook(() => usePersistentPref('sync', 'def'))
		const b = renderHook(() => usePersistentPref('sync', 'def'))
		expect(a.result.current[0]).toBe('def')
		expect(b.result.current[0]).toBe('def')
		act(() => a.result.current[1]('changed'))
		expect(a.result.current[0]).toBe('changed')
		expect(b.result.current[0]).toBe('changed')
	})
})
