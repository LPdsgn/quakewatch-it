'use client'

import type { Earthquake, TimeWindow } from '@quakewatch/core'
import { useEffect, useState, type ReactNode } from 'react'

import { AreaPreset } from '@/components/shell/area-preset'
import { EventList } from '@/components/shell/event-list'
import { SideFooter } from '@/components/shell/side-footer'
import { Strongest } from '@/components/shell/strongest'
import { Summary } from '@/components/shell/summary'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { SHEET_PEEK } from '@/lib/layout-constants'

const HALF = 0.5
const FULL = 0.85
const SNAP_POINTS = [SHEET_PEEK, HALF, FULL]
// Col dettaglio aperto FULL sparisce dai punti raggiungibili: HALF basta per le informazioni
// e tiene visibile la porzione di mappa con l'epicentro selezionato.
const SNAP_POINTS_DETAIL = [SHEET_PEEK, HALF]

export interface MobileSheetProps {
	events: Earthquake[]
	isLoading: boolean
	/** Fetch fallito: inoltrata alla Summary del PEEK (stesso trattamento del ramo desktop). */
	hasError: boolean
	area: string
	window: TimeWindow
	eventId: string | null
	nowMs: number | null
	/** Stesso nodo del ramo desktop (T8/T11): dettaglio, skeleton, vuoto o lista — invariato. */
	listSlot: ReactNode
	onSelectEvent: (eventId: string) => void
	onAreaWindowChange: (area: string, window: TimeWindow) => void
}

/**
 * Sheet mobile (<md): stessi componenti del sidebar desktop, ricomposti su 3 snap point.
 * Sempre aperto (nessun trigger): è la sidebar sotto md, non un overlay dismissibile.
 */
export function MobileSheet({
	events,
	isLoading,
	hasError,
	area,
	window,
	eventId,
	nowMs,
	listSlot,
	onSelectEvent,
	onAreaWindowChange,
}: MobileSheetProps) {
	// Init lazy sull'eventId iniziale: su deep-link con evento in URL evita il flash
	// PEEK→HALF al primo render (altrimenti si vedrebbe un frame a peek prima dell'effect).
	const [snapPoint, setSnapPoint] = useState<number>(() => (eventId !== null ? HALF : SHEET_PEEK))

	// Selezionare un evento porta il sheet a metà altezza (cap: mai FULL col dettaglio aperto).
	// Il "indietro" (eventId → null) NON resetta lo snap point: scelta intenzionale, non
	// svista — resta dov'era invece di risnappare a PEEK a sorpresa.
	useEffect(() => {
		if (eventId !== null) setSnapPoint(HALF)
	}, [eventId])

	const mostRecent = events.toSorted((a, b) => b.time.localeCompare(a.time))[0] ?? null

	let body: ReactNode
	if (eventId !== null) {
		body = listSlot
	} else if (snapPoint === SHEET_PEEK) {
		body = (
			<>
				<Summary
					events={events}
					isLoading={isLoading}
					hasError={hasError}
					onSelectEvent={onSelectEvent}
					nowMs={nowMs}
				/>
				<EventList
					events={mostRecent ? [mostRecent] : []}
					selectedId={null}
					onSelect={onSelectEvent}
					nowMs={nowMs}
				/>
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
				if (typeof next === 'number') setSnapPoint(next)
			}}
		>
			<DrawerContent
				aria-label="Eventi sismici"
				className="pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">{body}</div>
			</DrawerContent>
		</Drawer>
	)
}
