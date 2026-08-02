import { TIME_WINDOWS, findAreaPreset, type TimeWindow } from '@quakewatch/core'

/** Variante A/B del dettaglio evento (T6): 'default' sostituisce la lista, 'detail-float' flotta sulla mappa. */
export type Variant = 'default' | 'detail-float'

export interface AppState {
	window: TimeWindow
	area: string
	event: string | null
	variant: Variant
	/** Cursore timeline, epoch secondi; null = live (Piano 4). */
	t: number | null
}

/**
 * Parsa i parametri URL in AppState con validazione.
 * Valori non validi o assenti usano i default: window='24h', area='italia', event=null, variant='default', t=null.
 * L'area deve esistere in findAreaPreset; l'event e il t devono essere numerici (^\d+$); variant deve essere 'detail-float'.
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

	// variant: solo 'detail-float' è riconosciuto, ogni altro valore (o assenza) → 'default'
	const variant: Variant = params.get('variant') === 'detail-float' ? 'detail-float' : 'default'

	// t: epoch secondi, solo formato — il clamp su finestra/adesso vive in clampT (lib/timeline.ts),
	// perché qui non c'è (e non deve esserci) Date.now: parse pura, stessa su server e client.
	const tParam = params.get('t')
	const t = tParam && /^\d+$/.test(tParam) ? Number(tParam) : null

	return { window, area, event, variant, t }
}

/**
 * Serializza AppState in query string.
 * Omette i valori di default per produrre URL puliti.
 * Ordine stabile: window, area, event, variant, t.
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
	if (state.variant !== 'default') {
		params.append('variant', state.variant)
	}
	if (state.t !== null) {
		params.append('t', String(state.t))
	}

	return params.toString()
}
