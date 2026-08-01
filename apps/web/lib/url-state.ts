import { TIME_WINDOWS, findAreaPreset, type TimeWindow } from '@quakewatch/core'

export interface AppState {
	window: TimeWindow
	area: string
	event: string | null
}

/**
 * Parsa i parametri URL in AppState con validazione.
 * Valori non validi o assenti usano i default: window='24h', area='italia', event=null.
 * L'area deve esistere in findAreaPreset; l'event deve essere numerico (^\d+$).
 */
export function parseAppState(params: URLSearchParams): AppState {
	// window: valida contro TIME_WINDOWS, default '24h'
	const windowParam = params.get('window')
	const window =
		windowParam && TIME_WINDOWS.includes(windowParam as TimeWindow)
			? (windowParam as TimeWindow)
			: '24h'

	// area: valida con findAreaPreset, default 'italia'
	const areaParam = params.get('area')
	const area = areaParam && findAreaPreset(areaParam) ? areaParam : 'italia'

	// event: deve essere numerico, default null
	const eventParam = params.get('event')
	const event = eventParam && /^\d+$/.test(eventParam) ? eventParam : null

	return { window, area, event }
}

/**
 * Serializza AppState in query string.
 * Omette i valori di default per produrre URL puliti.
 * Ordine stabile: window, area, event.
 */
export function serializeAppState(state: AppState): string {
	const params = new URLSearchParams()

	// Aggiungi solo se diverso dal default
	if (state.window !== '24h') {
		params.append('window', state.window)
	}
	if (state.area !== 'italia') {
		params.append('area', state.area)
	}
	if (state.event !== null) {
		params.append('event', state.event)
	}

	return params.toString()
}
