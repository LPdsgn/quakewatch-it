import type { Earthquake } from '@quakewatch/core'

import { ScrollArea } from '@/components/ui/scroll-area'
import { relativeTime } from '@/lib/rel-time'
import { cn } from '@/lib/utils'

export interface EventListProps {
	events: Earthquake[]
	selectedId: string | null
	onSelect: (eventId: string) => void
	/** Epoch ms dell'orologio condiviso (T8); null finché non montato (niente Date.now() in SSR). */
	nowMs: number | null
}

export function EventList({ events, selectedId, onSelect, nowMs }: EventListProps) {
	const sorted = events.toSorted((a, b) => b.time.localeCompare(a.time))
	const mostRecentId = sorted[0]?.eventId ?? null

	return (
		<ScrollArea className="min-h-0 flex-1 rounded-xl border border-border bg-card">
			<div className="flex flex-col gap-1 p-1.5">
				{sorted.map((event) => {
					const isSelected = event.eventId === selectedId
					const isAccent = isSelected || event.eventId === mostRecentId
					return (
						<button
							key={event.eventId}
							type="button"
							aria-current={isSelected ? 'true' : undefined}
							title={new Date(event.time).toLocaleString('it-IT', {
								dateStyle: 'full',
								timeStyle: 'medium',
							})}
							onClick={() => onSelect(event.eventId)}
							className={cn(
								'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted',
								isSelected && 'bg-muted'
							)}
						>
							<span
								className={cn(
									'w-10 shrink-0 font-mono text-[15px]',
									isAccent ? 'text-primary' : 'text-foreground'
								)}
								data-numeric
							>
								{event.magnitude.toFixed(1)}
							</span>
							<span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
								{event.locationName}
							</span>
							<span
								className="shrink-0 font-mono text-[11px] text-muted-foreground"
								data-numeric
							>
								{nowMs !== null ? relativeTime(event.time, nowMs) : ''}
							</span>
							<span
								className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground"
								data-numeric
							>
								{event.depthKm.toFixed(1)} km
							</span>
						</button>
					)
				})}
			</div>
		</ScrollArea>
	)
}
