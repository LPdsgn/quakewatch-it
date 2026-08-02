'use client'

import { useQuery } from '@tanstack/react-query'

import type { RevisionStatus } from './revisions'
import type { ShakemapContours } from './shakemap'
import type { Earthquake, EventDetail } from './types'
import type { TimeWindow } from './windows'

export interface EventsResponse {
	events: Earthquake[]
	fetchedAt: string
}

export interface EventDetailResponse {
	detail: EventDetail
	revisionStatus: RevisionStatus
	hasRevisions: boolean
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`proxy ${res.status}`)
	return res.json() as Promise<T>
}

/** Lista eventi. Solo la finestra 24h è "live": polling 60s allineato alla cache INGV. */
export function useEventsQuery(window: TimeWindow, areaId: string) {
	return useQuery({
		queryKey: ['events', window, areaId],
		queryFn: () => fetchJson<EventsResponse>(`/api/events?window=${window}&area=${areaId}`),
		refetchInterval: window === '24h' ? 60_000 : false,
		staleTime: 30_000,
	})
}

export function useEventDetailQuery(eventId: string | null) {
	return useQuery({
		queryKey: ['event-detail', eventId],
		queryFn: () => fetchJson<EventDetailResponse>(`/api/events/${eventId}`),
		enabled: eventId !== null,
	})
}

/** 404 = assenza prodotto, stato normale (non un errore): ritorna null invece di lanciare. */
async function fetchShakemap(eventId: string): Promise<ShakemapContours | null> {
	const res = await fetch(`/api/events/${eventId}/shakemap`)
	if (res.status === 404) return null
	if (!res.ok) throw new Error(`proxy ${res.status}`)
	return res.json() as Promise<ShakemapContours>
}

export function useShakemapQuery(eventId: string | null, enabled: boolean) {
	return useQuery({
		queryKey: ['shakemap', eventId],
		queryFn: () => fetchShakemap(eventId as string),
		enabled: enabled && eventId !== null,
		staleTime: 300_000,
	})
}
