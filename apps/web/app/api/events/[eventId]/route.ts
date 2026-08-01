import {
	buildEventDetailUrl,
	hasRevisions,
	parseQuakemlEvent,
	revisionStatus,
} from '@quakewatch/core'

import { env } from '@/lib/env'

const CACHE_OK = 'public, s-maxage=60, stale-while-revalidate=300'

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ eventId: string }> }
): Promise<Response> {
	const { eventId } = await params
	if (!/^\d+$/.test(eventId)) {
		return Response.json({ error: 'eventId non valido' }, { status: 400 })
	}

	const upstream = buildEventDetailUrl(env.INGV_BASE_URL, eventId)
	let res: Response
	try {
		res = await fetch(upstream)
	} catch {
		return Response.json(
			{ error: 'INGV non raggiungibile' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	if (res.status === 204 || res.status === 404) {
		return Response.json({ error: 'evento non trovato' }, { status: 404 })
	}
	if (!res.ok) {
		return Response.json(
			{ error: `INGV ha risposto ${res.status}` },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	const detail = parseQuakemlEvent(await res.text())
	if (!detail) {
		return Response.json({ error: 'risposta INGV non interpretabile' }, { status: 502 })
	}

	return Response.json(
		{ detail, revisionStatus: revisionStatus(detail), hasRevisions: hasRevisions(detail) },
		{ headers: { 'Cache-Control': CACHE_OK } }
	)
}
