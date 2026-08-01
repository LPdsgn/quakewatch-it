import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../app/api/events/[eventId]/route'

const fixtureXml = readFileSync(
	fileURLToPath(
		new URL('../../../packages/core/test/fixtures/event-detail.quakeml.xml', import.meta.url)
	),
	'utf8'
)

const call = (eventId: string) =>
	GET(new Request(`http://localhost/api/events/${eventId}`), {
		params: Promise.resolve({ eventId }),
	})

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/events/[eventId]', () => {
	it('200: dettaglio con stato revisioni e header cache', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fixtureXml, { status: 200 })))
		const res = await call('44125672')
		expect(res.status).toBe(200)
		expect(res.headers.get('Cache-Control')).toBe(
			'public, s-maxage=60, stale-while-revalidate=300'
		)
		const body = await res.json()
		expect(body.detail.origins.length).toBeGreaterThanOrEqual(2)
		expect(['preliminare', 'rivisto']).toContain(body.revisionStatus)
		expect(typeof body.hasRevisions).toBe('boolean')
	})

	it('400 su eventId non numerico', async () => {
		const res = await call('DROP-TABLE')
		expect(res.status).toBe(400)
	})

	it("404 se INGV non trova l'evento (204/404 upstream)", async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
		const res = await call('999999999')
		expect(res.status).toBe(404)
	})

	it('502 su errore upstream', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
		const res = await call('44125672')
		expect(res.status).toBe(502)
	})
})
