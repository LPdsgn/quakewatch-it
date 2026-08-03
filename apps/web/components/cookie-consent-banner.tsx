'use client'

import { useEffect } from 'react'
import * as CookieConsent from 'vanilla-cookieconsent'

import { disableAnalytics, enableAnalytics } from '@/lib/analytics'

export function showCookiePreferences() {
	CookieConsent.showPreferences()
}

export function CookieConsentBanner() {
	useEffect(() => {
		void CookieConsent.run({
			categories: {
				analytics: { enabled: false },
			},
			guiOptions: {
				consentModal: { layout: 'box', position: 'bottom right' },
				preferencesModal: { layout: 'box' },
			},
			language: {
				default: 'it',
				translations: {
					it: {
						consentModal: {
							title: 'La tua privacy',
							description:
								'Usiamo cookie analitici facoltativi per capire come viene usata QuakeWatch.',
							acceptAllBtn: 'Accetta',
							acceptNecessaryBtn: 'Rifiuta',
							showPreferencesBtn: 'Gestisci preferenze',
						},
						preferencesModal: {
							title: 'Preferenze privacy',
							acceptAllBtn: 'Accetta',
							acceptNecessaryBtn: 'Rifiuta',
							savePreferencesBtn: 'Salva preferenze',
							sections: [
								{
									title: 'Cookie analitici',
									description:
										'Consentono statistiche d’uso anonime con PostHog. Puoi modificare questa scelta in qualunque momento.',
									linkedCategory: 'analytics',
								},
							],
						},
					},
				},
			},
			onConsent: ({ cookie }) => {
				if (cookie.categories.includes('analytics')) enableAnalytics()
			},
			onChange: ({ cookie }) => {
				if (cookie.categories.includes('analytics')) enableAnalytics()
				else disableAnalytics()
			},
		})
	}, [])

	return null
}
