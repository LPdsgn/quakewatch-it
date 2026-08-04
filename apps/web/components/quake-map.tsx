'use client'

import { useShakemapQuery, type Earthquake } from '@quakewatch/core'
import {
	MAGNITUDE_COLORS,
	RED,
	SEMANTIC_TOKENS,
	buildMapStyle,
	magnitudeClassOf,
	type Basemap,
	type ThemeName,
} from '@quakewatch/tokens'
import type { StyleSpecification } from 'maplibre-gl'
import { useTheme } from 'next-themes'
import { type Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import 'maplibre-gl/dist/maplibre-gl.css'
import { Layer, Map, Source, type MapRef } from 'react-map-gl/maplibre'

import { usePersistentPref } from '@/hooks/use-persistent-pref'
import { toThemeName } from '@/lib/theme'
import { timeFilterExpression } from '@/lib/timeline'

export interface QuakeMapProps {
	events: Earthquake[]
	selectedId: string | null
	onSelect: (eventId: string) => void
	/** Pulse è l'affordance della modalità live: gate aggiuntivo insieme all'età <24h. */
	isLive: boolean
	/** Toggle dal dettaglio evento (T5): mostra i contorni ShakeMap dell'evento selezionato. */
	showShakemap: boolean
	/** Filtro temporale dichiarativo (da ?t committato in URL): eventi con timeMs oltre non renderizzati. */
	timeFilterMs?: number | null
	/** Handle imperativo per lo scrub (drag): applica il filtro sui layer senza passare da React state. */
	handleRef?: Ref<QuakeMapHandle>
	/** Padding per flyTo su mobile quando il drawer è aperto: centra il marker nell'area visibile
	 *  tra gli elementi fissi in alto e il bordo superiore del drawer. undefined su desktop. */
	flyToPadding?: { top: number; bottom: number }
}

export interface QuakeMapHandle {
	/** Applica il filtro tempo direttamente sui layer (drag: zero re-render React). */
	setTimeFilter(tMs: number | null): void
}

// I layer hanno già filtri propri (pulse: isPulse; ring: eventId): il filtro tempo si compone
// in AND. MapLibre accetta expression annidate in ['all', ...].
function composeFilters(base: unknown[] | null, tMs: number | null): unknown[] | undefined {
	const time = timeFilterExpression(tMs)
	if (base && time) return ['all', base, time]
	return base ?? time ?? undefined
}

const CENTER: [number, number] = [12.5, 42.3]
const ZOOM = 5.3
// Italia allargata (Sardegna/Sicilia/Alpi comprese): evita che il pan finisca nell'Atlantico.
const MAX_BOUNDS: [number, number, number, number] = [0, 33, 22, 49]

const MAX_AGE_HOURS = 12
const MIN_AGED_OPACITY = 0.35
const PULSE_WINDOW_MS = 24 * 3_600_000
const PULSE_CYCLE_MS = 2400

export function QuakeMap({
	events,
	selectedId,
	onSelect,
	isLive,
	showShakemap,
	timeFilterMs,
	handleRef,
	flyToPadding,
}: QuakeMapProps) {
	// resolvedTheme è undefined in SSR: default 'theme-dark' finché non montato (lezione header.tsx).
	const { resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const themeName: ThemeName = mounted ? toThemeName(resolvedTheme) : 'theme-dark'

	const [basemap] = usePersistentPref<Basemap>('basemap', 'minimal')

	// buildMapStyle ha un tipo MapStyle "leggero" (per non far dipendere @quakewatch/tokens da
	// maplibre-gl): stessa forma dello style MapLibre reale, cast esplicito verso il tipo atteso.
	const mapStyle = useMemo(
		() => buildMapStyle(themeName, basemap) as unknown as StyleSpecification,
		[themeName, basemap]
	)
	const foregroundColor = SEMANTIC_TOKENS[themeName].foreground as string
	const magnitudeColors = MAGNITUDE_COLORS[themeName]

	// Condivide la cache con l'hook già montato in EventDetail (stesso queryKey): qui abilitato solo
	// a toggle attivo, niente fetch duplicata (staleTime 300s copre il giro toggle on/off).
	const { data: shakemapContours } = useShakemapQuery(selectedId, showShakemap)

	const mapRef = useRef<MapRef | null>(null)
	const [mapLoaded, setMapLoaded] = useState(false)
	const [hovering, setHovering] = useState(false)
	const [reducedMotion, setReducedMotion] = useState(false)

	useEffect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
		setReducedMotion(mq.matches)
		const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
		mq.addEventListener('change', onChange)
		return () => mq.removeEventListener('change', onChange)
	}, [])

	// Ricalcola SOLO su cambio eventi/selezione/tema — mai a ogni tick dell'orologio.
	// L'età per l'opacity usa Date.now() come bucket "congelato" al momento del calcolo,
	// non un valore che ticchetta (lezione prototipo: niente churn di setData).
	const { geojson, pulseId } = useMemo(() => {
		const now = Date.now()
		let mostRecent: Earthquake | null = null
		for (const e of events) {
			if (!mostRecent || e.time > mostRecent.time) mostRecent = e
		}
		const pulse =
			isLive && mostRecent && now - new Date(mostRecent.time).getTime() < PULSE_WINDOW_MS
				? mostRecent.eventId
				: null

		return {
			pulseId: pulse,
			geojson: {
				type: 'FeatureCollection' as const,
				features: events.map((e) => {
					const isSelected = e.eventId === selectedId
					const ageHours = (now - new Date(e.time).getTime()) / 3_600_000
					const opacity = isSelected
						? 1
						: Math.max(
								MIN_AGED_OPACITY,
								1 -
									(Math.min(ageHours, MAX_AGE_HOURS) / MAX_AGE_HOURS) *
										(1 - MIN_AGED_OPACITY)
							)
					return {
						type: 'Feature' as const,
						geometry: { type: 'Point' as const, coordinates: [e.longitude, e.latitude] },
						properties: {
							eventId: e.eventId,
							magnitude: e.magnitude,
							color: magnitudeColors[magnitudeClassOf(e.magnitude).id],
							opacity,
							isPulse: e.eventId === pulse,
							timeMs: new Date(e.time).getTime(),
						},
					}
				}),
			},
		}
	}, [events, selectedId, magnitudeColors, isLive])

	// Selezione ESTERNA (dalla lista) → flyTo. Il click diretto su un marker è già a vista:
	// suppressFlyToRef marca l'eventId appena selezionato da un click sulla mappa, l'effect lo
	// consuma e salta il flyTo per quel giro (non è una "selezione esterna").
	const eventsRef = useRef(events)
	eventsRef.current = events
	const selectedIdRef = useRef(selectedId)
	selectedIdRef.current = selectedId
	const suppressFlyToRef = useRef<string | null>(null)
	useEffect(() => {
		if (!mapLoaded || !selectedId) return
		if (suppressFlyToRef.current === selectedId) {
			suppressFlyToRef.current = null
			return
		}
		const event = eventsRef.current.find((e) => e.eventId === selectedId)
		if (!event) return
		mapRef.current?.flyTo({
			center: [event.longitude, event.latitude] as [number, number],
			zoom: 8,
			duration: 800,
			...(flyToPadding && { padding: flyToPadding }),
		})
	}, [selectedId, mapLoaded, flyToPadding])

	// Pulse: un solo layer, raggio/opacity animati via RAF su un paint property imperativo
	// (non tramite React state — eviterebbe re-render a 60fps). Sobrio: 1 ciclo ~2.4s, disabilitato
	// da matchMedia prefers-reduced-motion (ascoltato anche a runtime, non solo al mount).
	useEffect(() => {
		if (!mapLoaded || !pulseId || reducedMotion) return
		const map = mapRef.current?.getMap()
		if (!map) return

		let rafId: number
		const start = performance.now()
		// Arrow function (non hoisted): TS conserva il narrowing di `map` nella closure.
		const tick = (now: number) => {
			if (map.getLayer('events-pulse')) {
				const t = ((now - start) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS
				map.setPaintProperty('events-pulse', 'circle-radius', 6 + t * 18)
				map.setPaintProperty('events-pulse', 'circle-opacity', 0.55 * (1 - t))
			}
			rafId = requestAnimationFrame(tick)
		}
		rafId = requestAnimationFrame(tick)

		return () => {
			cancelAnimationFrame(rafId)
			if (map.getLayer('events-pulse')) map.setPaintProperty('events-pulse', 'circle-opacity', 0)
		}
	}, [mapLoaded, pulseId, reducedMotion])

	// Percorso imperativo per lo scrub del drag: stessa composeFilters del rendering dichiarativo,
	// così il re-render a fine drag (nuovo timeFilterMs da props) riallinea senza discontinuità.
	useImperativeHandle(handleRef, () => ({
		setTimeFilter(tMs) {
			const map = mapRef.current?.getMap()
			if (!map?.getLayer('events-circle')) return
			map.setFilter('events-circle', composeFilters(null, tMs) as never)
			map.setFilter(
				'events-pulse',
				composeFilters(['==', ['get', 'isPulse'], true], tMs) as never
			)
			map.setFilter(
				'events-selected-ring',
				composeFilters(['==', ['get', 'eventId'], selectedIdRef.current ?? ''], tMs) as never
			)
		},
	}))

	return (
		<Map
			ref={mapRef}
			initialViewState={{ longitude: CENTER[0], latitude: CENTER[1], zoom: ZOOM }}
			mapStyle={mapStyle}
			maxBounds={MAX_BOUNDS}
			style={{ width: '100%', height: '100%' }}
			interactiveLayerIds={['events-circle']}
			cursor={hovering ? 'pointer' : undefined}
			// Aggiunge l'attribuzione INGV a quella dei tile (non la sostituisce): deve restare
			// visibile in ogni snap state mobile, incluso PEEK (vincolo non negoziabile).
			// Quando terrain è attivo, include anche l'attribuzione SRTM.
			attributionControl={{
				customAttribution:
					basemap === 'terrain'
						? 'Dati INGV — Osservatorio Nazionale Terremoti | SRTM — AWS Terrarium'
						: 'Dati INGV — Osservatorio Nazionale Terremoti',
			}}
			onMouseEnter={() => setHovering(true)}
			onMouseLeave={() => setHovering(false)}
			onClick={(e) => {
				const eventId = e.features?.[0]?.properties?.eventId
				if (typeof eventId === 'string') {
					// Solo se cambia selezione: ri-click sul marker già selezionato non deve marcare
					// il ref (selectedId non cambierebbe, l'effect non lo consumerebbe mai, e una
					// futura selezione esterna dello stesso evento troverebbe un ref stantio).
					// Su mobile (flyToPadding presente) non si sopprime: il flyTo centra il marker
					// nell'area visibile sopra il drawer aperto.
					if (eventId !== selectedId && !flyToPadding) suppressFlyToRef.current = eventId
					onSelect(eventId)
				}
			}}
			onLoad={() => setMapLoaded(true)}
			onError={(e) => console.error('MAPLIBRE ERROR:', e.error?.message ?? e)}
		>
			{showShakemap && shakemapContours && (
				<Source id="shakemap" type="geojson" data={shakemapContours}>
					{/* beforeId, non l'ordine JSX, decide lo stacking: sotto events-pulse → sotto
					    tutti i layer epicentro. weight non è garantito a runtime dalla guardia
					    isShakemapContours: coalesce a 1 prima del cap a 3. */}
					<Layer
						id="shakemap-contours"
						type="line"
						beforeId="events-pulse"
						paint={{
							'line-color': ['get', 'color'],
							'line-width': ['min', ['coalesce', ['get', 'weight'], 1], 3],
							'line-opacity': 0.9,
						}}
					/>
				</Source>
			)}
			<Source id="events" type="geojson" data={geojson}>
				<Layer
					id="events-pulse"
					type="circle"
					// base sempre presente ('isPulse'): composeFilters non torna mai undefined qui.
					filter={
						composeFilters(['==', ['get', 'isPulse'], true], timeFilterMs ?? null) as never
					}
					paint={{
						'circle-radius': 6,
						'circle-color': RED[500],
						'circle-opacity': 0,
						'circle-stroke-width': 0,
					}}
				/>
				<Layer
					id="events-circle"
					type="circle"
					{...(() => {
						const f = composeFilters(null, timeFilterMs ?? null)
						return f ? { filter: f as never } : {}
					})()}
					paint={{
						'circle-radius': ['+', 3, ['*', ['get', 'magnitude'], 2.2]],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['get', 'opacity'],
					}}
				/>
				<Layer
					id="events-selected-ring"
					type="circle"
					// base sempre presente (eventId, anche vuoto): composeFilters non torna mai undefined qui.
					// Composto in render da selectedId + timeFilterMs → si aggiorna reattivamente a entrambi.
					filter={
						composeFilters(
							['==', ['get', 'eventId'], selectedId ?? ''],
							timeFilterMs ?? null
						) as never
					}
					paint={{
						'circle-radius': ['+', 6, ['*', ['get', 'magnitude'], 2.2]],
						'circle-opacity': 0,
						'circle-stroke-width': 2,
						'circle-stroke-color': foregroundColor,
					}}
				/>
			</Source>
		</Map>
	)
}
