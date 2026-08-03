import { expect, it } from 'vitest'

it('notifies every subscriber when consent changes', async () => {
	const { setAnalyticsConsentState, subscribeAnalyticsConsent } =
		await import('@/lib/analytics-consent')
	let notifications = 0
	const unsubscribe = subscribeAnalyticsConsent(() => notifications++)

	setAnalyticsConsentState(true)

	expect(notifications).toBe(1)
	unsubscribe()
})

it('hydrates the saved consent after asynchronous initialization', async () => {
	const { hydrateAnalyticsConsent, analyticsConsentGranted } =
		await import('@/lib/analytics-consent')

	await hydrateAnalyticsConsent(async () => true)

	expect(analyticsConsentGranted()).toBe(true)
})
