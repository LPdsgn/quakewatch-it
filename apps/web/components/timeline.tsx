'use client'

import type { Earthquake, TimeWindow } from '@quakewatch/core'
import { MAGNITUDE_CLASSES, MAGNITUDE_COLORS, type ThemeName } from '@quakewatch/tokens'
import { animate, createScope } from 'animejs'
import { useTheme } from 'next-themes'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toThemeName } from '@/lib/theme'
import { binEvents, clampT, type TimelineBin } from '@/lib/timeline'

export interface TimelineProps {
	/** Eventi NON filtrati della finestra. */
	events: Earthquake[]
	window: TimeWindow
	/** Cursore committato (ms); null = live. */
	tMs: number | null
	/** Orologio condiviso; null finché non montato → skeleton. */
	nowMs: number | null
	isLoading: boolean
	hasError: boolean
	/** Commit (rilascio drag, click, tastiera, bottone LIVE): epoch SECONDI o null=live. */
	onCommit: (tSec: number | null) => void
	/** Livello imperativo durante il drag (mappa via QuakeMapHandle). */
	onScrub: (tMs: number | null) => void
	/** Variante mobile (T6): altezza ridotta, niente tooltip, readout solo in storica/drag. */
	compact?: boolean
}

// Altezza SVG dell'istogramma: allineata allo Skeleton dello stato loading (h-8 = 32px).
const ROW_HEIGHT = 32

const READOUT_FORMAT = new Intl.DateTimeFormat('it-IT', {
	timeZone: 'Europe/Rome',
	dateStyle: 'short',
	timeStyle: 'short',
})

function formatReadout(ms: number): string {
	return READOUT_FORMAT.format(ms)
}

/** sqrt(count/max) satura la coda: un bin con 10x gli eventi non deve essere 10x più alto. */
function heightOf(bin: TimelineBin, maxCount: number): number {
	if (bin.count === 0) return 0
	return Math.max(2, Math.sqrt(bin.count / maxCount) * (ROW_HEIGHT - 2))
}

/**
 * Riga timeline: istogramma bin per classe di magnitudo, cursore scrub (mouse/tastiera),
 * controllo LIVE. Mappatura tempo↔x pura derivata da bins[0]/nowMs (mai da un binWidth
 * fisso: i bin giornalieri di 90d sono 23h/25h nei giorni di cambio ora).
 */
