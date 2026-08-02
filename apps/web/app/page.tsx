import { Suspense } from 'react'

import { TimelineSlot } from '@/components/shell/timeline-slot'
import { Skeleton } from '@/components/ui/skeleton'

import { HomeClient } from './home-client'

// Fallback statico (server component, niente hook): stessa griglia della UI reale, per evitare
// un flash bianco/layout shift mentre HomeClient (client component, usa useSearchParams) monta.
function HomeSkeleton() {
	return (
		<div className="grid h-screen w-screen grid-cols-1 grid-rows-1 bg-background text-foreground md:grid-cols-[360px_1fr] md:grid-rows-[1fr_72px]">
			<div className="col-start-1 row-start-1 row-span-2 hidden flex-col gap-2 overflow-hidden bg-sidebar p-2 md:flex">
				<Skeleton className="h-[52px] w-full shrink-0 rounded-xl" />
				<Skeleton className="h-[76px] w-full shrink-0 rounded-xl" />
				<Skeleton className="h-9 w-full shrink-0 rounded-xl" />
				<div className="flex-1 rounded-xl border border-border bg-card" />
			</div>
			<div className="col-start-1 row-start-1 overflow-hidden bg-card md:col-start-2" />
			<TimelineSlot />
		</div>
	)
}

export default function Home() {
	return (
		<Suspense fallback={<HomeSkeleton />}>
			<HomeClient />
		</Suspense>
	)
}
