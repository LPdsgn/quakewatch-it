import {
	TIME_WINDOWS,
	type TimeWindow,
	buildEventsUrl,
	findAreaPreset,
	parseEventsText,
} from '@quakewatch/core'

import { env } from '@/lib/env'

const CACHE_OK = 'public, s-maxage=60, stale-while-revalidate=300'

function isTimeWindow(v: string): v is TimeWindow {
	return (TIME_WINDOWS as readonly string[]).includes(v)
}

export async function GET(request: Request): Promise<Response> {
	const params = new URL(request.url).searchParams
	const window = params.get('window') ?? '24h'
	const areaId = params.get('area') ?? 'italia'

	if (!isTimeWindow(window)) {
		return Response.json({ error: `window non valida: ${window}` }, { status: 400 })
	}
	const area = findAreaPreset(areaId)
	if (!area) {
		return Response.json({ error: `area non valida: ${areaId}` }, { status: 400 })
	}

	const upstream = buildEventsUrl(env.INGV_BASE_URL, window, area, new Date())
	let res: Response
	try {
		res = await fetch(upstream)
	} catch {
		return Response.json(
			{ error: 'INGV non raggiungibile' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	// FDSN: 204 = nessun evento nel range, non è un errore
	if (res.status === 204) {
		return Response.json(
			{ events: [], fetchedAt: new Date().toISOString() },
			{ headers: { 'Cache-Control': CACHE_OK } }
		)
	}
	if (!res.ok) {
		return Response.json(
			{ error: `INGV ha risposto ${res.status}` },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		)
	}

	const events = parseEventsText(await res.text())
	return Response.json(
		{ events, fetchedAt: new Date().toISOString() },
		{ headers: { 'Cache-Control': CACHE_OK } }
	)
}
