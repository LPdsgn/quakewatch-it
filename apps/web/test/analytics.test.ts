import { beforeEach, describe, expect, it, vi } from 'vitest'

const init = vi.fn()
const capture = vi.fn()
const captureException = vi.fn()
const optInCapturing = vi.fn()
const optOutCapturing = vi.fn()
const reset = vi.fn()

vi.mock('posthog-js', () => ({
	default: {
		init,
		capture,
		captureException,
		opt_in_capturing: optInCapturing,
		opt_out_capturing: optOutCapturing,
		reset,
	},
}))

describe('analytics', () => {
	beforeEach(() => {
		vi.resetModules()
		vi.clearAllMocks()
		vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-token')
		vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://test.posthog.com')
	})

	it('does not capture until analytics is enabled', async () => {
		const analytics = await import('@/lib/analytics')
		analytics.capture('earthquake_selected')
		expect(capture).not.toHaveBeenCalled()

		analytics.enableAnalytics()
		analytics.capture('earthquake_selected', { area: 'italia' })
		expect(init).toHaveBeenCalledOnce()
		expect(capture).toHaveBeenCalledWith('earthquake_selected', { area: 'italia' })
	})

	it('stops capture and clears the anonymous identifier on revocation', async () => {
		const analytics = await import('@/lib/analytics')
		analytics.enableAnalytics()
		analytics.disableAnalytics()
		expect(optOutCapturing).toHaveBeenCalledOnce()
		expect(reset).toHaveBeenCalledOnce()
		expect(reset).toHaveBeenCalledBefore(optOutCapturing)
		analytics.capture('earthquake_selected')
		expect(capture).not.toHaveBeenCalled()
	})
})
