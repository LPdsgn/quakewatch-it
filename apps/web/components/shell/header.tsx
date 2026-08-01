'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface HeaderProps {
	/** LIVE (rosso) solo per la finestra 24h; altrimenti dot neutro. */
	isLive: boolean
}

export function Header({ isLive }: HeaderProps) {
	// Orologio: null fino al mount, mai Date.now() in render SSR (lezione prototipo).
	const [clock, setClock] = useState<string | null>(null)
	useEffect(() => {
		const tick = () => setClock(new Date().toLocaleTimeString('it-IT', { hour12: false }))
		tick()
		const id = setInterval(tick, 1000)
		return () => clearInterval(id)
	}, [])

	// resolvedTheme è undefined in SSR: renderizza il toggle solo dopo il mount.
	const { resolvedTheme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])

	return (
		<div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
			<span className="text-xs font-semibold tracking-widest text-foreground">QUAKEWATCH</span>
			<div className="flex items-center gap-2">
				<div className="flex items-center gap-1.5">
					<span
						className={cn(
							'h-1.5 w-1.5 rounded-full',
							isLive
								? 'bg-primary shadow-[0_0_6px_var(--primary)]'
								: 'bg-muted-foreground/40'
						)}
					/>
					<span className="font-mono text-[11px] text-muted-foreground" data-numeric>
						agg. {clock ?? '—:—:—'}
					</span>
				</div>
				{mounted && (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label={resolvedTheme === 'dark' ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
						onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
					>
						{resolvedTheme === 'dark' ? <Sun /> : <Moon />}
					</Button>
				)}
			</div>
		</div>
	)
}
