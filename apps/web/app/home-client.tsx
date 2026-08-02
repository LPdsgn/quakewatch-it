'use client'

import { useEventsQuery, WINDOW_CONFIG, type TimeWindow } from '@quakewatch/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { QuakeMap } from '@/components/quake-map'
import { AreaPreset } from '@/components/shell/area-preset'
import { EventList } from '@/components/shell/event-list'
import { Header } from '@/components/shell/header'
import { SideFooter } from '@/components/shell/side-footer'
import { Summary } from '@/components/shell/summary'
import { TimelineSlot } from '@/components/shell/timeline-slot'
import { Skeleton } from '@/components/ui/skeleton'
import { parseAppState, serializeAppState } from '@/lib/url-state'

const WINDOW_TEXT: Record<TimeWindow, string> = {
	'24h': 'nelle ultime 24 ore',
	'7d': 'negli ultimi 7 giorni',
	'30d': 'negli ultimi 30 giorni',
	'90d': 'negli ultimi 90 giorni',
}

export function HomeClient() {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const state = parseAppState(searchParams)

	const { data, isLoading } = useEventsQuery(state.window, state.area)
	const events = data?.events ?? []

	// Orologio condiviso (Header + lista eventi): un solo interval per la pagina, mai
	// Date.now() in render SSR (lezione prototipo) → null finché non ha ticchettato.
	const [nowMs, setNowMs] = useState<number | null>(null)
	useEffect(() => {
		const tick = () => setNowMs(Date.now())
		tick()
		const id = setInterval(tick, 1000)
		return () => clearInterval(id)
	}, [])

	function handleAreaWindowChange(area: string, window: TimeWindow) {
		const qs = serializeAppState({ ...state, area, window })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}

	function handleSelectEvent(eventId: string) {
		const qs = serializeAppState({ ...state, event: eventId })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}

	const threshold = WINDOW_CONFIG[state.window].minMagnitude
	const emptyLabel = threshold
		? `Nessun evento M≥${threshold} ${WINDOW_TEXT[state.window]}`
		: `Nessun evento ${WINDOW_TEXT[state.window]}`

	let listSlot: ReactNode
	if (isLoading) {
		listSlot = (
			<div className="flex flex-1 flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-card p-2">
				{Array.from({ length: 5 }, (_, i) => (
					<Skeleton key={i} className="h-8 w-full shrink-0" />
				))}
			</div>
		)
	} else if (events.length === 0) {
		listSlot = (
			<div className="dot-grid flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-center text-xs text-muted-foreground">
				{emptyLabel}
			</div>
		)
	} else {
		listSlot = (
			<EventList
				events={events}
				selectedId={state.event}
				onSelect={handleSelectEvent}
				nowMs={nowMs}
			/>
		)
	}

	return (
		<div className="grid h-screen w-screen grid-cols-1 grid-rows-1 bg-background text-foreground md:grid-cols-[360px_1fr] md:grid-rows-[1fr_72px]">
			{/* Sidebar: sotto md sparisce (il bottom sheet arriva nel T12) */}
			<div className="col-start-1 row-start-1 row-span-2 hidden flex-col gap-2 overflow-hidden bg-sidebar p-2 md:flex">
				<Header isLive={state.window === '24h'} nowMs={nowMs} />
				<Summary events={events} isLoading={isLoading} />
				<AreaPreset area={state.area} window={state.window} onChange={handleAreaWindowChange} />
				{listSlot}
				<SideFooter />
			</div>

			{/* Mappa */}
			<div className="col-start-1 row-start-1 overflow-hidden bg-card md:col-start-2">
				<QuakeMap
					events={events}
					selectedId={state.event}
					onSelect={handleSelectEvent}
					isLive={state.window === '24h'}
				/>
			</div>

			<TimelineSlot />
		</div>
	)
}