export function Timeline({
	events,
	window: timeWindow,
	tMs,
	nowMs,
	isLoading,
	hasError,
	onCommit,
	onScrub,
	compact = false,
}: TimelineProps): ReactNode {
	// resolvedTheme è undefined in SSR: default 'theme-dark' finché non montato (map-legend.tsx:92-96).
	const { resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const themeName: ThemeName = mounted ? toThemeName(resolvedTheme) : 'theme-dark'
	const colors = MAGNITUDE_COLORS[themeName]

	const [reducedMotion, setReducedMotion] = useState(false)
	useEffect(() => {
		const mq = globalThis.matchMedia('(prefers-reduced-motion: reduce)')
		setReducedMotion(mq.matches)
		const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
		mq.addEventListener('change', onChange)
		return () => mq.removeEventListener('change', onChange)
	}, [])

	const containerRef = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (entry) setWidth(entry.contentRect.width)
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	// nowMs "congelato" del clock condiviso: ricalcola i bin solo quando cambiano eventi/finestra/tick.
	const bins = useMemo(
		() => (nowMs === null ? [] : binEvents(events, timeWindow, nowMs)),
		[events, timeWindow, nowMs]
	)
	const maxCount = useMemo(() => Math.max(1, ...bins.map((b) => b.count)), [bins])

	const [dragMs, setDragMs] = useState<number | null>(null)
	const [hoverIndex, setHoverIndex] = useState<number | null>(null)
	const [sliderFocused, setSliderFocused] = useState(false)

	const readoutLabelId = useId()

	// Mappatura tempo↔x (pura): dominio dai confini reali del primo bin e dal now condiviso.
	const domainStart = bins[0]?.startMs ?? nowMs ?? 0
	const domainEnd = nowMs ?? 0
	const msToX = (ms: number) => {
		if (width === 0 || domainEnd === domainStart) return width
		return ((ms - domainStart) / (domainEnd - domainStart)) * width
	}
	const xToMs = (x: number) => {
		if (width === 0 || domainEnd === domainStart) return domainStart
		return domainStart + (x / width) * (domainEnd - domainStart)
	}

	const isLive = dragMs === null && tMs === null
	const cursorMs = dragMs ?? tMs ?? domainEnd

	// Scope anime.js: un solo root per il componente, revert() alla dismount pulisce
	// eventuali tween in corso (stile inline residuo). Solo due animazioni gestite qui:
	// snap-back del cursore al ritorno live e transizione altezze bin al cambio finestra.
	const rectRefs = useRef<(SVGRectElement | null)[]>([])
	const cursorLineRef = useRef<SVGLineElement>(null)
	const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)
	useEffect(() => {
		scopeRef.current = createScope({ root: containerRef.current ?? undefined })
		return () => scopeRef.current?.revert()
	}, [])

	// Transizione altezze rect al cambio finestra: cattura le altezze precedenti (stesso indice
	// di posizione, non stesso bin semantico — il cambio finestra cambia comunque la scala) e le
	// anima verso quelle nuove. Nessuna animazione durante il drag né a ogni tick del clock.
	const prevWindowRef = useRef(timeWindow)
	const prevHeightsRef = useRef<number[]>([])
	useLayoutEffect(() => {
		if (prevWindowRef.current !== timeWindow && !reducedMotion) {
			const oldHeights = prevHeightsRef.current
			rectRefs.current.forEach((rect, i) => {
				if (!rect) return
				const bin = bins[i]
				const from = oldHeights[i]
				if (!bin || from === undefined) return
				const to = heightOf(bin, maxCount)
				if (from === to) return
				rect.setAttribute('height', String(from))
				rect.setAttribute('y', String(ROW_HEIGHT - from))
				scopeRef.current?.add(() => {
					animate(rect, { height: to, y: ROW_HEIGHT - to, duration: 300, ease: 'outQuad' })
				})
			})
		}
		prevWindowRef.current = timeWindow
		prevHeightsRef.current = bins.map((bin) => heightOf(bin, maxCount))
	}, [bins, timeWindow, reducedMotion, maxCount])

	// Snap-back del cursore al bordo destro quando si torna live: cattura la x precedente
	// (ultimo render prima della transizione) e la anima verso il bordo. Nessun effetto durante
	// il drag: il cursore segue il pointer 1:1, l'animazione scatta solo sul fronte storica→live.
	const prevIsLiveRef = useRef(isLive)
	const prevCursorXRef = useRef(0)
	useLayoutEffect(() => {
		const cursorX = msToX(cursorMs)
		const line = cursorLineRef.current
		const justWentLive = !prevIsLiveRef.current && isLive
		if (line && justWentLive && !reducedMotion) {
			const fromX = prevCursorXRef.current
			line.setAttribute('x1', String(fromX))
			line.setAttribute('x2', String(fromX))
			scopeRef.current?.add(() => {
				animate(line, { x1: cursorX, x2: cursorX, duration: 300, ease: 'outQuad' })
			})
		}
		prevIsLiveRef.current = isLive
		prevCursorXRef.current = cursorX
	})

	if (isLoading || nowMs === null) {
		return (
			<div className="flex h-10 items-center border-t border-border px-4">
				<Skeleton className="h-8 w-full" />
			</div>
		)
	}

	if (hasError || events.length === 0) {
		return (
			<div className="dot-grid flex h-10 items-center justify-center border-t border-border px-4 text-center">
				<span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
					{hasError ? 'Dati non disponibili al momento.' : 'Nessun evento nella finestra'}
				</span>
			</div>
		)
	}

	const readout = isLive ? 'LIVE' : formatReadout(cursorMs)

	// nowMs è number oltre questo punto (early return sopra): helper tastiera/drag possono
	// usarlo senza fallback.
	const now = nowMs

	function indexOfBin(ms: number): number {
		const i = bins.findIndex((b) => ms >= b.startMs && ms < b.endMs)
		return i === -1 ? bins.length - 1 : i
	}

	// Naviga per indice di bin reale (non per stride fisso): sui bin giornalieri di 90d
	// (23h/25h nei giorni di cambio ora) uno step in millisecondi fisso deriverebbe dai
	// confini veri; camminare sull'array bins funziona identicamente per tutte le finestre.
	function commitBinIndex(rawIndex: number) {
		const i = Math.max(0, Math.min(bins.length - 1, rawIndex))
		const bin = bins[i]
		if (!bin) return
		onCommit(clampT(Math.floor(bin.startMs / 1000), now, timeWindow))
	}

	function clampDragMs(ms: number): number {
		return Math.min(Math.max(ms, domainStart), domainEnd)
	}

	const tooltipIndex = compact
		? null
		: (hoverIndex ?? (sliderFocused ? indexOfBin(cursorMs) : null))
	const tooltipBin = tooltipIndex !== null ? bins[tooltipIndex] : undefined

	return (
		<div className="flex h-10 items-center gap-3 border-t border-border px-4">
			<span className="font-mono text-[11px] text-muted-foreground" data-numeric>
				{readout}
			</span>

			<div ref={containerRef} className="relative h-8 flex-1">
				<svg
					width="100%"
					height={ROW_HEIGHT}
					viewBox={`0 0 ${width} ${ROW_HEIGHT}`}
					preserveAspectRatio="none"
					className="block touch-none cursor-ew-resize select-none"
					onPointerDown={(e) => {
						e.currentTarget.setPointerCapture(e.pointerId)
						const rect = e.currentTarget.getBoundingClientRect()
						const ms = clampDragMs(xToMs(e.clientX - rect.left))
						setDragMs(ms)
						onScrub(ms)
					}}
					onPointerMove={(e) => {
						if (dragMs === null) return
						const rect = e.currentTarget.getBoundingClientRect()
						const ms = clampDragMs(xToMs(e.clientX - rect.left))
						setDragMs(ms)
						onScrub(ms)
					}}
					onPointerUp={() => {
						if (dragMs === null) return
						onCommit(clampT(Math.floor(dragMs / 1000), now, timeWindow))
						setDragMs(null)
					}}
					onPointerCancel={() => setDragMs(null)}
				>
					{bins.map((bin, i) => {
						const x1 = msToX(bin.startMs)
						const x2 = msToX(bin.endMs)
						const barHeight = heightOf(bin, maxCount)
						const beyondCursor = bin.startMs > cursorMs
						return (
							<g
								key={bin.startMs}
								{...(!compact
									? {
											onPointerEnter: () => setHoverIndex(i),
											onPointerLeave: () =>
												setHoverIndex((cur) => (cur === i ? null : cur)),
										}
									: {})}
							>
								{/* Hit-layer invisibile a tutta altezza: target hover più comodo del
								    mark sottile, copre anche lo spazio sopra un bin basso/vuoto. */}
								{!compact && (
									<rect
										x={x1}
										y={0}
										width={Math.max(0, x2 - x1)}
										height={ROW_HEIGHT}
										fill="transparent"
										style={{ pointerEvents: 'all' }}
									/>
								)}
								{bin.count > 0 && bin.maxClassId && (
									<rect
										ref={(el) => {
											rectRefs.current[i] = el
										}}
										x={x1 + 0.5}
										y={ROW_HEIGHT - barHeight}
										width={Math.max(0, x2 - x1 - 1)}
										height={barHeight}
										fill={colors[bin.maxClassId]}
										opacity={beyondCursor ? 0.25 : 1}
									/>
								)}
							</g>
						)
					})}
					<line
						ref={cursorLineRef}
						x1={msToX(cursorMs)}
						x2={msToX(cursorMs)}
						y1={0}
						y2={ROW_HEIGHT}
						strokeWidth={2}
						className="stroke-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						role="slider"
						tabIndex={0}
						aria-labelledby={readoutLabelId}
						aria-valuemin={Math.floor(domainStart / 1000)}
						aria-valuemax={Math.floor(domainEnd / 1000)}
						aria-valuenow={Math.floor(cursorMs / 1000)}
						aria-valuetext={readout}
						onFocus={() => setSliderFocused(true)}
						onBlur={() => setSliderFocused(false)}
						onKeyDown={(e) => {
							const currentIndex = indexOfBin(cursorMs)
							switch (e.key) {
								case 'ArrowLeft':
									e.preventDefault()
									commitBinIndex(currentIndex - 1)
									return
								case 'ArrowRight':
									e.preventDefault()
									if (currentIndex >= bins.length - 1) onCommit(null)
									else commitBinIndex(currentIndex + 1)
									return
								case 'PageUp':
									e.preventDefault()
									commitBinIndex(currentIndex - 10)
									return
								case 'PageDown':
									e.preventDefault()
									if (currentIndex + 10 >= bins.length - 1) onCommit(null)
									else commitBinIndex(currentIndex + 10)
									return
								case 'Home':
									e.preventDefault()
									commitBinIndex(0)
									return
								case 'End':
									e.preventDefault()
									onCommit(null)
									return
								default:
									return
							}
						}}
					/>
				</svg>

				{tooltipBin && (
					<div
						className="pointer-events-none absolute bottom-full z-10 mb-1.5 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-[10px] leading-tight whitespace-nowrap text-foreground shadow-sm"
						style={{ left: (msToX(tooltipBin.startMs) + msToX(tooltipBin.endMs)) / 2 }}
					>
						<div className="font-mono" data-numeric>
							{formatReadout(tooltipBin.startMs)} – {formatReadout(tooltipBin.endMs)}
						</div>
						<div>
							<span data-numeric>{tooltipBin.count}</span>{' '}
							{tooltipBin.count === 1 ? 'evento' : 'eventi'}
						</div>
						{tooltipBin.maxClassId && (
							<div className="font-medium">
								{MAGNITUDE_CLASSES.find((c) => c.id === tooltipBin.maxClassId)?.label}
							</div>
						)}
					</div>
				)}
			</div>

			{isLive ? (
				<span
					id={readoutLabelId}
					className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-primary"
					aria-current="true"
				>
					<span className="size-1.5 rounded-full bg-primary" />
					LIVE
				</span>
			) : (
				<>
					<span id={readoutLabelId} className="sr-only">
						Cursore timeline
					</span>
					<Button type="button" variant="outline" size="xs" onClick={() => onCommit(null)}>
						● LIVE
					</Button>
				</>
			)}
		</div>
	)
}
