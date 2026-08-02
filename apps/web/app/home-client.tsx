'use client'

import { useEventsQuery, WINDOW_CONFIG, type TimeWindow } from '@quakewatch/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { MapLegend } from '@/components/map-legend'
import { QuakeMap } from '@/components/quake-map'
import { AreaPreset } from '@/components/shell/area-preset'
import { EventDetail } from '@/components/shell/event-detail'
import { EventList } from '@/components/shell/event-list'
import { Header } from '@/components/shell/header'
import { MobileSheet } from '@/components/shell/mobile-sheet'
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

	const { data, isLoading, isError } = useEventsQuery(state.window, state.area)
	const events = data?.events ?? []

	// Ultimo evento selezionato prima di "indietro": ripristina il focus lì in EventList (a11y).
	// Ref, non state — non deve causare un re-render, solo essere letto al prossimo render
	// già innescato dal cambio di stato.event via router.replace.
	const lastClearedIdRef = useRef<string | null>(null)

	// Toggle ShakeMap (T5): mai persistito nell'URL. Derivato da state.event (non dagli handler
	// sotto): state.event viene da useSearchParams, quindi cambia anche per back/forward del
	// browser o navigazione diretta senza mai passare da handleSelectEvent/handleClearEvent —
	// un effect sull'evento è l'unico modo di azzerarlo in ogni caso.
	const [showShakemap, setShowShakemap] = useState(false)
	useEffect(() => setShowShakemap(false), [state.event])

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

	function handleClearEvent() {
		lastClearedIdRef.current = state.event
		const qs = serializeAppState({ ...state, event: null })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}

	const threshold = WINDOW_CONFIG[state.window].minMagnitude
	const emptyLabel = threshold
		? `Nessun evento M≥${threshold} ${WINDOW_TEXT[state.window]}`
		: `Nessun evento ${WINDOW_TEXT[state.window]}`

	let listSlot: ReactNode
	if (state.event !== null) {
		listSlot = (
			<EventDetail
				eventId={state.event}
				onBack={handleClearEvent}
				showShakemap={showShakemap}
				onToggleShakemap={setShowShakemap}
			/>
		)
	} else if (isLoading) {
		listSlot = (
			<div className="flex flex-1 flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-card p-2">
				{Array.from({ length: 5 }, (_, i) => (
					<Skeleton key={i} className="h-8 w-full shrink-0" />
				))}
			</div>
		)
	} else if (isError) {
		listSlot = (
			<div className="dot-grid flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-center text-xs text-muted-foreground">
				Dati non disponibili al momento.
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
				restoreFocusId={lastClearedIdRef.current}
			/>
		)
	}

	return (
		<div className="grid h-dvh w-screen grid-cols-1 grid-rows-1 bg-background text-foreground md:grid-cols-[360px_1fr] md:grid-rows-[1fr_72px]">
			{/* Sidebar: sotto md sparisce, sostituita dal bottom sheet (mobile-sheet.tsx) */}
			<div className="col-start-1 row-start-1 row-span-2 hidden flex-col gap-2 overflow-hidden bg-sidebar p-2 md:flex">
				<Header isLive={state.window === '24h'} nowMs={nowMs} />
				<Summary events={events} isLoading={isLoading} hasError={isError} />
				<AreaPreset area={state.area} window={state.window} onChange={handleAreaWindowChange} />
				{listSlot}
				<SideFooter />
			</div>

			{/* Chips riepilogo mobile: overlay sopra la mappa (z-10: precede la mappa nel DOM, stesso
			    grid cell), pointer-events-none tranne il contenuto. Header qui perché sotto md
			    non c'è sidebar: è l'unico modo di raggiungere il toggle tema (vincolo di piano). */}
			<div className="pointer-events-none relative z-10 col-start-1 row-start-1 flex flex-col gap-2 p-2 pt-[env(safe-area-inset-top)] md:hidden">
				<div className="pointer-events-auto flex flex-col gap-2">
					<Header isLive={state.window === '24h'} nowMs={nowMs} />
					<Summary events={events} isLoading={isLoading} hasError={isError} />
				</div>
			</div>

			{/* Mappa */}
			<div className="relative col-start-1 row-start-1 overflow-hidden bg-card md:col-start-2">
				<QuakeMap
					events={events}
					selectedId={state.event}
					onSelect={handleSelectEvent}
					isLive={state.window === '24h'}
					showShakemap={showShakemap}
				/>
				<MapLegend showMmi={showShakemap} />
			</div>

			{/* Timeline: solo desktop. Sotto md è un placeholder (Piano 3 la sostituisce con la
			    timeline reale) — costruire ora una variante mobile compatta per un placeholder
			    sarebbe lavoro rifatto due volte; si riconsidera quando arriva la timeline vera. */}
			<TimelineSlot />

			<MobileSheet
				events={events}
				isLoading={isLoading}
				area={state.area}
				window={state.window}
				eventId={state.event}
				nowMs={nowMs}
				listSlot={listSlot}
				onSelectEvent={handleSelectEvent}
				onAreaWindowChange={handleAreaWindowChange}
			/>
		</div>
	)
}
