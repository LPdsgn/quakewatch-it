'use client'

import { useEffect } from 'react'
import * as CookieConsent from 'vanilla-cookieconsent'

import { disableAnalytics, enableAnalytics } from '@/lib/analytics'
import {
	hydrateAnalyticsConsent,
	setAnalyticsConsentState,
	setConsentBannerVisible,
} from '@/lib/analytics-consent'

let initialized = false

export function ConsentSetup() {
	useEffect(() => {
		if (initialized) return
		initialized = true

		void (async () => {
			await CookieConsent.run({
				categories: {
					analytics: { enabled: false },
				},
				autoShow: false,
				disablePageInteraction: true,
				language: {
					default: 'it',
					translations: {
						it: {
							consentModal: {},
							preferencesModal: { sections: [] },
						},
					},
				},
				onConsent: ({ cookie }) => {
					const enabled = cookie.categories.includes('analytics')
					if (enabled) enableAnalytics()
					else disableAnalytics()
					setAnalyticsConsentState(enabled)
					setConsentBannerVisible(false)
				},
				onChange: ({ cookie }) => {
					const enabled = cookie.categories.includes('analytics')
					if (enabled) enableAnalytics()
					else disableAnalytics()
					setAnalyticsConsentState(enabled)
				},
			})
			await hydrateAnalyticsConsent(async () => CookieConsent.acceptedCategory('analytics'))
			setConsentBannerVisible(!CookieConsent.validConsent())
		})()
	}, [])

	return null
}
