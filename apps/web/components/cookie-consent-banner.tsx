'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import * as CookieConsent from 'vanilla-cookieconsent'

import { Button } from '@/components/ui/button'
import { disableAnalytics, enableAnalytics } from '@/lib/analytics'
import {
	analyticsConsentGranted,
	setAnalyticsConsentState,
	subscribeAnalyticsConsent,
} from '@/lib/analytics-consent'

export { analyticsConsentGranted }

export function setAnalyticsConsent(enabled: boolean) {
	CookieConsent.acceptCategory(enabled ? 'analytics' : [], ['analytics'])
}

export function useAnalyticsConsent() {
	return useSyncExternalStore(subscribeAnalyticsConsent, analyticsConsentGranted, () => false)
}

export function CookieConsentBanner() {
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		void CookieConsent.run({
			categories: {
				analytics: { enabled: false },
			},
			autoShow: false,
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
				setVisible(false)
			},
			onChange: ({ cookie }) => {
				const enabled = cookie.categories.includes('analytics')
				if (enabled) enableAnalytics()
				else disableAnalytics()
				setAnalyticsConsentState(enabled)
			},
		})
		setAnalyticsConsentState(CookieConsent.acceptedCategory('analytics'))
		setVisible(!CookieConsent.validConsent())
	}, [])

	if (!visible) return null

	return (
		<section
			aria-label="Preferenze cookie"
			className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg sm:right-4"
		>
			<h2 className="text-sm font-semibold">Cookie analitici</h2>
			<p className="mt-1 text-sm leading-5 text-muted-foreground">
				Ci aiutano a capire come viene usata QuakeWatch. Sono facoltativi e puoi cambiare scelta
				dal menu.
			</p>
			<div className="mt-4 flex gap-2">
				<Button
					type="button"
					variant="outline"
					className="flex-1"
					onClick={() => setAnalyticsConsent(false)}
				>
					Rifiuta
				</Button>
				<Button type="button" className="flex-1" onClick={() => setAnalyticsConsent(true)}>
					Accetta
				</Button>
			</div>
		</section>
	)
}
