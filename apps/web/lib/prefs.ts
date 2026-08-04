/** Storage iniettabile per testabilità (vitest node env senza DOM). */
export interface PrefStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

function getStorage(): PrefStorage | null {
	return typeof window !== 'undefined' ? window.localStorage : null
}

/** Legge e parse-JSON una preferenza; fallback su assenza/errore/SSR. Pure, no cache. */
export function readPref<T>(
	key: string,
	fallback: T,
	storage: PrefStorage | null = getStorage()
): T {
	if (storage === null) return fallback
	const raw = storage.getItem(key)
	if (raw === null) return fallback
	try {
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}

const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

function notify(key: string): void {
	cache.delete(key)
	listeners.get(key)?.forEach((cb) => cb())
}

/** Scrive (JSON) + invalida cache + notifica i subscriber. No-op in SSR. */
export function writePref<T>(
	key: string,
	value: T,
	storage: PrefStorage | null = getStorage()
): void {
	if (storage === null) return
	storage.setItem(key, JSON.stringify(value))
	notify(key)
}

/** Snapshot cached per useSyncExternalStore (referenza stabile tra notifiche). */
export function snapshot<T>(key: string, fallback: T): T {
	if (cache.has(key)) return cache.get(key) as T
	const value = readPref(key, fallback)
	cache.set(key, value)
	return value
}

/** Sottoscrizione per-key per useSyncExternalStore. */
export function subscribe(key: string, cb: () => void): () => void {
	let set = listeners.get(key)
	if (!set) {
		set = new Set()
		listeners.set(key, set)
	}
	set.add(cb)
	return () => {
		set!.delete(cb)
		if (set!.size === 0) listeners.delete(key)
	}
}

// Cross-tab: storage event fires in OTHER tabs → invalidate cache + notify.
if (typeof window !== 'undefined') {
	window.addEventListener('storage', (e: StorageEvent) => {
		if (e.key) notify(e.key)
	})
}
