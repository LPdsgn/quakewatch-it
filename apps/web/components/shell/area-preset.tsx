import { AREA_PRESETS, TIME_WINDOWS, type TimeWindow } from '@quakewatch/core'

import { cn } from '@/lib/utils'

const WINDOW_LABEL: Record<TimeWindow, string> = {
	'24h': '24H',
	'7d': '7G',
	'30d': '30G',
	'90d': '90G',
}

export interface AreaPresetProps {
	area: string
	window: TimeWindow
	onChange: (area: string, window: TimeWindow) => void
}

// Bottoni custom sui token invece di Tabs shadcn: Tabs (Base UI) accoppia trigger a un
// TabsContent, ma qui servono due segmented control indipendenti (area, finestra) senza
// pannelli — solo selezione di stato riflessa nell'URL. Bottoni su token = stesso risultato
// visivo, zero markup inerte (TabsContent vuoti per ognuno dei due gruppi).
export function AreaPreset({ area, window, onChange }: AreaPresetProps) {
	return (
		<div className="rounded-xl border border-border bg-card p-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex flex-1 overflow-hidden rounded-lg border border-border">
					{AREA_PRESETS.map((a) => (
						<button
							key={a.id}
							type="button"
							aria-pressed={area === a.id}
							onClick={() => onChange(a.id, window)}
							className={cn(
								'flex-1 px-1.5 py-1.5 text-center text-[10px] tracking-wide uppercase',
								area === a.id ? 'bg-muted text-foreground' : 'text-muted-foreground'
							)}
						>
							{a.label}
						</button>
					))}
				</div>
				<div className="flex overflow-hidden rounded-lg border border-border font-mono">
					{TIME_WINDOWS.map((w) => (
						<button
							key={w}
							type="button"
							aria-pressed={window === w}
							onClick={() => onChange(area, w)}
							className={cn(
								'px-2 py-1.5 text-[10px]',
								window === w ? 'bg-muted text-foreground' : 'text-muted-foreground'
							)}
						>
							{WINDOW_LABEL[w]}
						</button>
					))}
				</div>
			</div>
		</div>
	)
}
