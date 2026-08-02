import { Suspense } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

import { HomeClient } from './home-client'

// Fallback statico (server component, niente hook): stessa griglia della UI reale, per evitare
// un flash bianco/layout shift mentre HomeClient (client component, usa useSearchParams) monta.
function HomeSkeleton() {
	return (
		<div className="grid h-dvh w-screen grid-cols-1 grid-rows-1 bg-background text-foreground md:grid-cols-[360px_1fr] md:grid-rows-[1fr_fit-content(100%)]">
			<div className="col-start-1 row-start-1 row-span-2 hidden flex-col gap-2 overflow-hidden bg-sidebar p-2 md:flex">
				<Skeleton className="h-13 w-full shrink-0 rounded-xl" />
				<Skeleton className="h-19 w-full shrink-0 rounded-xl" />
				<Skeleton className="h-9 w-full shrink-0 rounded-xl" />
				<div className="flex-1 rounded-xl border border-border bg-card" />
			</div>
			<div className="col-start-1 row-start-1 overflow-hidden bg-card md:col-start-2" />
			{/* Stessa griglia della Timeline reale (home-client.tsx): il suo stesso skeleton di
			    caricamento, per non avere due varianti di placeholder da mantenere. */}
			<div className="hidden overflow-hidden border-t border-border md:col-start-2 md:row-start-2 md:flex">
				<div className="flex h-10 w-full items-center px-4">
					<Skeleton className="h-8 w-full" />
				</div>
			</div>
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
