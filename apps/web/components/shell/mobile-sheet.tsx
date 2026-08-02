'use client'

import type { Earthquake, TimeWindow } from '@quakewatch/core'
import { useEffect, useState, type ReactNode } from 'react'

import { AreaPreset } from '@/components/shell/area-preset'
import { EventList } from '@/components/shell/event-list'
import { SideFooter } from '@/components/shell/side-footer'
import { Summary } from '@/components/shell/summary'
import { Drawer, DrawerContent } from '@/components/ui/drawer'

const PEEK = 0.18
const HALF = 0.5
const FULL = 0.94
const SNAP_POINTS = [PEEK, HALF, FULL]

export interface MobileSheetProps {
	events: Earthquake[]
	isLoading: boolean
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
	area,
	window,
	eventId,
	nowMs,
	listSlot,
	onSelectEvent,
	onAreaWindowChange,
}: MobileSheetProps) {
	const [snapPoint, setSnapPoint] = useState<number>(PEEK)

	// Selezionare un evento porta il sheet a tutta altezza per mostrare il dettaglio.
	useEffect(() => {
		if (eventId !== null) setSnapPoint(FULL)
	}, [eventId])

	const mostRecent = events.toSorted((a, b) => b.time.localeCompare(a.time))[0] ?? null

	let body: ReactNode
	if (eventId !== null) {
		body = listSlot
	} else if (snapPoint === PEEK) {
		body = (
			<>
				<Summary events={events} isLoading={isLoading} />
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
			snapPoints={SNAP_POINTS}
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
