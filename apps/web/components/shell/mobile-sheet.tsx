'use client'

import type { Earthquake, TimeWindow } from '@quakewatch/core'
import type { ReactNode } from 'react'

import { AreaPreset } from '@/components/shell/area-preset'
// import { EventList } from '@/components/shell/event-list'
import { SideFooter } from '@/components/shell/side-footer'
import { Strongest } from '@/components/shell/strongest'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { SHEET_FULL, SHEET_HALF, SHEET_PEEK } from '@/lib/layout-constants'

const SNAP_POINTS = [SHEET_PEEK, SHEET_HALF, SHEET_FULL]
// Col dettaglio aperto FULL sparisce dai punti raggiungibili: HALF basta per le informazioni
// e tiene visibile la porzione di mappa con l'epicentro selezionato.
const SNAP_POINTS_DETAIL = [SHEET_PEEK, SHEET_HALF]

export interface MobileSheetProps {
	events: Earthquake[]
	/** Non più consumate (la Summary del PEEK è stata rimossa: duplicava i chip dell'overlay
	 *  in alto); restano nell'interfaccia per non toccare il call site — pulizia a fine piano. */
	isLoading: boolean
	hasError: boolean
	area: string
	window: TimeWindow
	eventId: string | null
	nowMs: number | null
	/** Stesso nodo del ramo desktop (T8/T11): dettaglio, skeleton, vuoto o lista — invariato. */
	listSlot: ReactNode
	/** Stato snap alzato in home-client: la legenda mappa si ancora allo snap reale, non a PEEK. */
	snapPoint: number
	onSnapPointChange: (snapPoint: number) => void
	onSelectEvent: (eventId: string) => void
	onAreaWindowChange: (area: string, window: TimeWindow) => void
}

/**
 * Sheet mobile (<md): stessi componenti del sidebar desktop, ricomposti su 3 snap point.
 * Sempre aperto (nessun trigger): è la sidebar sotto md, non un overlay dismissibile.
 */
export function MobileSheet({
	events,
	area,
	window,
	eventId,
	nowMs,
	listSlot,
	snapPoint,
	onSnapPointChange,
	onSelectEvent,
	onAreaWindowChange,
}: MobileSheetProps) {
	// const mostRecent = events.toSorted((a, b) => b.time.localeCompare(a.time))[0] ?? null

	// PEEK: filtri geo/tempo + ultimo evento — NIENTE riepilogo (i chip vivono già
	// nell'overlay in alto: era duplicato, richiesta utente 2026-08-02).
	// HALF/FULL: hub completo con "I più forti" (solo qui) + lista.
	let body: ReactNode
	if (eventId !== null) {
		body = listSlot
	} else if (snapPoint === SHEET_PEEK) {
		body = (
			<>
				<AreaPreset area={area} window={window} onChange={onAreaWindowChange} />
				{/* <EventList
					events={mostRecent ? [mostRecent] : []}
					selectedId={null}
					onSelect={onSelectEvent}
					nowMs={nowMs}
				/> */}
			</>
		)
	} else {
		body = (
			<>
				<Strongest
					events={events}
					selectedId={eventId}
					onSelect={onSelectEvent}
					nowMs={nowMs}
					defaultOpen={false}
				/>
				<AreaPreset area={area} window={window} onChange={onAreaWindowChange} />
				{listSlot}
				<SideFooter />
			</>
		)
	}

	return (
		<Drawer
			open
			modal={false}
			showSwipeHandle
			snapPoints={eventId !== null ? SNAP_POINTS_DETAIL : SNAP_POINTS}
			snapPoint={snapPoint}
			onSnapPointChange={(next) => {
				if (typeof next === 'number') onSnapPointChange(next)
			}}
		>
			<DrawerContent
				aria-label="Eventi sismici"
				className="pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				{/* Il popup del Drawer con snap point è alto 100dvh e viene solo TRASLATO
				    (drawer.tsx: --drawer-snap-point-offset): senza un cap esplicito il contenuto
				    riempie i 100dvh e la parte sotto il bordo schermo è irraggiungibile — la
				    ScrollArea del dettaglio non scrollava. Altezza = porzione visibile allo snap
				    corrente, meno swipe handle (h-3) e safe area. */}
				<div
					className="flex min-h-0 flex-col gap-2 overflow-hidden p-2 transition-[height] duration-450 ease-[cubic-bezier(0.32,0.72,0,1)]"
					style={{
						height: `calc(${snapPoint * 100}dvh - 0.75rem - env(safe-area-inset-bottom))`,
					}}
				>
					{body}
				</div>
			</DrawerContent>
		</Drawer>
	)
}
