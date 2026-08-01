import type { EventDetail } from './types'

export type RevisionStatus = 'preliminare' | 'rivisto'

/**
 * Un evento è "rivisto" solo se la localizzazione preferita è stata
 * valutata manualmente da un sismologo. In ogni altro caso (automatica
 * o non dichiarata) resta "preliminare": mai sovrastimare l'affidabilità.
 */
export function revisionStatus(detail: EventDetail): RevisionStatus {
	return detail.preferredOrigin.evaluationMode === 'manual' ? 'rivisto' : 'preliminare'
}

/** True se l'evento ha uno storico di revisioni da mostrare (spec §2, dettaglio). */
export function hasRevisions(detail: EventDetail): boolean {
	return detail.origins.length > 1 || detail.magnitudes.length > 1
}
