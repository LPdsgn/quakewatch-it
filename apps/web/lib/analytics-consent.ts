let analyticsConsent = false
const consentListeners = new Set<() => void>()

let bannerVisible = false
const visibilityListeners = new Set<() => void>()

export function analyticsConsentGranted() {
	return analyticsConsent
}

export function setAnalyticsConsentState(enabled: boolean) {
	analyticsConsent = enabled
	consentListeners.forEach((listener) => listener())
}

export async function hydrateAnalyticsConsent(readConsent: () => Promise<boolean>) {
	setAnalyticsConsentState(await readConsent())
}

export function subscribeAnalyticsConsent(listener: () => void) {
	consentListeners.add(listener)
	return () => {
		consentListeners.delete(listener)
	}
}

export function consentBannerVisible() {
	return bannerVisible
}

export function setConsentBannerVisible(visible: boolean) {
	bannerVisible = visible
	visibilityListeners.forEach((listener) => listener())
}

export function subscribeConsentBannerVisible(listener: () => void) {
	visibilityListeners.add(listener)
	return () => {
		visibilityListeners.delete(listener)
	}
}
