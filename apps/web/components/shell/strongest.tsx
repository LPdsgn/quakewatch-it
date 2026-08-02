'use client'

import type { Earthquake } from '@quakewatch/core'
import { MAGNITUDE_COLORS, magnitudeClassOf, type ThemeName } from '@quakewatch/tokens'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion'
import { relativeTime } from '@/lib/rel-time'
import { topByMagnitude } from '@/lib/strongest'
import { toThemeName } from '@/lib/theme'
import { cn } from '@/lib/utils'

export interface StrongestProps {
	events: Earthquake[]
	selectedId: string | null
	onSelect: (eventId: string) => void
	/** Epoch ms dell'orologio condiviso (T8); null finché non montato (niente Date.now() in SSR). */
	nowMs: number | null
	/** Aperto di default su desktop; il call site mobile passa false (sheet già denso). */
	defaultOpen?: boolean
}

/**
 * Pane "I più forti": i 4 eventi di magnitudo più alta nella finestra corrente
 * (a parità di magnitudo, il più recente prima — vedi lib/strongest.ts).
 * Righe compatte sul pattern di EventList; il colore di classe è un dot
 * (mai l'unica identità: il numero mono resta l'etichetta primaria).
 */
export function Strongest({
	events,
	selectedId,
	onSelect,
	nowMs,
	defaultOpen = true,
}: StrongestProps) {
	// resolvedTheme è undefined in SSR: default 'theme-dark' finché non montato (lezione map-legend.tsx).
	const { resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const themeName: ThemeName = mounted ? toThemeName(resolvedTheme) : 'theme-dark'
	const colors = MAGNITUDE_COLORS[themeName]

	const top = topByMagnitude(events)
	if (top.length === 0) return null

	return (
		<div className="shrink-0 rounded-xl border border-border bg-card px-1.5">
			<Accordion defaultValue={defaultOpen ? ['strongest'] : []}>
				<AccordionItem value="strongest">
					<AccordionTrigger className="px-2 py-2 text-[10px] font-normal tracking-wide text-muted-foreground uppercase hover:no-underline">
						I più forti
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-1 pb-1.5">
						{top.map((event) => {
							const isSelected = event.eventId === selectedId
							return (
								<button
									key={event.eventId}
									type="button"
									aria-current={isSelected ? 'true' : undefined}
									onClick={() => onSelect(event.eventId)}
									className={cn(
										'flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted',
										isSelected && 'bg-muted'
									)}
								>
									<span
										className="h-2.5 w-2.5 shrink-0 rounded-full"
										style={{
											backgroundColor: colors[magnitudeClassOf(event.magnitude).id],
										}}
									/>
									<span
										className="w-8 shrink-0 font-mono text-[13px] text-foreground"
										data-numeric
									>
										{event.magnitude.toFixed(1)}
									</span>
									<span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
										{event.locationName}
									</span>
									<span
										className="shrink-0 font-mono text-[10px] text-muted-foreground"
										data-numeric
									>
										{nowMs !== null ? relativeTime(event.time, nowMs) : ''}
									</span>
								</button>
							)
						})}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	)
}
