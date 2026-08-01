// PROTOTIPO USA-E-GETTA — valida proporzioni/densità della shell. Da eliminare dopo il verdetto (vedi NOTES.md).
'use client'

import type { StyleSpecification } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'

import 'maplibre-gl/dist/maplibre-gl.css'
import { Map, Source, Layer, type MapRef } from 'react-map-gl/maplibre'

type Earthquake = {
	eventId: string
	time: string
	latitude: number
	longitude: number
	depthKm: number
	magnitude: number
	magnitudeType: string
	locationName: string
}

type AreaId = 'italia' | 'campi-flegrei' | 'etna'
type Win = '24h' | '7d'

const AREAS: { id: AreaId; label: string }[] = [
	{ id: 'italia', label: 'TUTTA ITALIA' },
	{ id: 'campi-flegrei', label: 'CAMPI FLEGREI' },
	{ id: 'etna', label: 'ETNA' },
]

const DEFAULT_WIN: Record<AreaId, Win> = { italia: '24h', 'campi-flegrei': '7d', etna: '7d' }

const ACCENT = 'hsl(355 85% 55%)'

const MAP_STYLE: StyleSpecification = {
	version: 8,
	sources: {
		openfreemap: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
	},
	layers: [
		// terra più chiara dell'acqua: è il contrasto che rende leggibile la costa
		{ id: 'background', type: 'background', paint: { 'background-color': '#161616' } },
		{
			id: 'water',
			type: 'fill',
			source: 'openfreemap',
			'source-layer': 'water',
			paint: { 'fill-color': '#0a0a0a' },
		},
		{
			id: 'boundary-country',
			type: 'line',
			source: 'openfreemap',
			'source-layer': 'boundary',
			// maritime=0: esclude i confini marittimi (cerchi/archi in mare aperto)
			filter: ['all', ['==', ['get', 'admin_level'], 2], ['==', ['get', 'maritime'], 0]],
			paint: { 'line-color': 'rgba(255,255,255,0.28)', 'line-width': 1 },
		},
		{
			id: 'boundary-region',
			type: 'line',
			source: 'openfreemap',
			'source-layer': 'boundary',
			filter: ['==', ['get', 'admin_level'], 4],
			paint: { 'line-color': 'rgba(255,255,255,0.10)', 'line-width': 1 },
		},
	],
}

const tnum = { fontFeatureSettings: "'tnum' 1, 'zero' 1" } as const

function relTime(iso: string, now: number): string {
	const min = Math.floor((now - new Date(iso).getTime()) / 60_000)
	if (min < 1) return 'ora'
	if (min < 60) return `${min} min`
	const h = Math.floor(min / 60)
	if (h < 24) return `${h} h`
	return `${Math.floor(h / 24)} g`
}

const dotGrid = {
	backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
	backgroundSize: '14px 14px',
} as const

