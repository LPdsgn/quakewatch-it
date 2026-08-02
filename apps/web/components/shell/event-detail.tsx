'use client'

import {
	useEventDetailQuery,
	type EventDetail as EventDetailData,
	type EventDetailResponse,
} from '@quakewatch/core'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface EventDetailProps {
	eventId: string
	onBack: () => void
}

const INGV_EVENT_URL = 'https://terremoti.ingv.it/event/'

function formatLocal(iso: string): string {
	return new Date(iso).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'medium' })
}

function formatUtc(iso: string): string {
	const d = new Date(iso)
	const date = d.toLocaleDateString('it-IT', { timeZone: 'UTC' })
	const time = d.toLocaleTimeString('it-IT', { timeZone: 'UTC', hour12: false })
	return `${date} ${time} UTC`
}

function formatCoords(latitude: number, longitude: number): string {
	return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
}

/** Pannello di dettaglio evento: scorre sopra la lista nella stessa colonna sidebar (T11). */
export function EventDetail({ eventId, onBack }: EventDetailProps) {
	const { data, isLoading, isError } = useEventDetailQuery(eventId)

	let body: ReactNode
	if (isLoading) {
		body = <DetailSkeleton />
	} else if (isError || !data) {
		body = (
			<p className="py-6 text-center text-xs text-muted-foreground">
				Impossibile caricare il dettaglio di questo evento. Riprova più tardi.
			</p>
		)
	} else {
		body = <DetailBody eventId={eventId} data={data} />
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
			<div className="shrink-0 border-b border-border p-1.5">
				<Button type="button" variant="ghost" size="sm" onClick={onBack}>
					<ArrowLeft /> Indietro
				</Button>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-4 p-3">{body}</div>
			</ScrollArea>
		</div>
	)
}

function DetailSkeleton() {
	return (
		<div className="flex flex-col gap-3">
			<Skeleton className="h-9 w-28" />
			<Skeleton className="h-4 w-2/3" />
			<Skeleton className="h-4 w-40" />
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-4 w-28" />
		</div>
	)
}

function DetailBody({ eventId, data }: { eventId: string; data: EventDetailResponse }) {
	const { detail, revisionStatus, hasRevisions } = data
	const { preferredOrigin, preferredMagnitude, locationName } = detail
	const isRevisto = revisionStatus === 'rivisto'

	return (
		<>
			<div className="flex items-center gap-2">
				<span className="font-mono text-3xl leading-none" data-numeric>
					{preferredMagnitude.type} {preferredMagnitude.value.toFixed(1)}
				</span>
				<Badge variant="outline" className={cn(isRevisto && 'border-success text-success')}>
					{isRevisto ? 'RIVISTO' : 'PRELIMINARE'}
				</Badge>
			</div>

			<p className="text-sm text-foreground">{locationName}</p>

			<div className="flex flex-col gap-0.5 text-xs">
				<span className="text-foreground">{formatLocal(preferredOrigin.time)}</span>
				<span className="font-mono text-muted-foreground" data-numeric>
					{formatUtc(preferredOrigin.time)}
				</span>
			</div>

			<div className="flex flex-col gap-0.5 font-mono text-xs text-foreground" data-numeric>
				<span>{formatCoords(preferredOrigin.latitude, preferredOrigin.longitude)}</span>
				<span>{preferredOrigin.depthKm.toFixed(1)} km di profondità</span>
			</div>

			{hasRevisions && <RevisionHistory detail={detail} />}

			<a
				href={`${INGV_EVENT_URL}${eventId}`}
				target="_blank"
				rel="noopener noreferrer"
				className="text-xs text-primary underline-offset-4 hover:underline"
			>
				Scheda INGV ↗
			</a>
		</>
	)
}

function RevisionHistory({ detail }: { detail: EventDetailData }) {
	const { origins, magnitudes, preferredOrigin, preferredMagnitude } = detail

	return (
		<div className="flex flex-col gap-2 border-t border-border pt-3">
			<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
				Storico revisioni
			</span>
			{origins.length > 1 && (
				<ul className="flex flex-col gap-1 font-mono text-[11px]" data-numeric>
					{origins.map((origin) => (
						<li
							key={origin.publicId}
							className={cn(
								origin.publicId === preferredOrigin.publicId
									? 'text-foreground'
									: 'text-muted-foreground line-through'
							)}
						>
							{formatLocal(origin.time)} · {formatCoords(origin.latitude, origin.longitude)}{' '}
							· {origin.depthKm.toFixed(1)} km
						</li>
					))}
				</ul>
			)}
			{magnitudes.length > 1 && (
				<ul className="flex flex-col gap-1 font-mono text-[11px]" data-numeric>
					{magnitudes.map((magnitude) => (
						<li
							key={magnitude.publicId}
							className={cn(
								magnitude.publicId === preferredMagnitude.publicId
									? 'text-foreground'
									: 'text-muted-foreground line-through'
							)}
						>
							{magnitude.type} {magnitude.value.toFixed(1)}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
