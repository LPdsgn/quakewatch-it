import type { Earthquake } from '@quakewatch/core'

import { Skeleton } from '@/components/ui/skeleton'

export interface SummaryProps {
	events: Earthquake[]
	isLoading: boolean
	/** Fetch fallito: mostra '—' su tutte e tre le stat invece di 0 (data-honesty). */
	hasError?: boolean
}

export function Summary({ events, isLoading, hasError }: SummaryProps) {
	const count = events.length
	const maxMag = count ? Math.max(...events.map((e) => e.magnitude)) : null
	const avgDepth = count ? events.reduce((sum, e) => sum + e.depthKm, 0) / count : null

	const countLabel = hasError ? '—' : String(count)
	const maxMagLabel = hasError ? '—' : (maxMag?.toFixed(1) ?? '—')
	const avgDepthLabel = hasError || avgDepth === null ? '—' : `${avgDepth.toFixed(1)} km`

	return (
		<div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card px-3 py-3">
			<Stat label="eventi" value={isLoading ? null : countLabel} />
			<Stat label="mag. max" value={isLoading ? null : maxMagLabel} />
			<Stat label="prof. media" value={isLoading ? null : avgDepthLabel} />
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
