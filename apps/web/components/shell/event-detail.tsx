'use client'

import {
	useEventDetailQuery,
	useShakemapQuery,
	type EventDetail as EventDetailData,
	type EventDetailResponse,
} from '@quakewatch/core'
import { X, ArrowLeft } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/use-mobile'
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

	let body: ReactNode
	if (isLoading) {
		body = <DetailSkeleton />
	} else if (data === null) {
		// 404 dal proxy: evento inesistente, non un guasto — niente promessa di retry.
		body = <p className="py-6 text-center text-xs text-muted-foreground">Evento non trovato.</p>
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
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card relative">
			<EventBackButton onBack={onBack} />
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-4 p-3">{body}</div>
			</ScrollArea>
		</div>
	)
}

/**
 * Unico punto di uscita dal dettaglio, fuori dallo ScrollArea: deve restare visibile anche
 * negli stati loading/error. Riceve il focus al mount (a11y: il pannello sostituisce la
 * lista, niente focus perso nel vuoto quando il nodo precedente scompare).
 */
function EventBackButton({ onBack }: { onBack: () => void }) {
	const backButtonRef = useRef<HTMLButtonElement>(null)
	const isMobile = useIsMobile()
	// useIsMobile parte da `undefined` (→ false) al primissimo render e si assesta al valore
	// vero solo nel suo effect di mount: un effect con deps `[]` fotograferebbe quindi sempre
	// il bottone desktop, anche su mobile. Con deps `[isMobile]` l'effect rifocalizza quando
	// il breakpoint si assesta (branch X→Indietro), quindi il focus arriva sempre sul bottone
	// realmente mostrato. Niente ref "focus già dato" qui: bloccherebbe proprio il refocus che
	// serve al secondo giro (il primo giro è per definizione il valore non ancora assestato).
	useEffect(() => {
		backButtonRef.current?.focus()
	}, [isMobile])

	return !isMobile ? (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={onBack}
			ref={backButtonRef}
			className="absolute right-2 top-2 z-2"
		>
			<X />
		</Button>
	) : (
		<div className="shrink-0 border-b border-border p-1.5">
			<Button type="button" variant="ghost" size="sm" onClick={onBack} ref={backButtonRef}>
				<ArrowLeft /> Indietro
			</Button>
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

/**
 * Switch (Field + Switch base-nova): label per il cittadino, non per il sismologo —
 * "ShakeMap" resta solo nella descrizione come attribuzione del prodotto INGV.
 */
function ShakemapToggle({
	showShakemap,
	onToggleShakemap,
}: {
	showShakemap: boolean
	onToggleShakemap: (next: boolean) => void
}) {
	// id univoco per istanza: EventDetail monta due volte in contemporanea (sidebar desktop +
	// MobileSheet, vedi commento su detailNode in home-client.tsx), quindi un id statico
	// duplicherebbe "switch-shakemap" nel DOM (HTML non valido, htmlFor ambiguo).
	const id = useId()

	return (
		<div className="border-t border-border pt-3">
			<Field orientation="horizontal">
				<FieldContent>
					<FieldLabel htmlFor={id}>Mappa d&apos;impatto</FieldLabel>
					<FieldDescription className="text-xs font-normal">
						Mostra le aree di scuotimento stimate.
					</FieldDescription>
				</FieldContent>
				<Switch
					id={id}
					checked={showShakemap}
					onCheckedChange={(next) => onToggleShakemap(next)}
				/>
			</Field>
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
