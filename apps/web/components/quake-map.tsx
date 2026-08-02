'use client'

import type { Earthquake } from '@quakewatch/core'
import { RED, SEMANTIC_TOKENS, buildMapStyle, type ThemeName } from '@quakewatch/tokens'
import type { StyleSpecification } from 'maplibre-gl'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useRef, useState } from 'react'

import 'maplibre-gl/dist/maplibre-gl.css'
import { Layer, Map, Source, type MapRef } from 'react-map-gl/maplibre'

export interface QuakeMapProps {
	events: Earthquake[]
	selectedId: string | null
	onSelect: (eventId: string) => void
	/** Pulse è l'affordance della modalità live: gate aggiuntivo insieme all'età <24h. */
	isLive: boolean
}

const CENTER: [number, number] = [12.5, 42.3]
const ZOOM = 5.3
// Italia allargata (Sardegna/Sicilia/Alpi comprese): evita che il pan finisca nell'Atlantico.
const MAX_BOUNDS: [number, number, number, number] = [0, 33, 22, 49]

const MAX_AGE_HOURS = 12
const MIN_AGED_OPACITY = 0.35
const PULSE_WINDOW_MS = 24 * 3_600_000
const PULSE_CYCLE_MS = 2400

function toThemeName(resolvedTheme: string | undefined): ThemeName {
	return resolvedTheme === 'light' ? 'theme-light' : 'theme-dark'
}

export function QuakeMap({ events, selectedId, onSelect, isLive }: QuakeMapProps) {
	// resolvedTheme è undefined in SSR: default 'theme-dark' finché non montato (lezione header.tsx).
	const { resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const themeName: ThemeName = mounted ? toThemeName(resolvedTheme) : 'theme-dark'

	// buildMapStyle ha un tipo MapStyle "leggero" (per non far dipendere @quakewatch/tokens da
	// maplibre-gl): stessa forma dello style MapLibre reale, cast esplicito verso il tipo atteso.
	const mapStyle = useMemo(
		() => buildMapStyle(themeName) as unknown as StyleSpecification,
		[themeName]
	)
	// Nero costante nei due temi (stesso token dello scrim overlay): lo stroke resta scuro sempre.
	const strokeColor = SEMANTIC_TOKENS[themeName].overlay as string
	const neutralColor = SEMANTIC_TOKENS[themeName]['muted-foreground'] as string

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
							color: isSelected ? RED[500] : neutralColor,
							opacity,
							isPulse: e.eventId === pulse,
						},
					}
				}),
			},
		}
	}, [events, selectedId, neutralColor, isLive])

	// Selezione ESTERNA (dalla lista) → flyTo. Il click diretto su un marker è già a vista:
	// suppressFlyToRef marca l'eventId appena selezionato da un click sulla mappa, l'effect lo
	// consuma e salta il flyTo per quel giro (non è una "selezione esterna").
	const eventsRef = useRef(events)
	eventsRef.current = events
	const suppressFlyToRef = useRef<string | null>(null)
	useEffect(() => {
		if (!mapLoaded || !selectedId) return
		if (suppressFlyToRef.current === selectedId) {
			suppressFlyToRef.current = null
			return
		}
		const event = eventsRef.current.find((e) => e.eventId === selectedId)
		if (!event) return
		mapRef.current?.flyTo({ center: [event.longitude, event.latitude], zoom: 8, duration: 800 })
	}, [selectedId, mapLoaded])

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

	return (
		<Map
			ref={mapRef}
			initialViewState={{ longitude: CENTER[0], latitude: CENTER[1], zoom: ZOOM }}
			mapStyle={mapStyle}
			maxBounds={MAX_BOUNDS}
			style={{ width: '100%', height: '100%' }}
			interactiveLayerIds={['events-circle']}
			cursor={hovering ? 'pointer' : undefined}
			onMouseEnter={() => setHovering(true)}
			onMouseLeave={() => setHovering(false)}
			onClick={(e) => {
				const eventId = e.features?.[0]?.properties?.eventId
				if (typeof eventId === 'string') {
					suppressFlyToRef.current = eventId
					onSelect(eventId)
				}
			}}
			onLoad={() => setMapLoaded(true)}
			onError={(e) => console.error('MAPLIBRE ERROR:', e.error?.message ?? e)}
		>
			<Source id="events" type="geojson" data={geojson}>
				<Layer
					id="events-pulse"
					type="circle"
					filter={['==', ['get', 'isPulse'], true]}
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
					paint={{
						'circle-radius': ['+', 3, ['*', ['get', 'magnitude'], 2.2]],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['get', 'opacity'],
						'circle-stroke-width': 1,
						'circle-stroke-color': strokeColor,
						'circle-stroke-opacity': 0.6,
					}}
				/>
			</Source>
		</Map>
	)
}
