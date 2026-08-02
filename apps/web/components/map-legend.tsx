'use client'

import { MAGNITUDE_CLASSES, MAGNITUDE_COLORS, MMI_SCALE, type ThemeName } from '@quakewatch/tokens'
import { X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SHEET_FULL, SHEET_PEEK } from '@/lib/layout-constants'
import { toThemeName } from '@/lib/theme'
import { cn } from '@/lib/utils'

export interface MapLegendProps {
	/** Sezione MMI (ShakeMap) solo quando serve (T5 la wira davvero, per ora sempre false). */
	showMmi: boolean
	/** Snap corrente del Drawer mobile (home-client): la legenda si ancora al bordo REALE
	 *  dello sheet, non a PEEK fisso (finding review finale: a HALF restava coperta). */
	sheetSnap?: number
}

const AGE_OPACITIES = [1, 0.65, 0.35]

// Tailwind non accetta variabili runtime nelle classi arbitrarie: offset via style inline.
// dvh, non svh: il Drawer è alto 100dvh (drawer.tsx), quindi il suo bordo sta a
// snap×dvh dal fondo — con svh la legenda si stacca quando l'address bar mobile collassa.
function mobileBottomOffset(sheetSnap: number): string {
	return `calc(${sheetSnap * 100}dvh + env(safe-area-inset-bottom) + 0.5rem)`
}

function LegendBody({ colors, showMmi }: { colors: Record<string, string>; showMmi: boolean }) {
	return (
		<div className="flex flex-col gap-1.5 text-[10px] leading-tight text-foreground">
			{MAGNITUDE_CLASSES.map((c) => (
				<div key={c.id} className="flex items-center gap-1.5">
					<span
						className="h-2.5 w-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: colors[c.id] }}
					/>
					<span className="font-mono" data-numeric>
						{c.label}
					</span>
				</div>
			))}
			<div className="flex items-center gap-1.5 border-t border-border pt-1.5">
				<div className="flex items-center gap-0.5">
					{AGE_OPACITIES.map((opacity) => (
						<span
							key={opacity}
							className="h-2.5 w-2.5 rounded-full bg-foreground"
							style={{ opacity }}
						/>
					))}
				</div>
				<span className="font-mono" data-numeric>
					ora → 12h+
				</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="h-2.5 w-2.5 rounded-full border-2 border-foreground" />
				<span>selezionato</span>
			</div>
			{showMmi && (
				<div className="flex flex-col gap-1 border-t border-border pt-1.5">
					<div className="flex gap-0.5">
						{MMI_SCALE.map((s) => (
							<span
								key={s.value}
								className="h-2 w-2 rounded-xs"
								style={{ backgroundColor: s.color }}
							/>
						))}
					</div>
					<div className="flex justify-between gap-2 text-muted-foreground">
						<span className="font-mono" data-numeric>
							1 {MMI_SCALE[0]?.label}
						</span>
						<span className="font-mono" data-numeric>
							10 {MMI_SCALE[MMI_SCALE.length - 1]?.label}
						</span>
					</div>
					<span className="text-muted-foreground">ShakeMap INGV</span>
				</div>
			)}
		</div>
	)
}

/**
 * Legenda mappa: classi magnitudo, età (opacity), selezione, MMI on-demand.
 * Overlay basso-sinistra dentro la cella mappa (sopra l'attribution di QuakeMap,
 * che sta in basso a destra). Desktop: pane sempre visibile. Mobile: collassata in
 * un bottone pill (44px target, aria-expanded) posizionato sopra il Drawer a PEEK
 * (mobile-sheet.tsx, SHEET_PEEK) e sotto i chip riepilogo in alto.
 */
export function MapLegend({ showMmi, sheetSnap = SHEET_PEEK }: MapLegendProps) {
	// resolvedTheme è undefined in SSR: default 'theme-dark' finché non montato (lezione quake-map.tsx).
	const { resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const themeName: ThemeName = mounted ? toThemeName(resolvedTheme) : 'theme-dark'
	const colors = MAGNITUDE_COLORS[themeName]

	const [open, setOpen] = useState(false)

	return (
		<>
			{/* Desktop: pane fisso, sempre visibile. */}
			<div className="pointer-events-none absolute bottom-2 left-2 z-10 hidden md:block">
				<div className="pointer-events-auto rounded-lg border border-border bg-card/85 p-2.5 backdrop-blur-sm">
					<LegendBody colors={colors} showMmi={showMmi} />
				</div>
			</div>

			{/* Mobile: collassata di default, appena sopra il bordo dello sheet (segue lo snap
			    con una transition; a FULL la mappa è coperta → legenda nascosta). */}
			<div
				className={cn(
					'pointer-events-none absolute inset-x-2 z-10 flex justify-start transition-[bottom] duration-300 ease-out md:hidden',
					sheetSnap >= SHEET_FULL && 'hidden'
				)}
				style={{ bottom: mobileBottomOffset(sheetSnap) }}
			>
				{open ? (
					<div className="pointer-events-auto flex w-48 flex-col gap-2 rounded-lg border border-border bg-card/85 p-2.5 backdrop-blur-sm">
						<div className="flex items-center justify-between gap-2">
							<span className="text-[10px] font-semibold tracking-wide text-foreground uppercase">
								Legenda
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label="Chiudi legenda mappa"
								aria-expanded={open}
								onClick={() => setOpen(false)}
							>
								<X />
							</Button>
						</div>
						<LegendBody colors={colors} showMmi={showMmi} />
					</div>
				) : (
					<Button
						type="button"
						variant="outline"
						aria-label="Apri legenda mappa"
						aria-expanded={open}
						className="pointer-events-auto  rounded-full bg-card/85 px-4 text-[11px] backdrop-blur-sm"
						onClick={() => setOpen(true)}
					>
						Legenda
					</Button>
				)}
			</div>
		</>
	)
}
