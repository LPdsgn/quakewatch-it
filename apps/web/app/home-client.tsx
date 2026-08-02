'use client'

import { useEventsQuery, WINDOW_CONFIG, type TimeWindow } from '@quakewatch/core'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { MapLegend } from '@/components/map-legend'
import { QuakeMap, type QuakeMapHandle } from '@/components/quake-map'
import { AreaPreset } from '@/components/shell/area-preset'
import { EventDetail } from '@/components/shell/event-detail'
import { EventDetailFloat } from '@/components/shell/event-detail-float'
import { EventList } from '@/components/shell/event-list'
import { Header } from '@/components/shell/header'
import { MobileSheet } from '@/components/shell/mobile-sheet'
import { SideFooter } from '@/components/shell/side-footer'
import { Strongest } from '@/components/shell/strongest'
import { Summary } from '@/components/shell/summary'
import { Timeline } from '@/components/timeline'
import { Skeleton } from '@/components/ui/skeleton'
import { SHEET_HALF, SHEET_PEEK } from '@/lib/layout-constants'
import { clampT, shouldDeselect } from '@/lib/timeline'
import { parseAppState, serializeAppState, type Variant } from '@/lib/url-state'
import { cn } from '@/lib/utils'

// Switcher A/B (T6): solo dev, mai in produzione — la variante resta comunque raggiungibile
// via URL (?variant=detail-float) indipendentemente da questo toggle.
// Verdetto A/B 2026-08-02: vince B (float). Variante A e switcher restano DI PROPOSITO
// (decisione utente post-verdetto): candidati a diventare un controllo avanzato di layout
// (es. expert mode, Piano 4+) invece di essere rimossi.
const SHOW_VARIANT_SWITCHER = process.env.NODE_ENV !== 'production'

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
	// useMemo: `data` è stabile tra render (TanStack Query) ma `?? []` senza memo creerebbe un
	// nuovo array a ogni render finché `data` è undefined, invalidando a cascata visibleEvents
	// sotto e gli effect che dipendono da `events`.
	const events = useMemo(() => data?.events ?? [], [data])

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

	// Snap del sheet mobile, alzato qui perché la legenda mappa si ancora allo snap REALE
	// (finding review finale: a HALF col dettaglio aperto la pill restava coperta dal Drawer).
	// Init lazy sull'evento iniziale (deep-link → HALF, niente flash PEEK→HALF); selezionare
	// un evento porta a HALF, il "indietro" NON resetta (resta dov'era, scelta intenzionale).
	const [sheetSnap, setSheetSnap] = useState<number>(() =>
		state.event !== null ? SHEET_HALF : SHEET_PEEK
	)
	useEffect(() => {
		if (state.event !== null) setSheetSnap(SHEET_HALF)
	}, [state.event])

	// Orologio condiviso (Header + lista eventi): un solo interval per la pagina, mai
	// Date.now() in render SSR (lezione prototipo) → null finché non ha ticchettato.
	const [nowMs, setNowMs] = useState<number | null>(null)
	useEffect(() => {
		const tick = () => setNowMs(Date.now())
		tick()
		const id = setInterval(tick, 1000)
		return () => clearInterval(id)
	}, [])

	// t: URL → clamp col clock condiviso. Il clamp NON vive nel parse (pura): qui c'è nowMs.
	const tMs = state.t !== null ? state.t * 1000 : null

	// Snapshot per lista/riepilogo/più-forti (la mappa NON usa questo: filtra via expression)
	const visibleEvents = useMemo(
		() => (tMs !== null ? events.filter((e) => new Date(e.time).getTime() <= tMs) : events),
		[events, tMs]
	)

	// isLive: pulse/affordance live solo su 24h E sul presente
	const isLive = state.window === '24h' && state.t === null

	// hasClock (non nowMs) in dep: correggi al primo tick, non a ogni secondo — router/pathname
	// esclusi dalle dep perché stabili (usePathname/useRouter), state letto per intero ma solo
	// i campi elencati devono rilanciare il calcolo.
	const hasClock = nowMs !== null

	// Correzione URL atomica: clamp di t e deselezione coerente calcolati sullo stesso draft,
	// UN solo replace — due effect separati si sovrascrivevano a vicenda nello stesso flush
	// (il secondo ributtava nell'URL il t non clampato: finding review T5). La deselezione usa
	// il t GIÀ clampato (tMsNext), che copre anche il caso t fuori-finestra E prima dell'evento
	// selezionato nello stesso deep-link.
	// oxlint-disable react-hooks/exhaustive-deps -- vedi commento sopra
	useEffect(() => {
		if (nowMs === null) return
		let next = state
		if (state.t !== null) {
			const clamped = clampT(state.t, nowMs, state.window)
			if (clamped !== state.t) next = { ...next, t: clamped }
		}
		const tMsNext = next.t !== null ? next.t * 1000 : null
		if (next.event !== null && tMsNext !== null) {
			const selected = events.find((e) => e.eventId === next.event)
			if (selected && shouldDeselect(new Date(selected.time).getTime(), tMsNext)) {
				next = { ...next, event: null }
			}
		}
		if (next !== state) {
			const qs = serializeAppState(next)
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
		}
	}, [hasClock, state.t, state.window, state.event, events])
	// oxlint-enable react-hooks/exhaustive-deps

	const mapHandleRef = useRef<QuakeMapHandle | null>(null)

	function handleTimeCommit(tSec: number | null) {
		const qs = serializeAppState({ ...state, t: tSec })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}
	const handleScrub = (ms: number | null) => mapHandleRef.current?.setTimeFilter(ms)

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

	function handleVariantChange(variant: Variant) {
		const qs = serializeAppState({ ...state, variant })
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
	}

	const threshold = WINDOW_CONFIG[state.window].minMagnitude
	const emptyLabel = threshold
		? `Nessun evento M≥${threshold} ${WINDOW_TEXT[state.window]}`
		: `Nessun evento ${WINDOW_TEXT[state.window]}`

	// Contenuto lista (loading/errore/vuoto/lista): indipendente dalla selezione, serve da solo
	// per la sidebar desktop in variante B (T6) dove il dettaglio flotta sulla mappa e la lista
	// resta visibile invece di essere sostituita.
	let listContent: ReactNode
	if (isLoading) {
		listContent = (
			<div className="flex flex-1 flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-card p-2">
				{Array.from({ length: 5 }, (_, i) => (
					<Skeleton key={i} className="h-8 w-full shrink-0" />
				))}
			</div>
		)
	} else if (isError) {
		listContent = (
			<div className="dot-grid flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-center text-xs text-muted-foreground">
				Dati non disponibili al momento.
			</div>
		)
	} else if (visibleEvents.length === 0) {
		listContent = (
			<div className="dot-grid flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 text-center text-xs text-muted-foreground">
				{emptyLabel}
			</div>
		)
	} else {
		listContent = (
			<EventList
				events={visibleEvents}
				selectedId={state.event}
				onSelect={handleSelectEvent}
				nowMs={nowMs}
				restoreFocusId={lastClearedIdRef.current}
			/>
		)
	}

	// key={state.event}: forza il remount (quindi il refocus sul back/chiusura, EventBackButton
	// in event-detail.tsx) quando si passa da un evento all'altro a dettaglio già aperto — in
	// variante B (float) la lista resta cliccabile col riquadro aperto, quindi questo è l'unico
	// evento che aggiorna il dettaglio senza uno smontaggio precedente (niente unmount→mount).
	// Attenzione: questo stesso nodo viene piazzato sia nello slot sidebar desktop sia in
	// MobileSheet (vedi listSlot sotto) → EventDetail monta due istanze in contemporanea.
	// Tutto quello che sta dentro EventDetail deve essere instance-safe: niente id statici,
	// niente focus incondizionato al mount.
	const detailNode =
		state.event !== null ? (
			<EventDetail
				key={state.event}
				eventId={state.event}
				onBack={handleClearEvent}
				showShakemap={showShakemap}
				onToggleShakemap={setShowShakemap}
			/>
		) : null

	// listSlot: nodo condiviso da sidebar desktop (variante default) e sheet mobile (sempre,
	// invariato in T6) — dettaglio se un evento è selezionato, altrimenti il contenuto lista.
	const listSlot = detailNode ?? listContent

	// sidebarSlot: solo per la colonna sidebar desktop. In variante B il dettaglio flotta sulla
	// mappa (vedi EventDetailFloat sotto) invece di sostituire la lista qui.
	const sidebarSlot = state.variant === 'detail-float' ? listContent : listSlot

	return (
		<div className="grid h-dvh w-screen grid-cols-1 grid-rows-1 bg-background text-foreground md:grid-cols-[360px_1fr] md:grid-rows-[1fr_72px]">
			{/* Sidebar: sotto md sparisce, sostituita dal bottom sheet (mobile-sheet.tsx) */}
			<div className="col-start-1 row-start-1 row-span-2 hidden flex-col gap-2 overflow-hidden bg-sidebar p-2 md:flex">
				<Header isLive={state.window === '24h'} nowMs={nowMs} />
				<Summary
					events={visibleEvents}
					isLoading={isLoading}
					hasError={isError}
					onSelectEvent={handleSelectEvent}
					nowMs={nowMs}
				/>
				<Strongest
					events={visibleEvents}
					selectedId={state.event}
					onSelect={handleSelectEvent}
					nowMs={nowMs}
				/>
				<AreaPreset area={state.area} window={state.window} onChange={handleAreaWindowChange} />
				{sidebarSlot}
				<SideFooter />
			</div>

			{/* Chips riepilogo mobile: overlay sopra la mappa (z-10: precede la mappa nel DOM, stesso
			    grid cell), pointer-events-none tranne il contenuto. Header qui perché sotto md
			    non c'è sidebar: è l'unico modo di raggiungere il toggle tema (vincolo di piano). */}
			<div className="pointer-events-none relative z-10 col-start-1 row-start-1 flex flex-col gap-2 p-2 pt-[env(safe-area-inset-top)] md:hidden">
				<div className="pointer-events-auto flex flex-col gap-2 pt-2">
					<Header isLive={state.window === '24h'} nowMs={nowMs} />
					<Summary
						events={visibleEvents}
						isLoading={isLoading}
						hasError={isError}
						onSelectEvent={handleSelectEvent}
						nowMs={nowMs}
					/>
				</div>
			</div>

			{/* Mappa */}
			<div className="relative col-start-1 row-start-1 overflow-hidden bg-card md:col-start-2">
				<QuakeMap
					events={events}
					selectedId={state.event}
					onSelect={handleSelectEvent}
					isLive={isLive}
					showShakemap={showShakemap}
					timeFilterMs={tMs}
					handleRef={mapHandleRef}
				/>
				<MapLegend showMmi={showShakemap} sheetSnap={sheetSnap} />
				{state.variant === 'detail-float' && detailNode && (
					<EventDetailFloat>{detailNode}</EventDetailFloat>
				)}
				{SHOW_VARIANT_SWITCHER && (
					<div className="pointer-events-none absolute top-2 right-2 z-20 hidden md:block">
						<div className="pointer-events-auto flex gap-1 rounded-lg border border-border bg-card/85 p-1 text-[10px] backdrop-blur-sm">
							<button
								type="button"
								aria-pressed={state.variant === 'default'}
								onClick={() => handleVariantChange('default')}
								className={cn(
									'rounded-md px-1.5 py-0.5',
									state.variant === 'default'
										? 'bg-muted text-foreground'
										: 'text-muted-foreground'
								)}
							>
								A · sidebar
							</button>
							<button
								type="button"
								aria-pressed={state.variant === 'detail-float'}
								onClick={() => handleVariantChange('detail-float')}
								className={cn(
									'rounded-md px-1.5 py-0.5',
									state.variant === 'detail-float'
										? 'bg-muted text-foreground'
										: 'text-muted-foreground'
								)}
							>
								B · float
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Timeline: solo desktop (Piano 4 T5). Variante mobile compact: Piano 4 T6. */}
			<div className="hidden overflow-hidden border-t border-border md:col-start-2 md:row-start-2 md:flex">
				<Timeline
					events={events}
					window={state.window}
					tMs={tMs}
					nowMs={nowMs}
					isLoading={isLoading}
					hasError={isError}
					onCommit={handleTimeCommit}
					onScrub={handleScrub}
				/>
			</div>

			<MobileSheet
				events={visibleEvents}
				isLoading={isLoading}
				hasError={isError}
				area={state.area}
				window={state.window}
				eventId={state.event}
				nowMs={nowMs}
				listSlot={listSlot}
				snapPoint={sheetSnap}
				onSnapPointChange={setSheetSnap}
				onSelectEvent={handleSelectEvent}
				onAreaWindowChange={handleAreaWindowChange}
			/>
		</div>
	)
}
