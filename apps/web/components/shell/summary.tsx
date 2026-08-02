import type { Earthquake } from '@quakewatch/core'

import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/lib/rel-time'

export interface SummaryProps {
	events: Earthquake[]
	isLoading: boolean
	/** Fetch fallito: mostra '—' su tutte e tre le stat invece di 0 (data-honesty). */
	hasError?: boolean
	/** Selezione dell'hero "ultimo evento"; assente finché non serve (finestra vuota). */
	onSelectEvent?: (eventId: string) => void
	/** Epoch ms dell'orologio condiviso (T8); null finché non montato. */
	nowMs?: number | null
}

export function Summary({ events, isLoading, hasError, onSelectEvent, nowMs }: SummaryProps) {
	const count = events.length
	const maxMag = count ? Math.max(...events.map((e) => e.magnitude)) : null
	const avgDepth = count ? events.reduce((sum, e) => sum + e.depthKm, 0) / count : null
	// Stesso criterio di recenza di EventList/MobileSheet (ordinamento per `time` desc):
	// riga in più (non estratta in helper condiviso — un one-liner non vale l'astrazione).
	const mostRecent = count ? events.toSorted((a, b) => b.time.localeCompare(a.time))[0] : null

	const countLabel = hasError ? '—' : String(count)
	const maxMagLabel = hasError ? '—' : (maxMag?.toFixed(1) ?? '—')
	const avgDepthLabel = hasError || avgDepth === null ? '—' : `${avgDepth.toFixed(1)} km`

	let hero = null
	if (isLoading) {
		hero = <Skeleton className="h-4 w-40" />
	} else if (!hasError && mostRecent && onSelectEvent) {
		hero = (
			<button
				type="button"
				onClick={() => onSelectEvent(mostRecent.eventId)}
				className="truncate text-left text-[12px] text-muted-foreground hover:text-foreground"
			>
				Ultimo:{' '}
				<span className="font-semibold text-foreground">
					{mostRecent.magnitudeType}{' '}
					<span className="font-mono" data-numeric>
						{mostRecent.magnitude.toFixed(1)}
					</span>
				</span>{' '}
				— {mostRecent.locationName}
				{nowMs != null ? `, ${relativeTime(mostRecent.time, nowMs)}` : ''}
			</button>
		)
	}

	return (
		<div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-3">
			{hero}
			<div className="grid grid-cols-3 gap-2">
				<Stat label="eventi" value={isLoading ? null : countLabel} />
				<Stat label="mag. max" value={isLoading ? null : maxMagLabel} />
				<Stat label="prof. media" value={isLoading ? null : avgDepthLabel} />
			</div>
		</div>
	)
}

function Stat({ label, value }: { label: string; value: string | null }) {
	return (
		<div className="flex flex-col gap-0.5">
			{value === null ? (
				<Skeleton className="h-[19px] w-10" />
			) : (
				<span className="font-mono text-[19px] leading-none" data-numeric>
					{value}
				</span>
			)}
			<span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
		</div>
	)
}