export function PrototypeShell({
	fontSansVariable,
	fontMonoVariable,
}: {
	fontSansVariable: string
	fontMonoVariable: string
}) {
	const [area, setArea] = useState<AreaId>('italia')
	const [win, setWin] = useState<Win>('24h')
	const [events, setEvents] = useState<Earthquake[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	// null fino al mount: Date.now() in SSR causa hydration mismatch (orologio)
	const [now, setNow] = useState<number | null>(null)
	const mapRef = useRef<MapRef | null>(null)

	useEffect(() => {
		setNow(Date.now())
		const id = setInterval(() => setNow(Date.now()), 1000)
		// PROTOTIPO: debug — il ref c'è dal mount, anche se 'load' non scatta
		;(window as unknown as Record<string, unknown>).__mapref = mapRef
		return () => clearInterval(id)
	}, [])

	useEffect(() => {
		let cancelled = false
		fetch(`/api/events?window=${win}&area=${area}`)
			.then((r) => r.json())
			.then((data) => {
				if (!cancelled) setEvents(data.events ?? [])
			})
		return () => {
			cancelled = true
		}
	}, [area, win])

	function selectArea(next: AreaId) {
		setArea(next)
		setWin(DEFAULT_WIN[next])
		setSelectedId(null)
	}

	const sorted = useMemo(
		() => [...events].sort((a, b) => +new Date(b.time) - +new Date(a.time)),
		[events]
	)
	const mostRecentId = sorted[0]?.eventId ?? null
	const highlightId = selectedId ?? mostRecentId

	const count = events.length
	const maxMag = count ? Math.max(...events.map((e) => e.magnitude)) : null
	const avgDepth = count ? events.reduce((s, e) => s + e.depthKm, 0) / count : null

	const geojson = useMemo(
		() => ({
			type: 'FeatureCollection' as const,
			features: events.map((e) => {
				const ageHours = ((now ?? Date.now()) - new Date(e.time).getTime()) / 3_600_000
				const isHighlight = e.eventId === highlightId
				const opacity = isHighlight
					? 1
					: Math.max(0.35, 1 - (Math.min(ageHours, 12) / 12) * 0.65)
				return {
					type: 'Feature' as const,
					geometry: { type: 'Point' as const, coordinates: [e.longitude, e.latitude] },
					properties: {
						magnitude: e.magnitude,
						color: isHighlight ? ACCENT : '#9a9a9a',
						opacity,
					},
				}
			}),
		}),
		[events, highlightId, now]
	)

	function selectRow(e: Earthquake) {
		setSelectedId(e.eventId)
		mapRef.current?.flyTo({ center: [e.longitude, e.latitude], zoom: 8, duration: 800 })
	}

	const clock = now === null ? '—' : new Date(now).toLocaleTimeString('it-IT', { hour12: false })
	const emptyLabel = `Nessun evento nelle ultime ${win === '24h' ? '24h' : '7 giorni'}`

	return (
		<div
			className={`${fontSansVariable} ${fontMonoVariable} grid h-screen w-screen bg-[#0a0a0a] text-[#ededed]`}
			style={{
				fontFamily: 'var(--font-sans)',
				gridTemplateColumns: '360px 1fr',
				gridTemplateRows: '1fr 72px',
				gridTemplateAreas: "'sidebar map' 'sidebar timeline'",
			}}
		>
			{/* Sidebar */}
			<div
				className="flex flex-col gap-2 overflow-hidden bg-[#0e0e0e] p-2"
				style={{ gridArea: 'sidebar' }}
			>
				{/* 1. Header */}
				<div className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#131313] px-3 py-2.5">
					<span className="text-xs font-semibold tracking-widest text-[#ededed]">
						QUAKEWATCH
					</span>
					<div className="flex items-center gap-1.5">
						<span
							className="h-1.5 w-1.5 rounded-full"
							style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }}
						/>
						<span
							className="text-[11px] text-[#8a8a8a]"
							style={{ fontFamily: 'var(--font-mono)', ...tnum }}
						>
							agg. {clock}
						</span>
					</div>
				</div>

				{/* 2. Riepilogo */}
				<div className="grid grid-cols-3 gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#131313] px-3 py-3">
					<Stat label="eventi" value={String(count)} />
					<Stat label="mag. max" value={maxMag !== null ? maxMag.toFixed(1) : '—'} />
					<Stat
						label="prof. media"
						value={avgDepth !== null ? `${avgDepth.toFixed(1)} km` : '—'}
					/>
				</div>

				{/* 3. Preset + window toggle */}
				<div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#131313] p-2">
					<div className="flex items-center justify-between gap-2">
						<div className="flex flex-1 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.07)]">
							{AREAS.map((a) => (
								<button
									key={a.id}
									type="button"
									onClick={() => selectArea(a.id)}
									className="flex-1 px-1.5 py-1.5 text-center text-[10px] tracking-wide"
									style={{
										background: area === a.id ? 'rgba(255,255,255,0.08)' : 'transparent',
										color: area === a.id ? '#ededed' : '#8a8a8a',
									}}
								>
									{a.label}
								</button>
							))}
						</div>
						<div
							className="flex overflow-hidden rounded-lg border border-[rgba(255,255,255,0.07)]"
							style={{ fontFamily: 'var(--font-mono)' }}
						>
							{(['24h', '7d'] as const).map((w) => (
								<button
									key={w}
									type="button"
									onClick={() => setWin(w)}
									className="px-2 py-1.5 text-[10px]"
									style={{
										background: win === w ? 'rgba(255,255,255,0.08)' : 'transparent',
										color: win === w ? '#ededed' : '#8a8a8a',
									}}
								>
									{w === '24h' ? '24H' : '7G'}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* 4. Lista eventi */}
				<div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#131313]">
					{sorted.length === 0 ? (
						<div
							className="flex flex-1 items-center justify-center text-center text-xs text-[#8a8a8a]"
							style={dotGrid}
						>
							{emptyLabel}
						</div>
					) : (
						<div className="flex-1 overflow-y-auto">
							{sorted.map((e) => {
								const isHighlight = e.eventId === highlightId
								return (
									<button
										key={e.eventId}
										type="button"
										onClick={() => selectRow(e)}
										className="flex w-full items-center gap-2 border-b border-[rgba(255,255,255,0.05)] px-3 py-2 text-left last:border-b-0"
										style={{
											background: isHighlight
												? 'rgba(226, 30, 60, 0.08)'
												: 'transparent',
											borderLeft: isHighlight
												? `2px solid ${ACCENT}`
												: '2px solid transparent',
										}}
									>
										<span
											className="w-9 shrink-0 text-[15px]"
											style={{
												fontFamily: 'var(--font-mono)',
												...tnum,
												color: isHighlight ? ACCENT : '#ededed',
											}}
										>
											{e.magnitude.toFixed(1)}
										</span>
										<span className="min-w-0 flex-1 truncate text-[13px] text-[#ededed]">
											{e.locationName}
										</span>
										<span
											className="shrink-0 text-[11px] text-[#8a8a8a]"
											style={{ fontFamily: 'var(--font-mono)', ...tnum }}
										>
											{now === null ? '' : relTime(e.time, now)}
										</span>
										<span
											className="w-16 shrink-0 text-right text-[11px] text-[#8a8a8a]"
											style={{ fontFamily: 'var(--font-mono)', ...tnum }}
										>
											{e.depthKm.toFixed(1)} km
										</span>
										<span className="shrink-0 rounded-sm border border-[rgba(255,255,255,0.15)] px-1 py-0.5 text-[9px] uppercase tracking-wide text-[#8a8a8a]">
											preliminare
										</span>
									</button>
								)
							})}
						</div>
					)}
				</div>

				{/* 5. Footer */}
				<div className="px-1 py-1 text-[10px] text-[#8a8a8a]">
					INGV — Osservatorio Nazionale Terremoti · dati preliminari soggetti a revisione
				</div>
			</div>

			{/* Map */}
			<div style={{ gridArea: 'map' }}>
				<Map
					ref={mapRef}
					initialViewState={{ longitude: 12.5, latitude: 42.3, zoom: 5.3 }}
					mapStyle={MAP_STYLE}
					style={{ width: '100%', height: '100%' }}
					onLoad={(e) => {
						// PROTOTIPO: debug hook per ispezione da console
						;(window as unknown as Record<string, unknown>).__map = e.target
					}}
					onError={(e) => {
						// PROTOTIPO: gli errori maplibre non arrivano in console da soli
						console.error('MAPLIBRE ERROR:', e.error?.message ?? e)
					}}
				>
					<Source id="events" type="geojson" data={geojson}>
						<Layer
							id="events-circle"
							type="circle"
							paint={{
								'circle-radius': ['+', 3, ['*', ['get', 'magnitude'], 2.2]],
								'circle-color': ['get', 'color'],
								'circle-opacity': ['get', 'opacity'],
								'circle-stroke-width': 1,
								'circle-stroke-color': 'rgba(0,0,0,0.6)',
							}}
						/>
					</Source>
				</Map>
			</div>

			{/* Timeline slot */}
			<div
				className="relative flex items-center overflow-hidden border-t border-[rgba(255,255,255,0.07)] px-4"
				style={{ gridArea: 'timeline', ...dotGrid }}
			>
				<span
					className="text-[11px] uppercase tracking-widest text-[#8a8a8a]"
					style={{ fontFamily: 'var(--font-mono)' }}
				>
					TIMELINE · PIANO 3
				</span>
				<div className="absolute right-6 top-0 h-full w-px" style={{ background: ACCENT }} />
			</div>
		</div>
	)
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span
				className="text-[19px] leading-none"
				style={{ fontFamily: 'var(--font-mono)', ...tnum }}
			>
				{value}
			</span>
			<span className="text-[9px] uppercase tracking-wide text-[#8a8a8a]">{label}</span>
		</div>
	)
}
