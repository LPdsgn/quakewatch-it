let analyticsConsent = false
const listeners = new Set<() => void>()

export function analyticsConsentGranted() {
	return analyticsConsent
}

export function setAnalyticsConsentState(enabled: boolean) {
	analyticsConsent = enabled
	listeners.forEach((listener) => listener())
}

export function subscribeAnalyticsConsent(listener: () => void) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
