'use client'

import {
	useEventDetailQuery,
	useShakemapQuery,
	type EventDetail as EventDetailData,
	type EventDetailResponse,
} from '@quakewatch/core'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface EventDetailProps {
	eventId: string
	onBack: () => void
	showShakemap: boolean
	onToggleShakemap: (next: boolean) => void
}

const INGV_EVENT_URL = 'https://terremoti.ingv.it/event/'

function formatLocal(iso: string): string {
	return new Date(iso).toLocaleString('it-IT', {
		dateStyle: 'full',
		timeStyle: 'medium',
		timeZone: 'Europe/Rome',
	})
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
export function EventDetail({ eventId, onBack, showShakemap, onToggleShakemap }: EventDetailProps) {
	const { data, isLoading, isError } = useEventDetailQuery(eventId)
	// enabled=true al mount del dettaglio (non legato al toggle): serve a sapere SUBITO se il
	// prodotto esiste, per mostrare toggle o riga muted. Stessa queryKey di QuakeMap → cache condivisa.
	const shakemap = useShakemapQuery(eventId, true)

	// Il pannello sostituisce la lista: sposta il focus su "Indietro" (a11y, niente focus perso
	// nel vuoto quando il nodo precedente scompare).
	const backButtonRef = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		backButtonRef.current?.focus()
	}, [])

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
		body = (
			<DetailBody
				eventId={eventId}
				data={data}
				shakemapLoading={shakemap.isLoading}
				shakemapError={shakemap.isError}
				shakemapAvailable={shakemap.data != null}
				showShakemap={showShakemap}
				onToggleShakemap={onToggleShakemap}
			/>
		)
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
			<div className="shrink-0 border-b border-border p-1.5">
				<Button type="button" variant="ghost" size="sm" onClick={onBack} ref={backButtonRef}>
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

interface DetailBodyProps {
	eventId: string
	data: EventDetailResponse
	shakemapLoading: boolean
	shakemapError: boolean
	shakemapAvailable: boolean
	showShakemap: boolean
	onToggleShakemap: (next: boolean) => void
}

function DetailBody({
	eventId,
	data,
	shakemapLoading,
	shakemapError,
	shakemapAvailable,
	showShakemap,
	onToggleShakemap,
}: DetailBodyProps) {
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

			{!shakemapLoading && (
				<ShakemapSection
					shakemapError={shakemapError}
					shakemapAvailable={shakemapAvailable}
					showShakemap={showShakemap}
					onToggleShakemap={onToggleShakemap}
				/>
			)}

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

/**
 * Tre stati distinti (non un'assenza unica): un 502 upstream non è la stessa cosa di "nessun
 * prodotto per questo evento" (finding review) — messaggio muted diverso, coerente in tono con
 * "Impossibile caricare..." del corpo principale, mai allerta/allarme/pericolo.
 */
function ShakemapSection({
	shakemapError,
	shakemapAvailable,
	showShakemap,
	onToggleShakemap,
}: {
	shakemapError: boolean
	shakemapAvailable: boolean
	showShakemap: boolean
	onToggleShakemap: (next: boolean) => void
}) {
	if (shakemapError) {
		return (
			<p className="border-t border-border pt-3 text-xs text-muted-foreground">
				Impossibile verificare lo ShakeMap di questo evento. Riprova più tardi.
			</p>
		)
	}
	if (!shakemapAvailable) {
		return (
			<p className="border-t border-border pt-3 text-xs text-muted-foreground">
				ShakeMap non disponibile per questo evento
			</p>
		)
	}
	return <ShakemapToggle showShakemap={showShakemap} onToggleShakemap={onToggleShakemap} />
}

/** Bottone toggle stile area-preset.tsx (aria-pressed su elemento nativo, niente switch dedicato). */
function ShakemapToggle({
	showShakemap,
	onToggleShakemap,
}: {
	showShakemap: boolean
	onToggleShakemap: (next: boolean) => void
}) {
	return (
		<div className="border-t border-border pt-3">
			<button
				type="button"
				aria-pressed={showShakemap}
				onClick={() => onToggleShakemap(!showShakemap)}
				className={cn(
					'rounded-lg border border-border px-2.5 py-1.5 text-xs',
					showShakemap ? 'bg-muted text-foreground' : 'text-muted-foreground'
				)}
			>
				Scuotimento (ShakeMap)
			</button>
		</div>
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
