'use client'

import { useCallback, useSyncExternalStore } from 'react'

import { snapshot, subscribe, writePref } from '@/lib/prefs'

/**
 * Preferenza persistita in localStorage, sincronizzata cross-component
 * (same-tab via listener registry) e cross-tab (storage event). SSR-safe:
 * useSyncExternalStore usa `defaultValue` come server snapshot → nessun
 * hydration mismatch, update post-mount al valore persistito.
 *
 * T deve essere JSON-serializzabile; la cache interna (snapshot) garantisce
 * stabilità referenziale anche per oggetti. Pattern next-themes, senza
 * provider component.
 */
export function usePersistentPref<T>(key: string, defaultValue: T): [T, (value: T) => void] {
	const value = useSyncExternalStore(
		(cb) => subscribe(key, cb),
		() => snapshot(key, defaultValue),
		() => defaultValue
	)
	const set = useCallback((value: T) => writePref(key, value), [key])
	return [value, set]
}
