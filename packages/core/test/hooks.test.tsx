import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useEventDetailQuery, useEventsQuery } from '../src/hooks'

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
		{children}
	</QueryClientProvider>
)

afterEach(() => vi.unstubAllGlobals())

const eventsBody = { events: [], fetchedAt: '2026-08-02T10:00:00Z' }

describe('useEventsQuery', () => {
	it('chiama il proxy con window e area e ritorna la risposta', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify(eventsBody), { status: 200 }))
		vi.stubGlobal('fetch', fetchMock)
		const { result } = renderHook(() => useEventsQuery('7d', 'campi-flegrei'), { wrapper })
		await waitFor(() => expect(result.current.isSuccess).toBe(true))
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/events?window=7d&area=campi-flegrei')
		expect(result.current.data?.fetchedAt).toBe(eventsBody.fetchedAt)
	})

	it('errore HTTP → isError (niente throw silenzioso)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 502 })))
		const { result } = renderHook(() => useEventsQuery('24h', 'italia'), { wrapper })
		await waitFor(() => expect(result.current.isError).toBe(true))
	})
})

describe('useEventDetailQuery', () => {
	it('eventId null → query disabilitata (nessuna fetch)', () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		const { result } = renderHook(() => useEventDetailQuery(null), { wrapper })
		expect(result.current.fetchStatus).toBe('idle')
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
