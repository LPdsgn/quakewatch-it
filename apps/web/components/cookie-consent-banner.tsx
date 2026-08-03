'use client'

import { Info } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import * as CookieConsent from 'vanilla-cookieconsent'

import { Alert, AlertDescription, AlertTitle, AlertAction } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
	analyticsConsentGranted,
	consentBannerVisible,
	subscribeAnalyticsConsent,
	subscribeConsentBannerVisible,
} from '@/lib/analytics-consent'
import { cn } from '@/lib/utils'

export { analyticsConsentGranted }

export function setAnalyticsConsent(enabled: boolean) {
	CookieConsent.acceptCategory(enabled ? 'analytics' : [], enabled ? [] : ['analytics'])
}

export function useAnalyticsConsent() {
	return useSyncExternalStore(subscribeAnalyticsConsent, analyticsConsentGranted, () => false)
}

function useConsentBannerVisible() {
	return useSyncExternalStore(subscribeConsentBannerVisible, consentBannerVisible, () => false)
}

export function CookieConsentBanner({ className }: { className?: string }) {
	const visible = useConsentBannerVisible()

	if (!visible) return null

	return (
		<Alert
			aria-label="Preferenze cookie"
			className={cn(
				'rounded-xl border border-border bg-card p-3 text-popover-foreground shadow-lg',
				className
			)}
		>
			<Info />
			<AlertTitle>Strumenti di analisi</AlertTitle>
			<AlertDescription className="md:mt-1 text-xs text-muted-foreground max-w-[85%]">
				Ci aiutano a capire come viene usata QuakeWatch. Sono facoltativi e puoi cambiare scelta
				dal menu.
			</AlertDescription>
			<AlertAction className="mt-2 flex md:flex-col-reverse gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="flex-1 min-h-7"
					onClick={() => setAnalyticsConsent(false)}
				>
					Rifiuta
				</Button>
				<Button
					type="button"
					size="sm"
					className="flex-1 min-h-7"
					onClick={() => setAnalyticsConsent(true)}
				>
					Accetta
				</Button>
			</AlertAction>
		</Alert>
	)
}
