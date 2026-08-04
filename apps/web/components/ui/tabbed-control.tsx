'use client'

import type { ReactNode } from 'react'

import { tabsListVariants } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export interface TabbedControlOption<T extends string> {
	value: T
	label: ReactNode
}

export interface TabbedControlProps<T extends string> {
	value: T
	options: TabbedControlOption<T>[]
	onChange: (value: T) => void
	'aria-label': string
	className?: string
	triggerClassName?: string
}

/**
 * Segmented control con l'aspetto di TabsList/TabsTrigger (tabs.tsx) ma bottoni semplici
 * con aria-pressed: Tabs (Base UI) accoppia i trigger a un TabsContent che qui non esiste —
 * è solo selezione di stato riflessa nell'URL, senza pannelli.
 */
export function TabbedControl<T extends string>({
	value,
	options,
	onChange,
	className,
	triggerClassName,
	'aria-label': ariaLabel,
}: TabbedControlProps<T>) {
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={cn(tabsListVariants(), 'h-8 rounded-md', className)}
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={option.value === value}
					data-active={option.value === value ? '' : undefined}
					onClick={() => onChange(option.value)}
					className={cn(
						// Sottoinsieme delle classi di TabsTrigger (tabs.tsx) che non dipende dal Root.
						'inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center rounded-sm border border-transparent px-1.5 py-0.5 font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 text-muted-foreground not-data-active:hover:text-foreground',
						'data-active:bg-foreground data-active:text-background data-active:shadow-sm data-active:font-semibold',
						triggerClassName
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}
