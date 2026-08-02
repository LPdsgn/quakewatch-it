import { AREA_PRESETS, TIME_WINDOWS, type TimeWindow } from '@quakewatch/core'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { TabbedControl } from '@/components/ui/tabbed-control'
import { cn } from '@/lib/utils'

const WINDOW_LABEL: Record<TimeWindow, string> = {
	'24h': '24H',
	'7d': '7G',
	'30d': '30G',
	'90d': '90G',
}

const WINDOW_DESCRIPTION: Record<TimeWindow, string> = {
	'24h': 'Ultime 24 ore',
	'7d': 'Ultimi 7 giorni',
	'30d': 'Ultimi 30 giorni',
	'90d': 'Ultimi 90 giorni',
}

export interface AreaPresetProps {
	area: string
	window: TimeWindow
	onChange: (area: string, window: TimeWindow) => void
}

/**
 * Zone su TabbedControl (aspetto TabsList/TabsTrigger, riga piena); orizzonti temporali
 * su ButtonGroup nella riga sotto, allineati a destra con la label contestuale della
 * finestra selezionata accanto.
 */
export function AreaPreset({ area, window, onChange }: AreaPresetProps) {
	return (
		<div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2">
			<TabbedControl
				aria-label="Zona"
				value={area}
				options={AREA_PRESETS.map((a) => ({ value: a.id, label: a.label }))}
				onChange={(next) => onChange(next, window)}
				className="flex w-full"
				triggerClassName="text-[10px] tracking-wide uppercase"
			/>
			<div className="flex items-center justify-end gap-2">
				<span className="text-[10px] text-muted-foreground">{WINDOW_DESCRIPTION[window]}</span>
				<ButtonGroup aria-label="Finestra temporale">
					{TIME_WINDOWS.map((w) => (
						<Button
							key={w}
							type="button"
							variant="outline"
							size="xs"
							aria-pressed={window === w}
							onClick={() => onChange(area, w)}
							className={cn(
								'font-mono text-[10px]',
								window === w ? 'bg-muted text-foreground' : 'text-muted-foreground'
							)}
							data-numeric
						>
							{WINDOW_LABEL[w]}
						</Button>
					))}
				</ButtonGroup>
			</div>
		</div>
	)
}
