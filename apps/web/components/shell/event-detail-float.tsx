import type { ReactNode } from 'react'

/**
 * Wrapper di posizionamento per la variante B (A/B, T6 — preferenza `variant=detail-float`
 * in localStorage via usePersistentPref): NON duplica il contenuto di EventDetail, lo
 * riceve come children e lo ancora in un riquadro flottante sopra la mappa (desktop ≥md,
 * come la legenda in basso a sinistra — map-legend.tsx). A differenza della variante
 * default (home-client.tsx: il dettaglio sostituisce la lista in sidebar), qui la lista
 * resta visibile e navigabile a fianco. Mobile invariato: questo wrapper è nascosto sotto
 * md, il dettaglio continua ad apparire nel bottom sheet.
 */
export function EventDetailFloat({ children }: { children: ReactNode }) {
	return (
		<div className="pointer-events-none absolute top-2 right-2 z-10 hidden max-h-[70%] w-90 md:flex">
			<div className="pointer-events-auto flex min-h-0 w-full flex-col">{children}</div>
		</div>
	)
}
