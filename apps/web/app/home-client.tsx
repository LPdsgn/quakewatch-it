'use client'

import { useEventsQuery, WINDOW_CONFIG, type TimeWindow } from '@quakewatch/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { AreaPreset } from '@/components/shell/area-preset'
import { Header } from '@/components/shell/header'
import { SideFooter } from '@/components/shell/side-footer'
import { Summary } from '@/components/shell/summary'
import { TimelineSlot } from '@/components/shell/timeline-slot'
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

	function handleAreaWindowChange(area: string, window: TimeWindow) {
		const qs = serializeAppState({ ...state, area, window })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}

	const threshold = WINDOW_CONFIG[state.window].minMagnitude
	const emptyLabel = threshold
		? `Nessun evento M≥${threshold} ${WINDOW_TEXT[state.window]}`
		: `Nessun evento ${WINDOW_TEXT[state.window]}`
	let listSlotContent = `${events.length} eventi · lista in Piano 3`
	if (isLoading) listSlotContent = 'Caricamento…'
	else if (events.length === 0) listSlotContent = emptyLabel

	return (
		<div className="grid h-screen w-screen grid-cols-1 grid-rows-1 bg-background text-foreground md:grid-cols-[360px_1fr] md:grid-rows-[1fr_72px]">
			{/* Sidebar: sotto md sparisce (il bottom sheet arriva nel T12) */}
			<div className="col-start-1 row-start-1 row-span-2 hidden flex-col gap-2 overflow-hidden bg-sidebar p-2 md:flex">
				<Header isLive={state.window === '24h'} />
				<Summary events={events} isLoading={isLoading} />
				<AreaPreset area={state.area} window={state.window} onChange={handleAreaWindowChange} />
				{/* Slot lista eventi: il T9 sostituisce questo placeholder con la lista reale */}
				<div className="dot-grid flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-center text-xs text-muted-foreground">
					{listSlotContent}
				</div>
				<SideFooter />
			</div>

			{/* Mappa: placeholder per il T10 */}
			<div className="dot-grid col-start-1 row-start-1 flex items-center justify-center bg-card md:col-start-2">
				<span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
					MAPPA · T10
				</span>
			</div>

			<TimelineSlot />
		</div>
	)
}
