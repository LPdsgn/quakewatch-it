import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import './globals.css'
import { CookieConsentBanner } from '@/components/cookie-consent-banner'

import { Providers } from './providers'

const sans = localFont({
	src: [
		{ path: '../assets/fonts/InterVariable.woff2', weight: '100 900', style: 'normal' },
		{ path: '../assets/fonts/InterVariable-Italic.woff2', weight: '100 900', style: 'italic' },
	],
	variable: '--font-sans',
	display: 'swap',
	fallback: ['system-ui', 'sans-serif'],
})

const mono = localFont({
	src: [{ path: '../assets/fonts/JetBrains-Mono-VF.woff2', weight: '100 800', style: 'normal' }],
	variable: '--font-mono',
	display: 'swap',
	fallback: ['ui-monospace', 'Consolas', 'monospace'],
})

export const metadata: Metadata = {
	title: { default: 'QuakeWatch', template: '%s · QuakeWatch' },
	description:
		"Monitoraggio sismico dell'Italia su dati INGV — Osservatorio Nazionale Terremoti. Dati preliminari soggetti a revisione.",
	// PWA (manifest.ts): standalone su iOS con status bar integrata nel tema.
	appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'QuakeWatch' },
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
	// Colore del chrome del browser per tema: valori di --background (theme.css).
	themeColor: [
		{ media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
		{ media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
	],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="it" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
			<body>
				<CookieConsentBanner />
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
