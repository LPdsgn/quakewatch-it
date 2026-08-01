import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../app/api/events/route'

const fixtureText = readFileSync(
	fileURLToPath(
		new URL('../../../packages/core/test/fixtures/events-sample.txt', import.meta.url)
	),
	'utf8'
)

const req = (qs: string) => new Request(`http://localhost/api/events${qs}`)

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/events', () => {
	it('200: eventi parsati + header cache esatto (spec §1)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fixtureText, { status: 200 })))
		const res = await GET(req('?window=24h&area=italia'))
		expect(res.status).toBe(200)
		expect(res.headers.get('Cache-Control')).toBe(
			'public, s-maxage=60, stale-while-revalidate=300'
		)
		const body = await res.json()
		expect(body.events.length).toBeGreaterThanOrEqual(3)
		expect(body.events[0]).toHaveProperty('eventId')
		expect(typeof body.fetchedAt).toBe('string')
	})

	it('default: window=24h, area=italia', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(fixtureText, { status: 200 }))
		vi.stubGlobal('fetch', fetchMock)
		const res = await GET(req(''))
		expect(res.status).toBe(200)
		const upstream = new URL(String(fetchMock.mock.calls[0]?.[0]))
		expect(upstream.searchParams.get('minmagnitude')).toBeNull()
	})

	it('204 upstream (nessun evento) → 200 con lista vuota', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
		const res = await GET(req('?window=24h'))
		expect(res.status).toBe(200)
		expect((await res.json()).events).toEqual([])
	})

	it('400 su window sconosciuta', async () => {
		const res = await GET(req('?window=1y'))
		expect(res.status).toBe(400)
	})

	it('400 su area sconosciuta', async () => {
		const res = await GET(req('?area=atlantide'))
		expect(res.status).toBe(400)
	})

	it('502 su errore upstream, senza header di cache pubblica', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
		const res = await GET(req('?window=24h'))
		expect(res.status).toBe(502)
		expect(res.headers.get('Cache-Control')).toBe('no-store')
	})

	it('502 su fetch che lancia (rete giù)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
		const res = await GET(req('?window=24h'))
		expect(res.status).toBe(502)
	})
})
