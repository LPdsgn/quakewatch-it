import { buildShakemapContoursUrl, isShakemapContours } from '@quakewatch/core'

import { env } from '@/lib/env'

const CACHE_OK = 'public, s-maxage=300, stale-while-revalidate=3600'

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ eventId: string }> }
): Promise<Response> {
	const { eventId } = await params
	if (!/^\d+$/.test(eventId)) {
		return Response.json({ error: 'eventId non valido' }, { status: 400 })
	}

	const upstream = buildShakemapContoursUrl(env.SHAKEMAP_BASE_URL, eventId)
	let res: Response
	try {
		res = await fetch(upstream, { signal: AbortSignal.timeout(10_000) })
	} catch {
		return Response.json(
			{ error: 'ShakeMap non raggiungibile' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	if (res.status === 204 || res.status === 404) {
		return Response.json(
			{ error: 'prodotto ShakeMap non disponibile' },
			{ status: 404, headers: { 'Cache-Control': 'no-store' } }
		)
	}
	if (!res.ok) {
		return Response.json(
			{ error: `ShakeMap ha risposto ${res.status}` },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	let contours: unknown
	try {
		contours = await res.json()
	} catch {
		return Response.json(
			{ error: 'risposta ShakeMap non è JSON valido' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}
	if (!isShakemapContours(contours)) {
		return Response.json(
			{ error: 'risposta ShakeMap non interpretabile' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	return Response.json(contours, { headers: { 'Cache-Control': CACHE_OK } })
}
