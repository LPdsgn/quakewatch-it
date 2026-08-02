import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../app/api/events/[eventId]/shakemap/route'

const fixtureJson = readFileSync(
	fileURLToPath(
		new URL('../../../packages/core/test/fixtures/shakemap-cont-mi.json', import.meta.url)
	),
	'utf8'
)

const call = (eventId: string) =>
	GET(new Request(`http://localhost/api/events/${eventId}/shakemap`), {
		params: Promise.resolve({ eventId }),
	})

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/events/[eventId]/shakemap', () => {
	it('200: GeoJSON pass-through con header cache CDN', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fixtureJson, { status: 200 })))
		const res = await call('46725592')
		expect(res.status).toBe(200)
		expect(res.headers.get('Cache-Control')).toBe(
			'public, s-maxage=300, stale-while-revalidate=3600'
		)
		const body = await res.json()
		expect(body.features).toHaveLength(9)
	})

	it('400 su eventId non numerico', async () => {
		const res = await call('DROP-TABLE')
		expect(res.status).toBe(400)
	})

	it('404 se upstream risponde 404', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))
		const res = await call('999999999')
		expect(res.status).toBe(404)
		expect(res.headers.get('Cache-Control')).toBe('no-store')
	})

	it('404 se upstream risponde 204 (nessun prodotto ShakeMap)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
		const res = await call('999999999')
		expect(res.status).toBe(404)
		expect(res.headers.get('Cache-Control')).toBe('no-store')
	})

	it('502 su errore upstream (500)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
		const res = await call('46725592')
		expect(res.status).toBe(502)
		expect(res.headers.get('Cache-Control')).toBe('no-store')
	})

	it('502 su fetch timeout (AbortSignal.timeout)', async () => {
		const timeoutError = new DOMException('The operation was aborted.', 'TimeoutError')
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError))
		const res = await call('46725592')
		expect(res.status).toBe(502)
	})

	it('502 su JSON non valido', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 }))
		)
		const res = await call('46725592')
		expect(res.status).toBe(502)
		expect(res.headers.get('Cache-Control')).toBe('no-store')
	})
})
