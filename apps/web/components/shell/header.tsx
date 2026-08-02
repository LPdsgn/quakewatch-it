'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { Earthquake } from '../icons'
import { Skeleton } from '../ui/skeleton'

export interface HeaderProps {
	/** LIVE (rosso) solo per la finestra 24h; altrimenti dot neutro. */
	isLive: boolean
	/** Epoch ms dell'orologio condiviso (home-client, T8/T9): un solo interval per la pagina. */
	nowMs: number | null
	className?: string
}

export function Header({ isLive, nowMs, className }: HeaderProps) {
	// null finché l'orologio non ha ancora ticchettato: mai Date.now() in render SSR (lezione prototipo).
	const clock =
		nowMs !== null
			? new Date(nowMs).toLocaleTimeString('it-IT', { hour12: false, timeZone: 'Europe/Rome' })
			: null

	// resolvedTheme è undefined in SSR: renderizza il toggle solo dopo il mount.
	const { resolvedTheme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])

	return (
		<div
			className={cn(
				'flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5',
				className
			)}
		>
			<h1 className="flex items-center gap-1.5 text-sm font-semibold tracking-widest text-foreground">
				<Earthquake className="size-5 text-foreground" />
				<span className="font-mono">QUAKEWATCH</span>
			</h1>
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
					<span className="text-[11px] text-muted-foreground" data-numeric>
						agg. {clock ?? '—:—:—'}
					</span>
				</div>
				{mounted ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={resolvedTheme === 'dark' ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
						onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
					>
						{resolvedTheme === 'dark' ? <Sun /> : <Moon />}
					</Button>
				) : (
					<Skeleton className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })} />
				)}
			</div>
		</div>
	)
}
